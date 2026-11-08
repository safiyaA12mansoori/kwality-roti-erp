import { createServer } from 'node:http'
import { loadState, saveState } from './db.mjs'
import { handleMail } from './mail.mjs'

const port = Number(process.env.DB_PORT) || 3001

function send(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, PUT, OPTIONS',
    'access-control-allow-headers': 'Content-Type',
  })
  res.end(payload)
}

createServer(async (req, res) => {
  if (await handleMail(req, res)) return
  if (req.method === 'OPTIONS') {
    send(res, 204, {})
    return
  }
  const path = (req.url || '').split('?')[0]
  if (path !== '/api/books') {
    send(res, 404, { ok: false })
    return
  }
  try {
    if (req.method === 'GET') {
      send(res, 200, await loadState())
      return
    }
    if (req.method === 'PUT') {
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      const state = JSON.parse(Buffer.concat(chunks).toString() || '{}')
      await saveState(state)
      send(res, 200, { ok: true })
      return
    }
    send(res, 405, { ok: false })
  } catch (error) {
    send(res, 500, { ok: false, error: error.message })
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Kwality database API on http://127.0.0.1:${port}`)
})
