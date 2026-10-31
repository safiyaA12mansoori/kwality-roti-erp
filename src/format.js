export function todayISO() {
  return toISO(new Date())
}

export function shiftISO(days) {
  return addDaysISO(todayISO(), days)
}

export function addDaysISO(iso, days) {
  const [year, month, day] = String(iso || todayISO()).split('-').map(Number)
  const date = new Date(year, (month || 1) - 1, day || 1)
  date.setDate(date.getDate() + Number(days || 0))
  return toISO(date)
}

function toISO(date) {
  const z = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${z(date.getMonth() + 1)}-${z(date.getDate())}`
}

export function weekBounds(iso) {
  const [year, month, day] = String(iso || todayISO()).split('-').map(Number)
  const date = new Date(year, (month || 1) - 1, day || 1)
  const weekday = date.getDay()
  const toMonday = weekday === 0 ? -6 : 1 - weekday
  const from = addDaysISO(iso, toMonday)
  return { from, to: addDaysISO(from, 6) }
}

export function lastDaysBounds(iso, days) {
  const count = Math.max(1, Number(days) || 1)
  return { from: addDaysISO(iso, -(count - 1)), to: iso }
}

export function inr(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(value) || 0)
}

export function num(value) {
  return new Intl.NumberFormat('en-IN').format(Number(value) || 0)
}

export function compactInr(value) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(Number(value) || 0))
}

export function isoDiffDays(from, to) {
  const start = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T00:00:00`)
  return Math.max(0, Math.round((end - start) / 86400000))
}

export function previousBounds(from, to) {
  const days = isoDiffDays(from, to) + 1
  const prevTo = addDaysISO(from, -1)
  return { from: addDaysISO(prevTo, -(days - 1)), to: prevTo }
}

export function shiftMonth(month, delta) {
  const [year, mon] = String(month || thisMonth()).split('-').map(Number)
  const date = new Date(year, (mon || 1) - 1 + Number(delta || 0), 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function shortMonth(month) {
  const [year, mon] = String(month || thisMonth()).split('-').map(Number)
  return new Date(year, (mon || 1) - 1, 1).toLocaleDateString('en-IN', { month: 'short' })
}

export function pctChange(now, prev) {
  const current = Number(now) || 0
  const before = Number(prev) || 0
  if (before === 0) return { pct: current === 0 ? 0 : 100, up: current >= 0 }
  const pct = ((current - before) / Math.abs(before)) * 100
  return { pct, up: pct >= 0 }
}

export function thisMonth() {
  return todayISO().slice(0, 7)
}

export function monthBounds(month) {
  const [year, mon] = String(month || '').split('-').map(Number)
  if (!year || !mon) {
    const today = todayISO()
    return { from: today, to: today }
  }
  const last = new Date(year, mon, 0).getDate()
  const z = (n) => String(n).padStart(2, '0')
  return {
    from: `${year}-${z(mon)}-01`,
    to: `${year}-${z(mon)}-${z(last)}`,
  }
}

export function prettyMonth(month) {
  const { from } = monthBounds(month)
  const [year, mon] = from.split('-').map(Number)
  return new Date(year, mon - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

const UNIT_PLURAL = {
  kg: 'kg',
  liter: 'liter',
  cylinder: 'cylinders',
  unit: 'units',
  packet: 'packets',
  trip: 'trips',
  piece: 'pieces',
}

export function qtyWithUnit(qty, unit) {
  const amount = Number(qty) || 0
  const label = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(amount)
  if (!unit) return label
  const name = amount === 1 ? unit : (UNIT_PLURAL[unit] || unit)
  return `${label} ${name}`
}

export function prettyDate(iso) {
  if (!iso) return ''
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function clock(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}

export function methodLabel(method) {
  if (method === 'upi') return 'UPI'
  if (method === 'bank') return 'Bank'
  return 'Cash'
}

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]))
}
