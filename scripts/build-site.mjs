/**
 * 生成「鲸市·在线市场」的静态数据：
 *   - 读取 data/curated.json（精选 + 个人插件）
 *   - 拉取公共 format 1 目录
 *   - 合并、去重、写 site/index.json
 *
 * 用法：node scripts/build-site.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(HERE, '..')
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, 'market.config.json'), 'utf8'))
const CURATED = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'curated.json'), 'utf8'))
const OUT = path.join(ROOT, 'site', 'index.json')

const clean = (value, max) => String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, max)
const pair = (value) => {
  if (typeof value === 'string') return { zh: value, en: value }
  if (value && typeof value === 'object') {
    return {
      zh: clean(value.zh ?? value.en ?? '', 4000),
      en: clean(value.en ?? value.zh ?? '', 4000),
    }
  }
  return { zh: '', en: '' }
}

function normalizeVersion(name, raw) {
  if (!raw || typeof raw.version !== 'string' || !raw.version.trim()) return undefined
  const source = raw.source && typeof raw.source === 'object' ? raw.source : { type: 'npm' }
  return {
    version: raw.version.trim(),
    publishedAt: Number(raw.publishTimestamp) > 0 ? Number(raw.publishTimestamp) * 1000 : (Number(raw.publishedAt) > 0 ? Number(raw.publishedAt) : undefined),
    engines: raw.engines && typeof raw.engines === 'object' ? raw.engines : undefined,
    source: {
      type: typeof source.type === 'string' ? source.type : 'npm',
      ...(typeof source.registry === 'string' ? { registry: source.registry } : {}),
      ...(typeof source.url === 'string' ? { url: source.url } : {}),
      ...(typeof source.commit === 'string' ? { commit: source.commit } : {}),
      ...(typeof source.path === 'string' ? { path: source.path } : {}),
    },
  }
}

function normalize(raw) {
  if (!raw || typeof raw.name !== 'string') return undefined
  const versions = (Array.isArray(raw.versions) ? raw.versions : [])
    .map((version) => normalizeVersion(raw.name, version))
    .filter(Boolean)
  if (!versions.length) return undefined
  const meta = raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : {}
  const category = String(raw.category ?? meta.category ?? 'tools')
  return {
    name: raw.name,
    title: pair(raw.title),
    description: pair(raw.description),
    homepage: typeof raw.homepage === 'string' ? raw.homepage : undefined,
    repository: raw.repository && typeof raw.repository === 'object' ? {
      url: typeof raw.repository.url === 'string' ? raw.repository.url : undefined,
      directory: typeof raw.repository.directory === 'string' ? raw.repository.directory : undefined,
    } : undefined,
    metadata: {
      category: /^[a-z0-9][a-z0-9._-]{0,63}$/i.test(category) ? category : 'tools',
      keywords: (Array.isArray(raw.keywords) ? raw.keywords : Array.isArray(meta.keywords) ? meta.keywords : []).map((k) => clean(k, 40)).filter(Boolean).slice(0, 20),
      labels: (Array.isArray(raw.labels) ? raw.labels : Array.isArray(meta.labels) ? meta.labels : []).map((l) => clean(l, 40)).filter(Boolean).slice(0, 20),
    },
    versions,
    ...(raw.note ? { note: clean(raw.note, 500) } : {}),
    ...(Number.isFinite(raw.featured) ? { featured: Number(raw.featured) } : {}),
    ...(raw.emoji ? { emoji: clean(raw.emoji, 8) } : {}),
    ...(raw.personal ? { personal: true } : {}),
    ...(raw.localPath ? { localPath: clean(raw.localPath, 500) } : {}),
  }
}

async function fetchPublic() {
  let lastError
  for (const url of CONFIG.publicIndexes) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { accept: 'application/json' } })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const json = await response.json()
        if (json?.format !== 1 || !Array.isArray(json.plugins)) throw new Error('not a format 1 index')
        console.log(`public index: ${url} (${json.plugins.length} plugins)`)
        return { url, json }
      } catch (error) {
        lastError = error
        console.warn(`  ${url} attempt ${attempt + 1}: ${error.message}`)
        await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)))
      }
    }
  }
  throw lastError ?? new Error('no public index')
}

const publicIndex = await fetchPublic()
const byName = new Map()
const order = []

function add(plugin, curated) {
  const existing = byName.get(plugin.name)
  if (existing) {
    const known = new Set(existing.versions.map((version) => `${version.version}\0${version.source.type}`))
    for (const version of plugin.versions) {
      if (!known.has(`${version.version}\0${version.source.type}`)) existing.versions.push(version)
    }
    existing.versions.sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0))
    if (curated) {
      existing.title = plugin.title.zh || plugin.title.en ? plugin.title : existing.title
      existing.description = plugin.description.zh || plugin.description.en ? plugin.description : existing.description
      existing.homepage = plugin.homepage ?? existing.homepage
      existing.repository = plugin.repository ?? existing.repository
      existing.metadata.category = plugin.metadata.category || existing.metadata.category
      existing.note = plugin.note ?? existing.note
      existing.featured = plugin.featured ?? existing.featured
      existing.emoji = plugin.emoji ?? existing.emoji
      existing.personal = plugin.personal ?? existing.personal
      existing.localPath = plugin.localPath ?? existing.localPath
      existing.curated = true
    }
    return
  }
  const copy = { ...plugin, ...(curated ? { curated: true } : {}) }
  byName.set(copy.name, copy)
  order.push(copy.name)
}

for (const plugin of CURATED.plugins) {
  // 本地 link 目录只在这台机器上可用，不放进公网目录，避免把本机路径公开给访客。
  if (Array.isArray(plugin.versions) && plugin.versions.length > 0 && plugin.versions.every((version) => version.source?.type === 'link')) continue
  const normalized = normalize(plugin)
  if (normalized) add(normalized, true)
}
for (const plugin of publicIndex.json.plugins) {
  const normalized = normalize(plugin)
  if (normalized) add(normalized, false)
}

// 精选排序：featured 升序在前，其余保持公共目录顺序。
const curatedNames = new Set((CURATED.plugins ?? []).map((plugin) => plugin.name))
const plugins = [...byName.values()]
plugins.sort((a, b) => {
  const ac = curatedNames.has(a.name) ? 0 : 1
  const bc = curatedNames.has(b.name) ? 0 : 1
  if (ac !== bc) return ac - bc
  const af = a.featured ?? 999
  const bf = b.featured ?? 999
  if (af !== bf) return af - bf
  return 0
})

const categories = { ...(publicIndex.json.metadata?.categories ?? {}) }
if (!categories.personal) categories.personal = { title: { zh: '我的', en: 'Mine' } }
categories.tools ??= { title: { zh: '工具', en: 'Tools' } }

const output = {
  format: 1,
  title: { zh: '鲸市 · 在线插件市场', en: 'Whale Market' },
  description: {
    zh: '给 DeepSeek Harness 自己用的插件市场：精选、公共目录和本地插件放在一个地方。',
    en: 'A personal plugin market for DSH: curated picks, public indexes, and local plugins.',
  },
  metadata: {
    categories,
    labels: publicIndex.json.metadata?.labels ?? {},
    sortKeys: publicIndex.json.metadata?.sortKeys ?? {},
  },
  market: {
    generatedAt: new Date().toISOString(),
    publicSource: publicIndex.url,
    curatedCount: plugins.filter((plugin) => plugin.curated).length,
    total: plugins.length,
    pluginInstall: CONFIG.pluginInstall,
    pluginRepo: `https://github.com/${CONFIG.owner}/${CONFIG.repo}`,
    siteUrl: CONFIG.siteUrl,
    indexUrl: CONFIG.indexUrl,
  },
  plugins,
}

// 简单校验：名字唯一、版本非空、spec 能生成。
const seen = new Set()
for (const plugin of plugins) {
  if (seen.has(plugin.name)) throw new Error(`duplicate plugin: ${plugin.name}`)
  seen.add(plugin.name)
  if (!plugin.versions.length) throw new Error(`no versions: ${plugin.name}`)
  for (const version of plugin.versions) {
    if (!version.version) throw new Error(`empty version: ${plugin.name}`)
    if (!['npm', 'git', 'link', 'tarball'].includes(version.source.type)) throw new Error(`bad source: ${plugin.name}`)
  }
}

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, JSON.stringify(output))
const bytes = fs.statSync(OUT).size
console.log(`wrote ${path.relative(ROOT, OUT)}: ${plugins.length} plugins, ${(bytes / 1024 / 1024).toFixed(2)} MB`)
