/**
 * 本地预览在线市场：
 *   node scripts/serve-site.mjs [port]
 * 然后打开 http://127.0.0.1:4173/
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(HERE, '..', 'site')
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 4173)
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`)
  let pathname = decodeURIComponent(url.pathname)
  if (pathname === '/') pathname = '/index.html'
  const file = path.join(ROOT, pathname)
  const relative = path.relative(ROOT, file)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    res.writeHead(403)
    res.end('forbidden')
    return
  }
  fs.readFile(file, (error, data) => {
    if (error) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      res.end('not found')
      return
    }
    res.writeHead(200, {
      'content-type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
      'cache-control': 'no-cache',
    })
    res.end(data)
  })
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`鲸市在线市场预览：http://127.0.0.1:${PORT}/`)
  console.log('Ctrl+C 停止')
})
