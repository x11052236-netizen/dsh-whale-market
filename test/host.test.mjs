import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import test from 'node:test'

const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'whale-market-test-'))
process.env.DSH_WHALE_MARKET_HOME = HOME
fs.writeFileSync(path.join(HOME, 'whale-market.json'), JSON.stringify({
  sources: [{ id: 'public', title: '公共插件目录', urls: ['https://example.invalid/index.json'], enabled: false }],
}, null, 2))
fs.writeFileSync(path.join(HOME, 'installation.json'), JSON.stringify({ version: '0.2.1-rc.3' }))

const { default: plugin } = await import('../lib/index.js')

const calls = { install: [], remove: [], enable: [] }
const bundles = [
  { name: 'dsh-bili-whale', version: '0.3.0', installed: true, enabled: true, removable: true, availability: 'profile', official: false },
]
const manager = {
  async listBundles() { return bundles },
  async installBundle(spec, options) {
    calls.install.push({ spec, options })
    return { application: 'applied', changed: true, version: '1.70.2', bundle: 'dshmarket', stage: 'enable', target: 'dshmarket' }
  },
  async removeBundle(name) {
    calls.remove.push(name)
    return { application: 'applied', changed: true }
  },
  async setBundleEnabled(name, enabled) {
    calls.enable.push({ name, enabled })
    return { application: 'applied', changed: true }
  },
  async cancelInstall() { return { status: 'cancelled' } },
}

const routes = new Map()
const ctx = {
  webServer: {
    register({ path: routePath, handler }) {
      routes.set(routePath, handler)
      return () => routes.delete(routePath)
    },
  },
  get(name) {
    if (name === 'connection') return { requestRejection: () => false }
    if (name === 'pluginManager') return manager
    if (name === 'profileContext') return { name: 'desktop', installAnchor: path.join(HOME, 'installation.json') }
    return undefined
  },
  effect(factory) { factory() },
  root: { on: () => () => {} },
  logger: console,
}
plugin.apply(ctx)

function request(method, url, body) {
  const req = new EventEmitter()
  req.method = method
  req.url = url
  req.headers = { host: '127.0.0.1:56553', 'content-type': 'application/json' }
  if (body !== undefined) {
    req.on('data', () => {})
    setImmediate(() => {
      req.emit('data', Buffer.from(JSON.stringify(body)))
      req.emit('end')
    })
  } else {
    setImmediate(() => req.emit('end'))
  }
  return req
}

function response() {
  const res = {
    statusCode: 200,
    headers: undefined,
    body: undefined,
    writeHead(status, headers) { this.statusCode = status; this.headers = headers },
    end(text) { this.body = text ?? ''; this.ended = true },
  }
  return res
}

async function call(method, url, body) {
  const req = request(method, url, body)
  const res = response()
  const handler = routes.get(url.split('?')[0])
  assert.ok(handler, `route ${url} registered`)
  await handler(req, res)
  const parsed = res.body ? JSON.parse(res.body) : undefined
  return { status: res.statusCode, body: parsed }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

test('bootstrap returns curated entries and install status', async () => {
  const { status, body } = await call('GET', '/dsh-whale-market/api/bootstrap')
  assert.equal(status, 200)
  assert.equal(body.ok, true)
  assert.equal(body.counts.curated, 32)
  assert.equal(body.app.manage, true)
  assert.equal(body.app.runtime, '0.2.1-rc.3')
  assert.equal(body.counts.installed, 1)
  assert.ok(body.categories.some((category) => category.id === 'personal'))
})

test('catalog pages, searches, and annotates installed state', async () => {
  const first = await call('GET', '/dsh-whale-market/api/catalog?limit=10')
  assert.equal(first.status, 200)
  assert.equal(first.body.plugins.length, 10)
  assert.ok(first.body.total >= 32)
  assert.equal(first.body.hasMore, true)

  const whale = await call('GET', '/dsh-whale-market/api/catalog?q=bili-whale')
  assert.equal(whale.body.total, 1)
  assert.equal(whale.body.plugins[0].name, 'dsh-bili-whale')
  assert.equal(whale.body.plugins[0].installed.status, 'installed')

  const chinese = await call('GET', `/dsh-whale-market/api/catalog?q=${encodeURIComponent('记忆')}`)
  assert.ok(chinese.body.total > 0)
  assert.ok(chinese.body.plugins.every((entry) => /记忆|memory/i.test(JSON.stringify(entry))))
})

test('entry returns the full record', async () => {
  const { status, body } = await call('GET', '/dsh-whale-market/api/entry?name=dshmarket')
  assert.equal(status, 200)
  assert.equal(body.plugin.name, 'dshmarket')
  assert.equal(body.plugin.version, '1.70.2')
  assert.equal(body.plugin.spec, 'dshmarket@1.70.2')
})

test('install rejects unknown names and self-install', async () => {
  const unknown = await call('POST', '/dsh-whale-market/api/install', { name: 'not-a-real-plugin' })
  assert.equal(unknown.status, 404)
  const self = await call('POST', '/dsh-whale-market/api/install', { name: 'dsh-whale-market' })
  assert.equal(self.status, 400)
})

test('install runs through pluginManager and completes', async () => {
  const { status, body } = await call('POST', '/dsh-whale-market/api/install', { name: 'dshmarket' })
  assert.equal(status, 200)
  assert.equal(body.ok, true)
  assert.ok(body.job.id)
  assert.equal(calls.install.length, 1)
  assert.equal(calls.install[0].spec, 'dshmarket@1.70.2')
  assert.equal(calls.install[0].options.saveExact, true)

  for (let i = 0; i < 30; i += 1) {
    const job = await call('GET', `/dsh-whale-market/api/job?id=${body.job.id}`)
    if (job.body.job.phase === 'done') {
      assert.equal(job.body.job.result.install.application, 'applied')
      return
    }
    assert.notEqual(job.body.job.phase, 'failed')
    await sleep(10)
  }
  assert.fail('install job did not finish')
})

test('update removes the old bundle before installing the new version', async () => {
  bundles.push({ name: 'dshmarket', version: '1.70.1', installed: true, enabled: true, removable: true, availability: 'profile', official: false })
  const before = calls.remove.length
  const { status, body } = await call('POST', '/dsh-whale-market/api/install', { name: 'dshmarket' })
  assert.equal(status, 200)
  for (let i = 0; i < 30; i += 1) {
    const job = await call('GET', `/dsh-whale-market/api/job?id=${body.job.id}`)
    if (job.body.job.phase === 'done') break
    assert.notEqual(job.body.job.phase, 'failed')
    await sleep(10)
  }
  assert.equal(calls.remove.length, before + 1)
  assert.ok(calls.remove.includes('dshmarket'))
})

test('uninstall and enable guard the plugin itself', async () => {
  const denied = await call('POST', '/dsh-whale-market/api/uninstall', { name: 'dsh-whale-market' })
  assert.equal(denied.status, 400)
  const deniedDisable = await call('POST', '/dsh-whale-market/api/enable', { name: 'dsh-whale-market', enabled: false })
  assert.equal(deniedDisable.status, 400)
})

test('source validation rejects bad urls and duplicates', async () => {
  const bad = await call('POST', '/dsh-whale-market/api/sources', { url: 'file:///etc/passwd' })
  assert.equal(bad.status, 400)
  const good = await call('POST', '/dsh-whale-market/api/sources', { url: 'https://example.com/index.json', title: 'Example' })
  assert.equal(good.status, 200)
  const duplicate = await call('POST', '/dsh-whale-market/api/sources', { url: 'https://example.com/index.json' })
  assert.equal(duplicate.status, 409)
})

test('writes require loopback Host', async () => {
  const req = request('POST', '/dsh-whale-market/api/install', { name: 'dshmarket' })
  req.headers.host = '10.0.0.2:56553'
  const res = response()
  await routes.get('/dsh-whale-market/api/install')(req, res)
  assert.equal(res.statusCode, 403)
})

test('trust fence rejection stops the request', async () => {
  const original = ctx.get
  ctx.get = (name) => name === 'connection' ? { requestRejection: () => 403 } : original(name)
  const res = response()
  await routes.get('/dsh-whale-market/api/bootstrap')(request('GET', '/dsh-whale-market/api/bootstrap'), res)
  ctx.get = original
  assert.equal(res.statusCode, 403)
  assert.equal(res.body, '')
})
