import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleMail } from './mail.mjs'

const dist = resolve(fileURLToPath(new URL('./dist', import.meta.url)))
const port = Number(process.env.PORT) || 5173

const types = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function insideDist(file) {
  const resolved = resolve(file)
  return resolved === dist || resolved.startsWith(dist + sep)
}

async function send(res, file, status = 200) {
  const info = await stat(file)
  res.writeHead(status, {
    'content-type': types[extname(file).toLowerCase()] || 'application/octet-stream',
    'content-length': info.size,
    'cache-control': extname(file) === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
  })
  createReadStream(file).pipe(res)
}

createServer(async (req, res) => {
  try {
    if (await handleMail(req, res)) return
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0])
    const requested = normalize(join(dist, urlPath === '/' ? 'index.html' : urlPath))
    if (!insideDist(requested)) {
      res.writeHead(403).end('Forbidden')
      return
    }
    try {
      const info = await stat(requested)
      if (info.isFile()) {
        await send(res, requested)
        return
      }
    } catch {
      /* fall through to SPA index */
    }
    await send(res, join(dist, 'index.html'))
  } catch {
    res.writeHead(500).end('Server error')
  }
}).listen(port, '0.0.0.0', () => {
  console.log(`Kwality ERP live on http://0.0.0.0:${port}`)
})
