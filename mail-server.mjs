import { createServer } from 'node:http'
import { handleMail } from './mail.mjs'

const port = Number(process.env.DB_PORT) || 3001

createServer(async (req, res) => {
  if (await handleMail(req, res)) return
  res.writeHead(404).end()
}).listen(port, '127.0.0.1', () => {
  console.log(`Kwality mail on http://127.0.0.1:${port}`)
})
