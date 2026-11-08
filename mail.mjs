import { existsSync, readFileSync } from 'node:fs'
import nodemailer from 'nodemailer'

const TO = 'kwalityroti@gmail.com'
const codes = new Map()

function smtpPass() {
  if (process.env.SMTP_PASS) return String(process.env.SMTP_PASS).trim()
  const file = new URL('./mail.secret', import.meta.url)
  if (existsSync(file)) return readFileSync(file, 'utf8').replace(/\s+/g, '')
  return ''
}

function send(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'Content-Type',
  })
  res.end(payload)
}

async function readJson(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return JSON.parse(Buffer.concat(chunks).toString() || '{}')
}

export async function handleMail(req, res) {
  const path = (req.url || '').split('?')[0]
  if (path !== '/api/otp/send' && path !== '/api/otp/check') return false
  if (req.method === 'OPTIONS') {
    send(res, 204, {})
    return true
  }
  if (req.method !== 'POST') {
    send(res, 405, { ok: false, error: 'Use POST.' })
    return true
  }
  try {
    const body = await readJson(req)
    const username = String(body.username || '').trim().toLowerCase()
    if (!username) {
      send(res, 400, { ok: false, error: 'Enter the login id.' })
      return true
    }
    if (path === '/api/otp/check') {
      const row = codes.get(username)
      const otp = String(body.otp || '').trim()
      if (!row || Date.now() > row.expires || otp !== row.otp) {
        send(res, 400, { ok: false, error: 'That code is wrong or expired.' })
        return true
      }
      codes.delete(username)
      send(res, 200, { ok: true })
      return true
    }
    const pass = smtpPass()
    if (!pass) {
      send(res, 503, { ok: false, error: 'Mail is not ready. Add the Gmail app password to mail.secret.' })
      return true
    }
    const otp = String(Math.floor(100000 + Math.random() * 900000))
    const transport = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: { user: TO, pass },
    })
    await transport.sendMail({
      from: `Kwality Foods <${TO}>`,
      to: TO,
      subject: 'Kwality Foods password code',
      text: `Your password code is ${otp}. It expires in 10 minutes.`,
    })
    codes.set(username, { otp, expires: Date.now() + 10 * 60 * 1000 })
    send(res, 200, { ok: true })
  } catch (error) {
    send(res, 500, { ok: false, error: 'Could not send the email. Check the Gmail app password.' })
  }
  return true
}
