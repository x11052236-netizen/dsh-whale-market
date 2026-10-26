/**
 * dsh-whale-market —— 鲸市 · 宿主侧
 *
 * 职责：
 *   1. 读取随包携带的精选目录 data/curated.json；
 *   2. 拉取并校验用户配置的 format 1 插件目录（默认公共目录），合并去重；
 *   3. 对照 pluginManager.listBundles() 标注已安装 / 可更新；
 *   4. 通过 pluginManager.installBundle / removeBundle / setBundleEnabled 执行安装、卸载、启停；
 *   5. 所有 HTTP 路由都过 DSH 的 connection 信任栅栏，写操作只接受本机回环。
 *
 * 不引入任何第三方依赖：目录解析、搜索、分页、SemVer 比较都在本文件里。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PKG = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'package.json'), 'utf8'))
const SELF = PKG.name
const DATA_FILE = path.join(HERE, '..', 'data', 'curated.json')
const DSH_HOME = process.env.DSH_WHALE_MARKET_HOME || process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
const CONFIG_FILE = path.join(DSH_HOME, 'whale-market.json')
const CACHE_DIR = path.join(DSH_HOME, 'whale-market', 'cache')

const PUBLIC_INDEXES = [
  'https://cdn.jsdelivr.net/npm/dsh-plugin-catalog/index.json',
  'https://dshmarket.com/index.json',
]

/**
 * 在线鲸市的稳定地址。部署到自己的 GitHub Pages 后，这里就是插件的默认目录；
 * 未部署时 loadSource 会继续尝试 PUBLIC_INDEXES，不影响本地精选。
 * 可以用 DSH_WHALE_MARKET_INDEX 临时覆盖（本地调试很有用）。
 */
const WHALE_SITE_URL = process.env.DSH_WHALE_MARKET_INDEX || 'https://x11052236-netizen.github.io/dsh-whale-market/index.json'

const DEFAULT_CONFIG = {
  sources: [
    {
      id: 'whale',
      title: '鲸市在线',
      urls: [WHALE_SITE_URL, ...PUBLIC_INDEXES],
      enabled: true,
    },
  ],
  cacheTtlMs: 6 * 60 * 60 * 1000,
}

/** 分类中文名。公共目录里没声明或新增的分类会退化成 id。 */
const CATEGORY_TITLES = {
  personal: { zh: '我的', en: 'Mine' },
  market: { zh: '市场与管理', en: 'Markets' },
  memory: { zh: '记忆', en: 'Memory' },
  session: { zh: '会话', en: 'Sessions' },
  ui: { zh: '界面', en: 'UI' },
  tools: { zh: '工具', en: 'Tools' },
  fun: { zh: '娱乐', en: 'Fun' },
  dev: { zh: '开发与运行时', en: 'Development' },
  model: { zh: '模型与接入', en: 'Models' },
  notify: { zh: '通知与集成', en: 'Notifications' },
  remote: { zh: '远程与移动', en: 'Remote' },
  theme: { zh: '主题与外观', en: 'Themes' },
  usage: { zh: '用量与计费', en: 'Usage' },
  browser: { zh: '浏览器与网页', en: 'Browser' },
  vision: { zh: '视觉与多模态', en: 'Vision' },
  voice: { zh: '语音与音频', en: 'Voice' },
  git: { zh: 'Git 与评审', en: 'Git' },
  workflow: { zh: '工作流与自动化', en: 'Workflow' },
  skill: { zh: '技能包', en: 'Skills' },
  docs: { zh: '文档与渲染', en: 'Docs' },
  security: { zh: '安全与权限', en: 'Security' },
  wsl: { zh: 'WSL 与 Windows', en: 'WSL' },
  identity: { zh: '身份与通信', en: 'Identity' },
  agi: { zh: 'AGI 架构', en: 'AGI' },
}

const CATEGORY_ORDER = Object.keys(CATEGORY_TITLES)

// ── 小工具 ────────────────────────────────────────────────────────────────

const now = () => Date.now()

function json(res, status, body) {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  res.end(text)
}

function fail(code, message, details) {
  return { ok: false, error: { code, message, ...(details === undefined ? {} : { details }) } }
}

function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        reject(new Error('请求体过大'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function isLoopbackHost(req) {
  const host = String(req.headers?.host ?? '').toLowerCase()
  const name = host.startsWith('[') ? host.slice(0, host.indexOf(']') + 1) : host.split(':')[0]
  return name === '127.0.0.1' || name === 'localhost' || name === '[::1]' || name === '::1'
}

function cleanText(value, max) {
  if (typeof value !== 'string') return ''
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, max)
}

function cleanUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return undefined
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
    if (url.username || url.password || url.hash) return undefined
    return url.href
  } catch {
    return undefined
  }
}

function atomicWrite(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const temp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`
  fs.writeFileSync(temp, content)
  fs.renameSync(temp, file)
}

function hashId(text) {
  return crypto.createHash('sha1').update(text).digest('hex').slice(0, 12)
}

function stripAnsi(text) {
  return String(text ?? '').replace(/[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d/#&.:=?%@~_]+)*)?\u0007)|(?:(?:\d{1,4}(?:[;:]\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g, '')
}

// ── SemVer（足够给插件排序 / 判断更新）────────────────────────────────────

function parseVersion(value) {
  const match = String(value ?? '').trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+.*)?$/)
  if (!match) return null
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    pre: match[4] ? match[4].split('.') : [],
  }
}

function comparePre(a, b) {
  if (a.length === 0 && b.length === 0) return 0
  if (a.length === 0) return 1
  if (b.length === 0) return -1
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if (a[i] === undefined) return -1
    if (b[i] === undefined) return 1
    const an = /^\d+$/.test(a[i])
    const bn = /^\d+$/.test(b[i])
    if (an && bn) {
      const diff = Number(a[i]) - Number(b[i])
      if (diff !== 0) return diff
    } else if (an !== bn) {
      return an ? -1 : 1
    } else {
      const diff = a[i].localeCompare(b[i])
      if (diff !== 0) return diff
    }
  }
  return 0
}

function compareVersion(a, b) {
  const left = parseVersion(a)
  const right = parseVersion(b)
  if (!left || !right) return String(a ?? '').localeCompare(String(b ?? ''))
  if (left.major !== right.major) return left.major - right.major
  if (left.minor !== right.minor) return left.minor - right.minor
  if (left.patch !== right.patch) return left.patch - right.patch
  return comparePre(left.pre, right.pre)
}

function isStable(version) {
  return parseVersion(version)?.pre.length === 0
}

function highestVersion(versions) {
  const stable = versions.filter((v) => isStable(v.version)).sort((a, b) => compareVersion(b.version, a.version))
  if (stable.length) return stable[0]
  return [...versions].sort((a, b) => compareVersion(b.version, a.version))[0]
}

// ── format 1 目录解析 ─────────────────────────────────────────────────────

function textPair(value) {
  if (typeof value === 'string') return { zh: cleanText(value, 300), en: cleanText(value, 300) }
  if (value && typeof value === 'object') {
    const zh = cleanText(value.zh ?? value.en ?? '', 300)
    const en = cleanText(value.en ?? value.zh ?? '', 300)
    return { zh, en }
  }
  return { zh: '', en: '' }
}

function textPairLong(value, max) {
  const pair = textPair(value)
  return { zh: cleanText(pair.zh, max), en: cleanText(pair.en, max) }
}

function normalizeMeta(value) {
  const out = {}
  if (!value || typeof value !== 'object') return out
  for (const [id, raw] of Object.entries(value)) {
    if (!/^[a-z0-9][a-z0-9._-]{0,63}$/i.test(id)) continue
    out[id] = { title: textPair(raw?.title ?? id) }
  }
  return out
}

function versionSpec(name, version) {
  const source = version.source && typeof version.source === 'object' ? version.source : { type: 'npm' }
  if (source.type === 'npm') return `${name}@${version.version}`
  if (source.type === 'link') {
    if (typeof source.path !== 'string' || !source.path.trim()) return undefined
    return `link:${source.path.replace(/\\/g, '/')}`
  }
  if (source.type === 'git') {
    const rawUrl = typeof source.url === 'string' ? source.url : ''
    const url = cleanUrl(rawUrl.startsWith('git+') ? rawUrl.slice(4) : rawUrl)
    if (!url) return undefined
    const base = url.startsWith('git+') ? url : `git+${url}`
    const commit = typeof source.commit === 'string' && /^[0-9a-f]{7,64}$/i.test(source.commit) ? `#${source.commit}` : ''
    const sub = typeof source.path === 'string' && source.path.trim() ? `&path:/${source.path.replace(/^\/+/, '')}` : ''
    return `${base}${commit}${sub}`
  }
  if (source.type === 'tarball') {
    const url = cleanUrl(source.url)
    return url
  }
  return undefined
}

function normalizeVersion(name, raw) {
  if (!raw || typeof raw !== 'object') return undefined
  const version = cleanText(String(raw.version ?? ''), 100).trim()
  if (!version || !/^[0-9A-Za-z.+-]+$/.test(version)) return undefined
  const source = raw.source && typeof raw.source === 'object' ? raw.source : { type: 'npm' }
  const normalized = {
    version,
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
  normalized.spec = versionSpec(name, normalized)
  return normalized.spec ? normalized : undefined
}

function normalizePlugin(raw, source) {
  if (!raw || typeof raw !== 'object') return undefined
  const name = cleanText(String(raw.name ?? ''), 214).trim()
  if (!/^(@[a-zA-Z0-9._-]+\/)?[a-zA-Z0-9._-]+$/.test(name)) return undefined
  const meta = raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : {}
  const category = String(raw.category ?? meta.category ?? 'tools')
  const versions = (Array.isArray(raw.versions) ? raw.versions : [])
    .map((version) => normalizeVersion(name, version))
    .filter(Boolean)
    .sort((a, b) => compareVersion(b.version, a.version))
  if (!versions.length) return undefined
  const repo = raw.repository && typeof raw.repository === 'object' ? raw.repository : undefined
  return {
    name,
    title: textPair(raw.title),
    description: textPairLong(raw.description, 4000),
    homepage: cleanUrl(raw.homepage),
    repository: repo?.url ? { url: cleanUrl(repo.url), directory: cleanText(String(repo.directory ?? ''), 200) || undefined } : undefined,
    category: /^[a-z0-9][a-z0-9._-]{0,63}$/i.test(category) ? category : 'tools',
    keywords: (Array.isArray(raw.keywords) ? raw.keywords : Array.isArray(meta.keywords) ? meta.keywords : [])
      .map((k) => cleanText(String(k), 40)).filter(Boolean).slice(0, 20),
    labels: (Array.isArray(raw.labels) ? raw.labels : Array.isArray(meta.labels) ? meta.labels : [])
      .map((l) => cleanText(String(l), 40)).filter(Boolean).slice(0, 20),
    versions,
    source: source ?? undefined,
  }
}

function normalizeIndex(raw, source) {
  if (!raw || typeof raw !== 'object' || raw.format !== 1 || !Array.isArray(raw.plugins)) {
    throw new Error('不是 format 1 的插件目录')
  }
  const plugins = []
  const seen = new Set()
  for (const item of raw.plugins) {
    const plugin = normalizePlugin(item, source)
    if (!plugin || seen.has(plugin.name)) continue
    seen.add(plugin.name)
    plugins.push(plugin)
  }
  return {
    format: 1,
    title: textPair(raw.title ?? source.title),
    description: textPairLong(raw.description, 500),
    categories: normalizeMeta(raw.metadata?.categories),
    labels: normalizeMeta(raw.metadata?.labels),
    sortKeys: normalizeMeta(raw.metadata?.sortKeys),
    plugins,
  }
}

// ── 配置与缓存 ────────────────────────────────────────────────────────────

function normalizeSource(raw, index) {
  if (!raw || typeof raw !== 'object') return undefined
  const urls = (Array.isArray(raw.urls) ? raw.urls : [raw.url])
    .map((url) => cleanUrl(url))
    .filter(Boolean)
    .slice(0, 4)
  if (!urls.length) return undefined
  const title = cleanText(String(raw.title ?? ''), 60) || `目录 ${index + 1}`
  return {
    id: /^[a-z0-9][a-z0-9._-]{0,63}$/i.test(String(raw.id ?? '')) ? String(raw.id) : `source-${hashId(urls[0])}`,
    title,
    urls,
    enabled: raw.enabled !== false,
  }
}

function readConfig() {
  let stored = {}
  try {
    stored = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))
  } catch {
    stored = {}
  }
  const rawSources = Array.isArray(stored.sources) ? stored.sources : DEFAULT_CONFIG.sources
  const sources = rawSources.map(normalizeSource).filter(Boolean)
  const unique = []
  const seen = new Set()
  for (const source of sources) {
    if (seen.has(source.id)) continue
    seen.add(source.id)
    unique.push(source)
  }
  const ttl = Number(stored.cacheTtlMs)
  return {
    // 空数组是用户的选择（只用精选），不要悄悄塞回默认源。
    sources: unique,
    cacheTtlMs: Number.isFinite(ttl) ? Math.min(Math.max(ttl, 5 * 60 * 1000), 7 * 24 * 60 * 60 * 1000) : DEFAULT_CONFIG.cacheTtlMs,
  }
}

function writeConfig(config) {
  atomicWrite(CONFIG_FILE, `${JSON.stringify(config, null, 2)}\n`)
}

function cacheFile(source) {
  return path.join(CACHE_DIR, `${hashId(source.id + '\0' + source.urls.join('\0'))}.json`)
}

function readCache(source) {
  try {
    const cached = JSON.parse(fs.readFileSync(cacheFile(source), 'utf8'))
    if (!cached || typeof cached !== 'object' || !cached.index) return undefined
    return cached
  } catch {
    return undefined
  }
}

function writeCache(source, entry) {
  try {
    atomicWrite(cacheFile(source), JSON.stringify(entry))
  } catch (error) {
    console.warn('[whale-market] 写目录缓存失败：', error?.message ?? error)
  }
}

// ── 目录加载 ──────────────────────────────────────────────────────────────

const state = {
  ctx: null,
  config: null,
  catalog: null,
  catalogAt: 0,
  loading: null,
  sources: new Map(),
  jobs: new Map(),
}

function curatedData() {
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
    const plugins = (Array.isArray(raw.plugins) ? raw.plugins : [])
      .map((item) => {
        const plugin = normalizePlugin(item, { id: 'curated', title: '鲸市精选', url: 'local' })
        if (!plugin) return undefined
        return {
          ...plugin,
          note: cleanText(String(item.note ?? ''), 500) || undefined,
          featured: Number.isFinite(item.featured) ? Number(item.featured) : undefined,
          emoji: cleanText(String(item.emoji ?? ''), 8) || undefined,
          personal: item.personal === true,
          localPath: cleanText(String(item.localPath ?? ''), 500) || undefined,
          curated: true,
        }
      })
      .filter(Boolean)
    return { title: textPair(raw.title), description: textPairLong(raw.description, 500), plugins }
  } catch (error) {
    console.warn('[whale-market] 精选目录读取失败：', error?.message ?? error)
    return { title: { zh: '鲸市', en: 'Whale Market' }, description: { zh: '', en: '' }, plugins: [] }
  }
}

async function fetchOne(source, url, previous) {
  const headers = { accept: 'application/json' }
  if (previous?.etag) headers['if-none-match'] = previous.etag
  if (previous?.lastModified) headers['if-modified-since'] = previous.lastModified
  const response = await fetch(url, {
    signal: AbortSignal.timeout(25000),
    redirect: 'error',
    headers,
  })
  if (response.status === 304 && previous?.index) {
    return { notModified: true, etag: previous.etag, lastModified: previous.lastModified }
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const length = Number(response.headers.get('content-length') ?? 0)
  if (length > 16 * 1024 * 1024) throw new Error('目录文件超过 16 MB')
  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.length > 16 * 1024 * 1024) throw new Error('目录文件超过 16 MB')
  let raw
  try {
    raw = JSON.parse(buffer.toString('utf8'))
  } catch {
    throw new Error('目录不是合法 JSON')
  }
  const index = normalizeIndex(raw, { id: source.id, title: source.title, url })
  return {
    index,
    etag: response.headers.get('etag') ?? undefined,
    lastModified: response.headers.get('last-modified') ?? undefined,
  }
}

async function loadSource(source, force) {
  const cached = readCache(source)
  const ttl = readConfig().cacheTtlMs
  if (!force && cached?.fetchedAt && now() - cached.fetchedAt < ttl) {
    const status = { ok: true, fromCache: true, fetchedAt: cached.fetchedAt, count: cached.index.plugins.length, url: cached.url }
    state.sources.set(source.id, { ...status, index: cached.index })
    return status
  }
  let lastError
  for (const url of source.urls) {
    try {
      const result = await fetchOne(source, url, cached)
      if (result.notModified && cached?.index) {
        const status = { ok: true, fromCache: true, fetchedAt: now(), count: cached.index.plugins.length, url }
        writeCache(source, { ...cached, fetchedAt: now(), url })
        state.sources.set(source.id, { ...status, index: cached.index })
        return status
      }
      const fetchedAt = now()
      writeCache(source, { fetchedAt, url, etag: result.etag, lastModified: result.lastModified, index: result.index })
      const status = { ok: true, fromCache: false, fetchedAt, count: result.index.plugins.length, url }
      state.sources.set(source.id, { ...status, index: result.index })
      return status
    } catch (error) {
      lastError = error
    }
  }
  if (cached?.index) {
    const status = { ok: false, error: String(lastError?.message ?? lastError), fromCache: true, stale: true, fetchedAt: cached.fetchedAt, count: cached.index.plugins.length, url: cached.url }
    state.sources.set(source.id, { ...status, index: cached.index })
    return status
  }
  const status = { ok: false, error: String(lastError?.message ?? lastError), fromCache: false, count: 0 }
  state.sources.set(source.id, status)
  return status
}

async function loadCatalog(force) {
  const config = readConfig()
  state.config = config
  const enabled = config.sources.filter((source) => source.enabled)
  const statuses = await Promise.all(enabled.map((source) => loadSource(source, force)))
  const curated = curatedData()
  const byName = new Map()
  const categories = {}
  const labels = {}

  const addCategory = (id) => {
    if (!id) return
    if (!categories[id]) categories[id] = { id, title: CATEGORY_TITLES[id] ?? { zh: id, en: id }, count: 0 }
  }
  for (const id of CATEGORY_ORDER) addCategory(id)

  // 先放公共目录，再让精选覆盖展示字段；顺序：精选在前，公共目录按原顺序。
  const remoteOrder = []
  for (let position = 0; position < statuses.length; position += 1) {
    const status = statuses[position]
    const index = state.sources.get(enabled[position].id)?.index
    if (!index) continue
    for (const [id, meta] of Object.entries(index.categories)) {
      if (!categories[id]) categories[id] = { id, title: meta.title, count: 0 }
    }
    for (const [id, meta] of Object.entries(index.labels)) {
      if (!labels[id]) labels[id] = { id, title: meta.title }
    }
    for (const plugin of index.plugins) {
      if (byName.has(plugin.name)) {
        const existing = byName.get(plugin.name)
        const known = new Set(existing.versions.map((v) => `${v.version}\0${v.spec}`))
        for (const version of plugin.versions) {
          if (!known.has(`${version.version}\0${version.spec}`)) existing.versions.push(version)
        }
        existing.versions.sort((a, b) => compareVersion(b.version, a.version))
        continue
      }
      byName.set(plugin.name, { ...plugin })
      remoteOrder.push(plugin.name)
    }
  }

  for (const plugin of curated.plugins) {
    const existing = byName.get(plugin.name)
    const curatedFields = {
      note: plugin.note,
      featured: plugin.featured,
      emoji: plugin.emoji,
      personal: plugin.personal,
      localPath: plugin.localPath,
    }
    if (!existing) {
      byName.set(plugin.name, { ...plugin, curated: true, ...curatedFields })
      remoteOrder.unshift(plugin.name)
      continue
    }
    const title = plugin.title.zh || plugin.title.en ? plugin.title : existing.title
    const description = plugin.description.zh || plugin.description.en ? plugin.description : existing.description
    const versions = [...plugin.versions]
    const known = new Set(versions.map((v) => `${v.version}\0${v.spec}`))
    for (const version of existing.versions) {
      if (!known.has(`${version.version}\0${version.spec}`)) versions.push(version)
    }
    versions.sort((a, b) => compareVersion(b.version, a.version))
    Object.assign(existing, {
      title,
      description,
      versions,
      category: plugin.category || existing.category,
      curated: true,
      ...curatedFields,
    })
  }

  const plugins = []
  for (const name of remoteOrder) {
    const plugin = byName.get(name)
    if (!plugin) continue
    const versions = plugin.versions.filter(Boolean)
    if (!versions.length) continue
    const defaultVersion = highestVersion(versions)
    const entry = {
      ...plugin,
      versions,
      version: defaultVersion.version,
      publishedAt: defaultVersion.publishedAt,
      engines: defaultVersion.engines,
      spec: defaultVersion.spec,
      registry: defaultVersion.source?.registry,
      displayTitle: friendlyTitle(plugin),
    }
    plugins.push(entry)
    addCategory(entry.category)
    categories[entry.category].count += 1
  }

  const categoriesList = Object.values(categories)
    .filter((category) => category.count > 0 || CATEGORY_ORDER.includes(category.id))
    .map((category) => ({ ...category, order: category.id === 'personal' ? -1 : (CATEGORY_ORDER.indexOf(category.id) === -1 ? 999 : CATEGORY_ORDER.indexOf(category.id)) }))
    .sort((a, b) => a.order - b.order || a.title.zh.localeCompare(b.title.zh, 'zh'))

  const catalog = {
    title: curated.title,
    description: curated.description,
    plugins,
    byName: new Map(plugins.map((plugin) => [plugin.name, plugin])),
    categories: categoriesList,
    labels: Object.values(labels),
    sources: config.sources.map((source) => {
      const status = statuses.find((_, index) => enabled[index]?.id === source.id)
      return {
        id: source.id,
        title: source.title,
        url: status?.url ?? source.urls[0],
        urls: source.urls,
        enabled: source.enabled,
        ok: status ? status.ok : null,
        error: status?.error,
        count: status?.count ?? 0,
        fetchedAt: status?.fetchedAt,
        fromCache: !!status?.fromCache,
        stale: !!status?.stale,
      }
    }),
    fetchedAt: now(),
  }
  state.catalog = catalog
  state.catalogAt = now()
  return catalog
}

function friendlyTitle(plugin) {
  const raw = plugin.title?.zh || plugin.title?.en || ''
  if (!raw) return plugin.name
  // 公共目录有些条目把 title 写成 owner/repo，这种直接用包名更好读。
  if (/^[^\s/]+\/[^\s/]+(?:#.*)?$/.test(raw) || /^@[^\s/]+\/[^\s/]+$/.test(raw)) {
    return plugin.name.startsWith('@') ? plugin.name.split('/')[1] : plugin.name
  }
  return raw
}

async function ensureCatalog(force = false) {
  if (state.loading) {
    if (!force) return state.loading
    // 强制刷新时不等旧请求，直接开新的；旧结果会在自己的 finally 里被忽略。
  }
  const config = readConfig()
  if (!force && state.catalog && now() - state.catalogAt < config.cacheTtlMs) return state.catalog
  const promise = loadCatalog(force).finally(() => {
    if (state.loading === promise) state.loading = null
  })
  state.loading = promise
  return promise
}

// ── 已安装状态 ────────────────────────────────────────────────────────────

function manager() {
  try {
    return state.ctx?.get?.('pluginManager') ?? state.ctx?.pluginManager
  } catch {
    return undefined
  }
}

async function readInstalled() {
  const pm = manager()
  if (!pm || typeof pm.listBundles !== 'function') {
    return { ok: false, map: new Map(), error: '当前部署没有 pluginManager，只能浏览不能安装' }
  }
  try {
    const bundles = await pm.listBundles()
    const map = new Map()
    for (const bundle of bundles ?? []) {
      if (!bundle || typeof bundle.name !== 'string') continue
      map.set(bundle.name, bundle)
    }
    return { ok: true, map }
  } catch (error) {
    return { ok: false, map: new Map(), error: String(error?.message ?? error) }
  }
}

function installedView(bundle) {
  if (!bundle) return { status: 'not-installed', enabled: false, removable: false, official: false, update: false }
  let status = 'not-installed'
  if (!bundle.installed && bundle.availability === 'installation') status = 'provided'
  else if (bundle.installed && bundle.enabled) status = 'installed'
  else if (bundle.installed && !bundle.enabled) status = 'disabled'
  return {
    status,
    version: bundle.version,
    enabled: !!bundle.enabled,
    removable: bundle.removable !== false,
    official: !!bundle.official,
    error: bundle.error?.code,
  }
}

function annotate(plugin, bundles) {
  const bundle = bundles.get(plugin.name)
  const view = installedView(bundle)
  if (view.status === 'installed' || view.status === 'disabled') {
    view.update = !!view.version && !!plugin.version && compareVersion(plugin.version, view.version) > 0
  }
  return { ...plugin, installed: view }
}

// ── 搜索与排序 ────────────────────────────────────────────────────────────

function searchText(plugin) {
  return [
    plugin.name,
    plugin.title?.zh,
    plugin.title?.en,
    plugin.description?.zh,
    plugin.description?.en,
    plugin.category,
    ...(plugin.keywords ?? []),
  ].filter(Boolean).join(' ').normalize('NFKC').toLowerCase()
}

function scorePlugin(plugin, query) {
  const words = query.normalize('NFKC').toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return 0
  const name = plugin.name.toLowerCase()
  const title = `${plugin.title?.zh ?? ''} ${plugin.title?.en ?? ''}`.toLowerCase()
  const desc = `${plugin.description?.zh ?? ''} ${plugin.description?.en ?? ''}`.toLowerCase()
  const haystack = searchText(plugin)
  let score = 0
  for (const word of words) {
    if (!haystack.includes(word)) return -Infinity
    if (name === word) score += 120
    else if (name.startsWith(word)) score += 80
    else if (name.includes(word)) score += 55
    if (title.includes(word)) score += 30
    if (desc.includes(word)) score += 8
  }
  if (plugin.curated) score += 45
  if (plugin.featured) score += 25
  return score
}

function filterAndSort(plugins, options) {
  const query = String(options.q ?? '').trim()
  const category = String(options.category ?? 'all')
  const sort = String(options.sort ?? 'recommended')
  const onlyInstalled = options.onlyInstalled === true
  let list = plugins
  if (category === 'featured') list = list.filter((plugin) => plugin.curated)
  else if (category !== 'all') list = list.filter((plugin) => plugin.category === category)
  if (onlyInstalled) list = list.filter((plugin) => plugin.installed?.status === 'installed' || plugin.installed?.status === 'disabled')
  if (query) {
    list = list
      .map((plugin) => ({ plugin, score: scorePlugin(plugin, query) }))
      .filter((item) => Number.isFinite(item.score))
      .sort((a, b) => b.score - a.score || (a.plugin.featured ?? 999) - (b.plugin.featured ?? 999))
      .map((item) => item.plugin)
  }
  if (sort === 'latest') {
    list = [...list].sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0))
  } else if (sort === 'name') {
    list = [...list].sort((a, b) => (a.displayTitle ?? a.name).localeCompare(b.displayTitle ?? b.name, 'zh'))
  } else if (sort === 'installed') {
    const rank = (plugin) => ({ installed: 0, disabled: 1, 'not-installed': 2, provided: 3 }[plugin.installed?.status] ?? 2)
    list = [...list].sort((a, b) => rank(a) - rank(b) || (a.featured ?? 999) - (b.featured ?? 999))
  } else if (!query) {
    list = [...list].sort((a, b) => (a.featured ?? 999) - (b.featured ?? 999) || (a.curated === b.curated ? 0 : a.curated ? -1 : 1))
  }
  return list
}

// ── 任务 ──────────────────────────────────────────────────────────────────

function publicJob(job) {
  return {
    id: job.id,
    kind: job.kind,
    name: job.name,
    version: job.version,
    spec: job.spec,
    phase: job.phase,
    startedAt: job.startedAt,
    updatedAt: job.updatedAt,
    logs: job.logs.slice(-160),
    result: job.result,
    error: job.error,
  }
}

function pushLog(job, stream, text) {
  const clean = stripAnsi(text).replace(/\r/g, '')
  for (const line of clean.split('\n')) {
    if (!line.trim()) continue
    job.logs.push({ at: now(), stream, text: line.slice(0, 500) })
  }
  if (job.logs.length > 500) job.logs.splice(0, job.logs.length - 500)
  job.updatedAt = now()
}

function summarizeChange(result) {
  if (!result || typeof result !== 'object') return undefined
  return {
    application: result.application,
    changed: result.changed,
    stage: result.stage,
    target: result.target,
    version: result.version,
    bundle: result.bundle,
    restartReason: result.restartReason,
    error: result.error ? { code: result.error.code, message: result.error.message } : undefined,
    packageResult: result.packageResult
      ? {
          exitCode: result.packageResult.exitCode,
          kind: result.packageResult.kind,
          timedOut: result.packageResult.timedOut,
          output: String(result.packageResult.output ?? '').slice(-4000),
        }
      : undefined,
    pendingBuilds: result.pendingBuilds,
    registries: result.registries,
  }
}

function startJob(kind, meta, run) {
  const id = crypto.randomUUID()
  const job = {
    id,
    kind,
    name: meta.name,
    version: meta.version,
    spec: meta.spec,
    phase: 'running',
    startedAt: now(),
    updatedAt: now(),
    logs: [],
    result: undefined,
    error: undefined,
  }
  state.jobs.set(id, job)
  ;(async () => {
    try {
      const outcome = await run(job)
      job.result = outcome
      const failed = outcome?.install?.application === 'failed' || outcome?.removed?.application === 'failed' || outcome?.failedAtRemove
      job.phase = failed ? 'failed' : 'done'
      if (failed) {
        job.error = outcome?.install?.error?.message ?? outcome?.removed?.error?.message ?? '操作失败'
      }
    } catch (error) {
      job.phase = 'failed'
      job.error = String(error?.message ?? error)
      pushLog(job, 'stderr', job.error)
    } finally {
      job.updatedAt = now()
      // 保留最近 40 个任务，避免长会话里无限增长。
      const ids = [...state.jobs.keys()]
      for (const old of ids.slice(0, Math.max(0, ids.length - 40))) state.jobs.delete(old)
    }
  })()
  return job
}

// ── 插件主体 ──────────────────────────────────────────────────────────────

export default {
  name: SELF,
  inject: ['webServer'],
  apply(ctx) {
    state.ctx = ctx
    const disposers = []

    function rejected(req, res) {
      try {
        const connection = ctx.get('connection')
        if (!connection || typeof connection.requestRejection !== 'function') {
          json(res, 503, fail('trust-unavailable', '信任栅栏不可用，拒绝访问（fail-closed）'))
          return true
        }
        const code = connection.requestRejection(req)
        if (code === undefined || code === null || code === false) return false
        res.statusCode = typeof code === 'number' ? code : 403
        res.end()
        return true
      } catch (error) {
        json(res, 503, fail('trust-error', `信任栅栏异常：${String(error?.message ?? error)}`))
        return true
      }
    }

    function route(kind, pathname, handler) {
      disposers.push(ctx.webServer.register({
        kind,
        path: pathname,
        handler: async (req, res) => {
          if (rejected(req, res)) return
          try {
            await handler(req, res)
          } catch (error) {
            try {
              json(res, 500, fail('internal', String(error?.message ?? error)))
            } catch {}
          }
        },
      }))
    }

    function requireWrite(req, res) {
      if (!isLoopbackHost(req)) {
        json(res, 403, fail('loopback-only', '写操作只接受本机回环访问'))
        return false
      }
      if (req.method !== 'POST') {
        json(res, 405, fail('method', '只接受 POST'))
        return false
      }
      return true
    }

    // 目录与安装状态
    route('exact', '/dsh-whale-market/api/bootstrap', async (req, res) => {
      if (req.method !== 'GET') return json(res, 405, fail('method', '只接受 GET'))
      const catalog = await ensureCatalog(false)
      const installed = await readInstalled()
      const plugins = catalog.plugins.map((plugin) => annotate(plugin, installed.map))
      const counts = {
        curated: plugins.filter((plugin) => plugin.curated).length,
        total: plugins.length,
        installed: plugins.filter((plugin) => plugin.installed.status === 'installed' || plugin.installed.status === 'disabled').length,
        updates: plugins.filter((plugin) => plugin.installed.update).length,
        provided: plugins.filter((plugin) => plugin.installed.status === 'provided').length,
      }
      const config = readConfig()
      let runtime
      try {
        const anchor = ctx.get('profileContext')?.installAnchor
        if (anchor) runtime = JSON.parse(fs.readFileSync(anchor, 'utf8')).version
      } catch {}
      json(res, 200, {
        ok: true,
        app: {
          name: SELF,
          version: PKG.version,
          runtime,
          profile: ctx.get('profileContext')?.name ?? process.env.DSH_PROFILE ?? 'desktop',
          manage: installed.ok,
          managerError: installed.error,
          os: process.platform,
        },
        counts,
        categories: catalog.categories,
        sources: catalog.sources,
        config: { sources: config.sources.map(({ id, title, urls, enabled }) => ({ id, title, urls, enabled })), cacheTtlMs: config.cacheTtlMs },
        fetchedAt: catalog.fetchedAt,
        catalogTitle: catalog.title,
      })
    })

    route('exact', '/dsh-whale-market/api/catalog', async (req, res) => {
      if (req.method !== 'GET') return json(res, 405, fail('method', '只接受 GET'))
      const url = new URL(req.url ?? '/', 'http://127.0.0.1')
      const force = url.searchParams.get('refresh') === '1'
      const catalog = await ensureCatalog(force)
      const installed = await readInstalled()
      const all = catalog.plugins.map((plugin) => annotate(plugin, installed.map))
      const options = {
        q: (url.searchParams.get('q') ?? '').slice(0, 200),
        category: (url.searchParams.get('category') ?? 'all').slice(0, 64),
        sort: ['recommended', 'latest', 'name', 'installed'].includes(url.searchParams.get('sort') ?? '') ? url.searchParams.get('sort') : 'recommended',
        onlyInstalled: url.searchParams.get('installed') === '1',
      }
      const filtered = filterAndSort(all, options)
      const offset = Math.max(0, Number(url.searchParams.get('offset') ?? 0) || 0)
      const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? 60) || 60))
      const page = filtered.slice(offset, offset + limit).map((plugin) => ({
        ...plugin,
        // 卡片不需要完整版本数组，只留数量与迁移所需的 registry。
        versions: undefined,
        versionCount: plugin.versions.length,
      }))
      json(res, 200, {
        ok: true,
        plugins: page,
        total: filtered.length,
        offset,
        limit,
        hasMore: offset + page.length < filtered.length,
        counts: {
          curated: all.filter((plugin) => plugin.curated).length,
          total: all.length,
          installed: all.filter((plugin) => plugin.installed.status === 'installed' || plugin.installed.status === 'disabled').length,
          updates: all.filter((plugin) => plugin.installed.update).length,
        },
        categories: catalog.categories,
        sources: catalog.sources,
        fetchedAt: catalog.fetchedAt,
        installedOk: installed.ok,
        installedError: installed.error,
      })
    })

    route('exact', '/dsh-whale-market/api/entry', async (req, res) => {
      if (req.method !== 'GET') return json(res, 405, fail('method', '只接受 GET'))
      const url = new URL(req.url ?? '/', 'http://127.0.0.1')
      const name = url.searchParams.get('name') ?? ''
      const catalog = await ensureCatalog(false)
      const plugin = catalog.byName.get(name)
      if (!plugin) return json(res, 404, fail('not-found', '目录里没有这个插件'))
      const installed = await readInstalled()
      json(res, 200, { ok: true, plugin: annotate(plugin, installed.map) })
    })

    // 安装 / 更新
    route('exact', '/dsh-whale-market/api/install', async (req, res) => {
      if (!requireWrite(req, res)) return
      const body = JSON.parse((await readBody(req)) || '{}')
      const name = String(body.name ?? '')
      if (name === SELF) return json(res, 400, fail('self', '不能通过自己安装自己'))
      const pm = manager()
      if (!pm) return json(res, 503, fail('no-manager', '当前部署没有 pluginManager'))
      const catalog = await ensureCatalog(false)
      const plugin = catalog.byName.get(name)
      if (!plugin) return json(res, 404, fail('not-found', '目录里没有这个插件'))
      if (plugin.personal && plugin.localPath && !fs.existsSync(plugin.localPath)) {
        return json(res, 400, fail('local-missing', `本地目录不存在：${plugin.localPath}`))
      }
      const version = String(body.version ?? plugin.version)
      const chosen = plugin.versions.find((item) => item.version === version)
      if (!chosen) return json(res, 400, fail('unknown-version', `目录里没有 ${name}@${version}`))
      const installed = await readInstalled()
      const bundle = installed.map.get(name)
      const view = installedView(bundle)
      if (view.status === 'provided') return json(res, 400, fail('provided', '这个插件由 DSH 自带，不需要安装'))
      if (view.status === 'installed' && view.version === version) return json(res, 409, fail('already-installed', `已经安装了 ${name}@${version}`))
      if (view.status !== 'not-installed' && view.removable === false) {
        return json(res, 400, fail('not-removable', `${name} 当前不能由插件管理器移除`))
      }
      const job = startJob('install', { name, version, spec: chosen.spec }, async (current) => {
        let removed
        if (view.status !== 'not-installed') {
          pushLog(current, 'stdout', `先移除旧版本 ${name}${view.version ? `@${view.version}` : ''}…`)
          removed = await pm.removeBundle(name)
          if (removed?.application === 'failed' || removed?.application === 'cancelled') {
            return { removed: summarizeChange(removed), install: undefined, failedAtRemove: true }
          }
        }
        pushLog(current, 'stdout', `安装 ${name}@${version}…`)
        const install = await pm.installBundle(chosen.spec, {
          requestId: current.id,
          saveExact: true,
          ...(plugin.registry ? { registry: plugin.registry } : {}),
        })
        return { removed: summarizeChange(removed), install: summarizeChange(install) }
      })
      json(res, 200, { ok: true, job: publicJob(job) })
    })

    // 卸载
    route('exact', '/dsh-whale-market/api/uninstall', async (req, res) => {
      if (!requireWrite(req, res)) return
      const body = JSON.parse((await readBody(req)) || '{}')
      const name = String(body.name ?? '')
      if (name === SELF) return json(res, 400, fail('self', '不能卸载鲸市自己；请用插件管理器操作'))
      const pm = manager()
      if (!pm) return json(res, 503, fail('no-manager', '当前部署没有 pluginManager'))
      const installed = await readInstalled()
      const view = installedView(installed.map.get(name))
      if (view.status === 'not-installed' || view.status === 'provided') return json(res, 400, fail('not-installed', '这个插件没有安装'))
      const job = startJob('uninstall', { name }, async (current) => {
        pushLog(current, 'stdout', `卸载 ${name}…`)
        const removed = await pm.removeBundle(name)
        return { removed: summarizeChange(removed) }
      })
      json(res, 200, { ok: true, job: publicJob(job) })
    })

    // 启停
    route('exact', '/dsh-whale-market/api/enable', async (req, res) => {
      if (!requireWrite(req, res)) return
      const body = JSON.parse((await readBody(req)) || '{}')
      const name = String(body.name ?? '')
      const enabled = body.enabled !== false
      if (name === SELF && !enabled) return json(res, 400, fail('self', '不能停用鲸市自己'))
      const pm = manager()
      if (!pm) return json(res, 503, fail('no-manager', '当前部署没有 pluginManager'))
      const result = await pm.setBundleEnabled(name, enabled)
      json(res, 200, { ok: true, result: summarizeChange(result) })
    })

    // 任务查询 / 取消
    route('exact', '/dsh-whale-market/api/job', async (req, res) => {
      if (req.method !== 'GET') return json(res, 405, fail('method', '只接受 GET'))
      const url = new URL(req.url ?? '/', 'http://127.0.0.1')
      const job = state.jobs.get(url.searchParams.get('id') ?? '')
      if (!job) return json(res, 404, fail('not-found', '任务不存在或已过期'))
      json(res, 200, { ok: true, job: publicJob(job) })
    })

    route('exact', '/dsh-whale-market/api/job/cancel', async (req, res) => {
      if (!requireWrite(req, res)) return
      const body = JSON.parse((await readBody(req)) || '{}')
      const pm = manager()
      if (!pm || typeof pm.cancelInstall !== 'function') return json(res, 503, fail('no-manager', '当前部署没有 pluginManager'))
      const result = await pm.cancelInstall(String(body.id ?? ''))
      json(res, 200, { ok: true, result })
    })

    // 目录源管理
    route('exact', '/dsh-whale-market/api/sources', async (req, res) => {
      if (!requireWrite(req, res)) return
      const body = JSON.parse((await readBody(req)) || '{}')
      const url = cleanUrl(body.url)
      if (!url) return json(res, 400, fail('invalid-url', '需要一个 http(s) 地址，不能带账号、密码或 # 片段'))
      const config = readConfig()
      if (config.sources.some((source) => source.urls.includes(url))) return json(res, 409, fail('duplicate', '这个地址已经在源列表里'))
      const source = {
        id: `custom-${hashId(url)}`,
        title: cleanText(String(body.title ?? ''), 60) || new URL(url).host,
        urls: [url],
        enabled: true,
      }
      config.sources.push(source)
      writeConfig(config)
      state.sources.delete(source.id)
      state.catalog = null
      json(res, 200, { ok: true, source })
    })

    route('exact', '/dsh-whale-market/api/sources/remove', async (req, res) => {
      if (!requireWrite(req, res)) return
      const body = JSON.parse((await readBody(req)) || '{}')
      const id = String(body.id ?? '')
      const config = readConfig()
      const index = config.sources.findIndex((source) => source.id === id)
      if (index === -1) return json(res, 404, fail('not-found', '没有这个目录源'))
      const [removed] = config.sources.splice(index, 1)
      writeConfig(config)
      state.sources.delete(removed.id)
      state.catalog = null
      json(res, 200, { ok: true })
    })

    route('exact', '/dsh-whale-market/api/sources/toggle', async (req, res) => {
      if (!requireWrite(req, res)) return
      const body = JSON.parse((await readBody(req)) || '{}')
      const id = String(body.id ?? '')
      const config = readConfig()
      const source = config.sources.find((item) => item.id === id)
      if (!source) return json(res, 404, fail('not-found', '没有这个目录源'))
      source.enabled = body.enabled !== false
      writeConfig(config)
      state.sources.delete(source.id)
      state.catalog = null
      json(res, 200, { ok: true, source })
    })

    route('exact', '/dsh-whale-market/api/refresh', async (req, res) => {
      if (!requireWrite(req, res)) return
      state.sources.clear()
      state.catalog = null
      const catalog = await ensureCatalog(true)
      const installed = await readInstalled()
      json(res, 200, {
        ok: true,
        total: catalog.plugins.length,
        curated: catalog.plugins.filter((plugin) => plugin.curated).length,
        sources: catalog.sources,
        installedOk: installed.ok,
      })
    })

    // 事件：把 pnpm 的实时输出挂到任务上（拿不到事件时任务照样能完成，只是没有日志流）。
    try {
      const bus = ctx.root ?? ctx
      const offLog = bus.on?.('plugin-manager/install-log', (event) => {
        const job = state.jobs.get(event?.requestId)
        if (!job) return
        if (event?.text) pushLog(job, event.stream ?? 'stdout', event.text)
      })
      const offState = bus.on?.('plugin-manager/install-state', (event) => {
        const job = state.jobs.get(event?.requestId)
        if (!job) return
        if (event?.phase === 'applying') job.phase = 'applying'
        else if (event?.phase === 'installing') job.phase = 'installing'
        else if (event?.phase === 'cancelling') job.phase = 'cancelling'
        job.updatedAt = now()
      })
      if (typeof offLog === 'function') disposers.push(offLog)
      if (typeof offState === 'function') disposers.push(offState)
    } catch (error) {
      console.warn('[whale-market] 订阅安装日志失败：', error?.message ?? error)
    }

    ctx.effect(() => () => {
      for (const dispose of disposers) {
        try { dispose() } catch {}
      }
      state.catalog = null
      state.loading = null
    })

    try {
      console.log(`[whale-market] 鲸市已挂载 · 精选 ${curatedData().plugins.length} 个 · 配置 ${CONFIG_FILE}`)
    } catch {}
  },
}
