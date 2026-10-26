import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve('dsh-whale-market')
const curated = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'curated.json'), 'utf8'))
const FALLBACK = {
  personal: '我的', market: '市场与管理', memory: '记忆', session: '会话', ui: '界面', tools: '工具', fun: '娱乐',
  dev: '开发', model: '模型', notify: '通知', remote: '远程', theme: '主题', usage: '用量', browser: '浏览',
  vision: '视觉', voice: '语音', git: 'Git', workflow: '工作流', skill: '技能', docs: '文档', security: '安全',
  wsl: 'WSL', identity: '身份', agi: 'AGI',
}

function spec(name, version) {
  const source = version.source || { type: 'npm' }
  if (source.type === 'link') return `link:${source.path}`
  if (source.type === 'git') return `git+${source.url}`
  return `${name}@${version.version}`
}

function displayTitle(plugin) {
  const raw = typeof plugin.title === 'string' ? plugin.title : (plugin.title?.zh || plugin.title?.en || '')
  if (!raw) return plugin.name
  if (/^[^\s/]+\/[^\s/]+(?:#.*)?$/.test(raw) || /^@[^\s/]+\/[^\s/]+$/.test(raw)) {
    return plugin.name.startsWith('@') ? plugin.name.split('/')[1] : plugin.name
  }
  return raw
}

const installedMap = {
  'dsh-bili-whale': { status: 'installed', version: '0.3.0', enabled: true, removable: true, update: false },
  'coopanion-connector-dsh': { status: 'installed', version: '0.1.0', enabled: true, removable: true, update: false },
  dshmarket: { status: 'installed', version: '1.70.1', enabled: true, removable: true, update: true },
  'dsh-updater-npm': { status: 'disabled', version: '1.13.4', enabled: false, removable: true, update: false },
}

const plugins = curated.plugins.map((plugin) => {
  const versions = plugin.versions.map((version) => ({
    ...version,
    spec: spec(plugin.name, version),
  }))
  const first = versions[0]
  return {
    ...plugin,
    displayTitle: displayTitle(plugin),
    version: first.version,
    publishedAt: first.publishedAt,
    spec: first.spec,
    versions,
    installed: installedMap[plugin.name] || { status: 'not-installed', enabled: false, removable: false, update: false },
    source: plugin.personal ? { id: 'curated', title: '鲸市精选' } : { id: 'public', title: '公共插件目录' },
  }
})

const counts = {}
for (const plugin of plugins) counts[plugin.category] = (counts[plugin.category] || 0) + 1
const categories = Object.entries(counts).map(([id, count]) => ({
  id,
  title: { zh: FALLBACK[id] || id, en: id },
  count,
  order: id === 'personal' ? -1 : 0,
}))
categories.sort((a, b) => a.order - b.order || a.title.zh.localeCompare(b.title.zh, 'zh'))

const boot = {
  ok: true,
  app: { name: 'dsh-whale-market', version: '0.1.0', runtime: '0.2.1-rc.3', profile: 'desktop', manage: true, os: 'win32' },
  counts: { curated: plugins.length, total: 3572, installed: 4, updates: 1, provided: 0 },
  categories,
  sources: [{ id: 'public', title: '公共插件目录', url: 'https://cdn.jsdelivr.net/npm/dsh-plugin-catalog/index.json', enabled: true, ok: true, count: 3540, fetchedAt: Date.now() - 18 * 60 * 1000 }],
  config: { sources: [], cacheTtlMs: 21600000 },
  fetchedAt: Date.now() - 18 * 60 * 1000,
  catalogTitle: curated.title,
}

const page = {
  ok: true,
  plugins,
  total: 3572,
  offset: 0,
  limit: 60,
  hasMore: true,
  counts: boot.counts,
  categories,
  sources: boot.sources,
  fetchedAt: boot.fetchedAt,
  installedOk: true,
}

const data = { boot, page, entry: Object.fromEntries(plugins.map((plugin) => [plugin.name, plugin])) }
fs.mkdirSync(path.join(ROOT, 'test', 'preview'), { recursive: true })
fs.writeFileSync(path.join(ROOT, 'test', 'preview', 'mock-data.js'), `window.__WM_MOCK__ = ${JSON.stringify(data, null, 2)};\n`)
console.log('wrote mock-data.js', plugins.length, 'plugins')
