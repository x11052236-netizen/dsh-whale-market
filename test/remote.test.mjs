import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import test from 'node:test'

const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'whale-market-remote-'))
process.env.DSH_WHALE_MARKET_HOME = HOME
fs.writeFileSync(path.join(HOME, 'installation.json'), JSON.stringify({ version: '0.2.1-rc.3' }))

const index = {
  format: 1,
  title: { zh: '测试目录', en: 'Test index' },
  description: { zh: '用于测试', en: 'For tests' },
  metadata: {
    categories: { demo: { title: { zh: '演示', en: 'Demo' } } },
    labels: {},
    sortKeys: {},
  },
  plugins: [
    {
      name: 'demo-whale',
      title: { zh: '演示鲸', en: 'Demo whale' },
      description: { zh: '一个用于测试的插件', en: 'A test plugin' },
      homepage: 'https://example.com/demo-whale',
      repository: { url: 'https://github.com/example/demo-whale' },
      metadata: { category: 'demo', keywords: ['whale'], labels: [] },
      versions: [{ version: '1.2.3', publishTimestamp: 1700000000, source: { type: 'npm' }, engines: { dsh: '>=0.2.0' } }],
    },
    {
      name: 'demo-git',
      title: 'example/demo-git',
      description: 'A git-installed plugin',
      metadata: { category: 'demo', keywords: [], labels: [] },
      versions: [{ version: '0.1.0', source: { type: 'git', url: 'https://github.com/example/demo-git.git', commit: 'abcdef1234567' } }],
    },
  ],
}

let mode = 'ok'
const server = http.createServer((req, res) => {
  if (mode === 'bad') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end('{not json')
    return
  }
  res.writeHead(200, { 'content-type': 'application/json', etag: '"v1"' })
  res.end(JSON.stringify(index))
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${server.address().port}/index.json`
fs.writeFileSync(path.join(HOME, 'whale-market.json'), JSON.stringify({
  sources: [{ id: 'test', title: '测试目录', urls: [base], enabled: true }],
}, null, 2))

const { default: plugin } = await import(`../lib/index.js?remote=${Date.now()}`)

const calls = []
const manager = {
  async listBundles() { return [] },
  async installBundle(spec, options) { calls.push({ spec, options }); return { application: 'applied', changed: true, version: '1.2.3' } },
  async removeBundle() { return { application: 'applied' } },
  async setBundleEnabled() { return { application: 'applied' } },
  async cancelInstall() { return { status: 'cancelled' } },
}
const routes = new Map()
const ctx = {
  webServer: { register({ path: p, handler }) { routes.set(p, handler); return () => {} } },
  get(name) {
    if (name === 'connection') return { requestRejection: () => false }
    if (name === 'pluginManager') return manager
    if (name === 'profileContext') return { name: 'desktop', installAnchor: path.join(HOME, 'installation.json') }
    return undefined
  },
  effect(factory) { factory() },
  root: { on: () => () => {} },
}
plugin.apply(ctx)

function req(url) {
  const request = new EventEmitter()
  request.method = 'GET'
  request.url = url
  request.headers = { host: '127.0.0.1:56553' }
  setImmediate(() => request.emit('end'))
  return request
}
async function get(url) {
  const res = { statusCode: 200, writeHead(status) { this.statusCode = status }, end(text) { this.body = text } }
  await routes.get(url.split('?')[0])(req(url), res)
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : undefined }
}

test('fetches a format 1 index and merges it with curated entries', async () => {
  const boot = await get('/dsh-whale-market/api/bootstrap')
  assert.equal(boot.status, 200)
  assert.equal(boot.body.sources.length, 1)
  assert.equal(boot.body.sources[0].ok, true)
  assert.equal(boot.body.sources[0].count, 2)
  assert.equal(boot.body.counts.total, 34)

  const search = await get('/dsh-whale-market/api/catalog?q=demo')
  assert.equal(search.body.total, 2)
  const whale = search.body.plugins.find((plugin) => plugin.name === 'demo-whale')
  assert.ok(whale)
  assert.equal(whale.displayTitle, '演示鲸')
  assert.equal(whale.spec, 'demo-whale@1.2.3')
  assert.equal(whale.installed.status, 'not-installed')
  const git = search.body.plugins.find((plugin) => plugin.name === 'demo-git')
  assert.equal(git.spec, 'git+https://github.com/example/demo-git.git#abcdef1234567')
})

test('installs a remote catalog entry by exact version', async () => {
  const res = await get('/dsh-whale-market/api/entry?name=demo-whale')
  assert.equal(res.status, 200)
  assert.equal(res.body.plugin.version, '1.2.3')

  const installReq = new EventEmitter()
  installReq.method = 'POST'
  installReq.url = '/dsh-whale-market/api/install'
  installReq.headers = { host: '127.0.0.1:56553', 'content-type': 'application/json' }
  setImmediate(() => {
    installReq.emit('data', Buffer.from(JSON.stringify({ name: 'demo-whale' })))
    installReq.emit('end')
  })
  const installRes = { statusCode: 200, writeHead(status) { this.statusCode = status }, end(text) { this.body = text } }
  await routes.get('/dsh-whale-market/api/install')(installReq, installRes)
  assert.equal(installRes.statusCode, 200)
  assert.equal(calls[0].spec, 'demo-whale@1.2.3')
})

test('a broken source keeps the curated list and reports the error', async () => {
  mode = 'bad'
  fs.writeFileSync(path.join(HOME, 'whale-market.json'), JSON.stringify({
    sources: [{ id: 'test', title: '测试目录', urls: [base], enabled: true }],
    cacheTtlMs: 5 * 60 * 1000,
  }, null, 2))
  // 清掉缓存，强制重新拉取坏数据。
  fs.rmSync(path.join(HOME, 'whale-market', 'cache'), { recursive: true, force: true })
  const res = await get('/dsh-whale-market/api/catalog?refresh=1')
  assert.equal(res.status, 200)
  assert.ok(res.body.total >= 32)
  assert.equal(res.body.sources[0].ok, false)
  assert.match(res.body.sources[0].error, /JSON|Unexpected|format/i)
  server.close()
})
