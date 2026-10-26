/**
 * 从公共 format 1 目录里抽出「鲸市」的精选条目，生成 data/curated.json。
 *
 *   node tools/build-curated.mjs
 *
 * 公共目录只是数据来源；生成后的 curated.json 会随插件一起离线可用。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(HERE, '..')
const INDEX_URLS = [
  'https://cdn.jsdelivr.net/npm/dsh-plugin-catalog/index.json',
  'https://dshmarket.com/index.json',
]

const text = (value) => {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') return { zh: String(value.zh ?? value.en ?? ''), en: String(value.en ?? value.zh ?? '') }
  return { zh: '', en: '' }
}

const cleanUrl = (value) => {
  if (typeof value !== 'string') return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined
  } catch {
    return undefined
  }
}

function normalize(raw) {
  if (!raw || typeof raw !== 'object') return undefined
  const name = String(raw.name ?? '').trim()
  if (!name) return undefined
  const versions = (Array.isArray(raw.versions) ? raw.versions : [])
    .filter((v) => v && typeof v.version === 'string' && v.version.trim())
    .map((v) => ({
      version: v.version.trim(),
      publishedAt: Number(v.publishTimestamp) > 0 ? Number(v.publishTimestamp) * 1000 : undefined,
      engines: v.engines && typeof v.engines === 'object' ? v.engines : undefined,
      source: v.source && typeof v.source === 'object' ? v.source : { type: 'npm' },
    }))
    .sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0))
  if (!versions.length) return undefined
  const repo = raw.repository && typeof raw.repository === 'object' ? raw.repository : undefined
  return {
    name,
    title: text(raw.title),
    description: text(raw.description),
    homepage: cleanUrl(raw.homepage),
    repository: repo?.url ? { url: cleanUrl(repo.url), directory: typeof repo.directory === 'string' ? repo.directory : undefined } : undefined,
    category: typeof raw.metadata?.category === 'string' ? raw.metadata.category : 'tools',
    keywords: Array.isArray(raw.metadata?.keywords) ? raw.metadata.keywords.filter((k) => typeof k === 'string').slice(0, 20) : [],
    versions,
  }
}

async function fetchCatalog() {
  let lastError
  for (const url of INDEX_URLS) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { accept: 'application/json' } })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const json = await response.json()
        if (json?.format !== 1 || !Array.isArray(json.plugins)) throw new Error('not a format 1 index')
        console.log(`读取 ${url}：${json.plugins.length} 个条目`)
        return { url, json }
      } catch (error) {
        lastError = error
        console.warn(`  ${url} 第 ${attempt + 1} 次失败：${error.message}`)
        await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)))
      }
    }
  }
  throw lastError ?? new Error('无法读取公共目录')
}

const selection = JSON.parse(fs.readFileSync(path.join(HERE, 'curated.selection.json'), 'utf8'))
const personal = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'personal.json'), 'utf8'))
const { url, json } = await fetchCatalog()
const byName = new Map()
for (const raw of json.plugins) {
  const entry = normalize(raw)
  if (entry && !byName.has(entry.name)) byName.set(entry.name, entry)
}

const plugins = []
const missing = []
for (const pick of selection) {
  const entry = byName.get(pick.name)
  if (!entry) {
    missing.push(pick.name)
    continue
  }
  plugins.push({
    ...entry,
    note: typeof pick.note === 'string' ? pick.note : undefined,
    featured: Number.isFinite(pick.featured) ? pick.featured : undefined,
  })
}
for (const entry of personal.plugins ?? []) {
  const normalized = normalize(entry) ?? {
    ...entry,
    title: text(entry.title),
    description: text(entry.description),
  }
  plugins.push({ ...normalized, ...entry, personal: true })
}

plugins.sort((a, b) => (a.featured ?? 999) - (b.featured ?? 999) || a.name.localeCompare(b.name))
const output = {
  format: 1,
  title: text(personal.title ?? '鲸市 · 自己的插件市场'),
  description: text(personal.description ?? ''),
  generatedAt: new Date().toISOString(),
  source: url,
  plugins,
}
fs.writeFileSync(path.join(ROOT, 'data', 'curated.json'), `${JSON.stringify(output, null, 2)}\n`)
console.log(`写入 ${path.join('data', 'curated.json')}：${plugins.length} 个精选条目`)
if (missing.length) console.warn(`公共目录里暂时没有：${missing.join(', ')}`)
