/**
 * 校验 site/index.json 是否仍然是合法的 format 1 目录，并检查每个版本能生成安装 spec。
 *   node scripts/validate-index.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const FILE = path.join(HERE, '..', 'site', 'index.json')
const MAX_BYTES = 20 * 1024 * 1024
const SOURCE_TYPES = new Set(['npm', 'git', 'link', 'tarball'])

function specOf(name, version) {
  const source = version.source || { type: 'npm' }
  if (!SOURCE_TYPES.has(source.type)) return undefined
  if (source.type === 'npm') return `${name}@${version.version}`
  if (source.type === 'link') return source.path ? `link:${source.path}` : undefined
  if (source.type === 'tarball') return source.url || undefined
  if (source.type === 'git') {
    let url = String(source.url || '')
    if (url.startsWith('git+')) url = url.slice(4)
    if (!/^https?:\/\//.test(url)) return undefined
    const commit = /^[0-9a-f]{7,64}$/i.test(source.commit || '') ? `#${source.commit}` : ''
    const sub = source.path ? `&path:/${String(source.path).replace(/^\/+/, '')}` : ''
    return `git+${url}${commit}${sub}`
  }
  return undefined
}

const size = fs.statSync(FILE).size
if (size > MAX_BYTES) throw new Error(`index too large: ${size}`)
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'))
if (data.format !== 1) throw new Error('format must be 1')
if (!Array.isArray(data.plugins)) throw new Error('plugins must be an array')

const seen = new Set()
let versions = 0
for (const plugin of data.plugins) {
  if (!plugin || typeof plugin.name !== 'string' || !plugin.name) throw new Error('missing plugin name')
  if (seen.has(plugin.name)) throw new Error(`duplicate plugin: ${plugin.name}`)
  seen.add(plugin.name)
  if (!Array.isArray(plugin.versions) || plugin.versions.length === 0) throw new Error(`no versions: ${plugin.name}`)
  for (const version of plugin.versions) {
    versions += 1
    if (!version || typeof version.version !== 'string' || !version.version) throw new Error(`bad version: ${plugin.name}`)
    if (!specOf(plugin.name, version)) throw new Error(`bad source/spec: ${plugin.name}@${version.version}`)
  }
}

if (data.market?.total !== data.plugins.length) {
  throw new Error(`market.total ${data.market?.total} !== plugins.length ${data.plugins.length}`)
}

console.log(`ok: ${data.plugins.length} plugins, ${versions} versions, ${(size / 1024 / 1024).toFixed(2)} MB, generated ${data.market?.generatedAt}`)
