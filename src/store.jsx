import { createContext, useContext, useEffect, useRef, useState } from 'react'
import {
  allocatePayment,
  cleanLines,
  moneyInput,
  orderPaid,
  round,
  sum,
  whole,
  workerPrice,
} from './calc'
import { costItem } from './costs'
import { shiftISO, todayISO } from './format'
import { emptyPersonal } from './personal'

const KEY = 'roti-erp-v2'
const OLD_KEY = 'roti-erp-v1'
const SESSION_KEY = 'roti-erp-session'

export const defaultSettings = {
  name: 'Kwality Foods',
  tagline: 'Homemade Chapatis',
  phone: '9810012345',
  address: 'Shop 12, Grain Market, New Delhi',
  nextBill: 1044,
  nextChallan: 230,
  hint: true,
}

function uid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function hashPass(text) {
  let hash = 2166136261
  const value = String(text || '')
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `h${(hash >>> 0).toString(16)}`
}

function userRole(role) {
  if (role === 'admin') return 'admin'
  if (role === 'owner') return 'owner'
  return 'worker'
}

export function defaultUsers() {
  return [
    { id: 'u-admin', username: 'admin', password: hashPass('admin123'), role: 'admin', name: 'Admin' },
    { id: 'u-staff', username: 'staff', password: hashPass('staff123'), role: 'worker', name: 'Staff' },
    { id: 'u-owner', username: 'owner', password: hashPass('owner123'), role: 'owner', name: 'Owner' },
  ]
}

function cleanUsers(list) {
  const users = (list || [])
    .map((user) => ({
      id: user.id || uid(),
      username: String(user.username || '').trim().toLowerCase(),
      password: user.password || hashPass('staff123'),
      role: userRole(user.role),
      name: String(user.name || user.username || 'User').trim(),
    }))
    .filter((user) => user.username)
  if (!users.some((user) => user.role === 'admin')) {
    return defaultUsers()
  }
  if (!users.some((user) => user.role === 'owner')) {
    users.push({ id: 'u-owner', username: 'owner', password: hashPass('owner123'), role: 'owner', name: 'Owner' })
  }
  return users
}

function cleanPersonal(raw) {
  const books = raw || emptyPersonal()
  return {
    incomes: Array.isArray(books.incomes) ? books.incomes : [],
    expenses: Array.isArray(books.expenses) ? books.expenses : [],
    nextBill: Math.max(1, Number(books.nextBill) || 1),
  }
}

export function normalize(raw) {
  return {
    settings: { ...defaultSettings, ...(raw?.settings || {}) },
    products: raw?.products || [],
    workers: raw?.workers || [],
    hotels: raw?.hotels || [],
    production: raw?.production || [],
    orders: raw?.orders || [],
    payments: raw?.payments || [],
    sales: raw?.sales || [],
    expenses: raw?.expenses || [],
    attendance: raw?.attendance || [],
    advances: raw?.advances || [],
    advanceCuts: raw?.advanceCuts || [],
    users: cleanUsers(raw?.users),
    personal: cleanPersonal(raw?.personal),
  }
}

function seed() {
  const today = todayISO()
  const yesterday = shiftISO(-1)
  const older = shiftISO(-3)
  const products = [
    { id: 'p-chapati', name: 'Chapati', workerRate: 1.5, hotelRate: 7, retailRate: 10, active: true },
  ]
  const workers = [
    ['w1', 'Ramesh Yadav', '9811001101'],
    ['w2', 'Suresh Pal', '9811001102'],
    ['w3', 'Imran Khan', '9811001103'],
    ['w4', 'Lakshmi Devi', '9811001104'],
    ['w5', 'Anita Kumari', '9811001105'],
    ['w6', 'Prakash Singh', '9811001106'],
    ['w7', 'Geeta Sharma', '9811001107'],
    ['w8', 'Mohan Lal', '9811001108'],
    ['w9', 'Farida Begum', '9811001109'],
    ['w10', 'Vijay Kumar', '9811001110'],
    ['w11', 'Sunita Devi', '9811001111'],
    ['w12', 'Kiran Bai', '9811001112'],
  ].map(([id, name, phone], index) => ({
    id,
    name,
    phone,
    active: true,
    rate: index === 2 ? 1.8 : index === 4 ? 1.4 : 1.5,
  }))

  const hotels = [
    ['h1', 'Hotel Grand Plaza', 'Vikram Shah', '9812002201', 'Nehru Place', {}],
    ['h2', 'Sai Residency', 'Anita Deshmukh', '9812002202', 'Karol Bagh', {}],
    ['h3', 'City Inn', 'Rohit Malhotra', '9812002203', 'Paharganj', { 'p-chapati': 6.5 }],
    ['h4', 'Marigold Banquet', 'Pooja Nair', '9812002204', 'Dwarka', {}],
    ['h5', 'Highway Dhaba', 'Salim Qureshi', '9812002205', 'NH-48', {}],
    ['h6', 'Lotus Lodge', 'Kavita Jain', '9812002206', 'Saket', {}],
    ['h7', 'Green View Stay', 'Nisha Patel', '9812002207', 'Lajpat Nagar', {}],
    ['h8', 'Royal Guest House', 'Arun Mehta', '9812002208', 'Connaught Place', {}],
  ].map(([id, name, contact, phone, address, rates]) => ({
    id, name, contact, phone, address, rates, active: true,
  }))

  const production = []
  function pushProduction(date, productId, counts, rate, paid) {
    counts.forEach((qty, index) => {
      if (!qty) return
      production.push({
        id: uid(),
        date,
        workerId: workers[index].id,
        productId,
        qty,
        rate,
        amount: round(qty * rate),
        paid,
      })
    })
  }

  pushProduction(today, 'p-chapati', [340, 290, 410, 260, 305, 360, 220, 380, 250, 330, 275, 0], 1.5, false)
  pushProduction(yesterday, 'p-chapati', [300, 280, 360, 240, 290, 330, 210, 350, 230, 310, 260, 180], 1.5, true)

  const orders = []
  const payments = []
  function pushOrder(date, hotelId, no, note, lines, pay, method = 'cash') {
    const clean = lines.map(([productId, qty, rate]) => ({
      productId, qty, rate, amount: round(qty * rate),
    }))
    const id = uid()
    orders.push({
      id,
      no,
      date,
      hotelId,
      note,
      lines: clean,
      amount: sum(clean, (line) => line.amount),
      status: date === today ? 'pending' : 'completed',
    })
    if (pay > 0) {
      payments.push({
        id: uid(),
        orderId: id,
        hotelId,
        date,
        amount: round(pay),
        method,
        note: pay === orders[orders.length - 1].amount ? 'Paid with delivery' : 'Part payment',
      })
    }
  }

  pushOrder(older, 'h6', 'HD-222', 'Evening function', [['p-chapati', 150, 7]], 0)
  pushOrder(yesterday, 'h5', 'HD-221', 'Night delivery', [['p-chapati', 200, 7]], 1400, 'cash')
  pushOrder(today, 'h1', 'HD-226', 'Lunch and dinner', [['p-chapati', 600, 7]], 0)
  pushOrder(today, 'h2', 'HD-227', 'Paid on UPI', [['p-chapati', 400, 7]], 2800, 'upi')
  pushOrder(today, 'h3', 'HD-228', 'Balance on the weekly bill', [['p-chapati', 350, 6.5]], 1000, 'cash')
  pushOrder(today, 'h4', 'HD-229', 'Banquet lunch', [['p-chapati', 500, 7]], 0)

  const sales = []
  function pushSale(date, no, customerName, phone, method, hour, lines) {
    const clean = lines.map(([productId, qty, rate]) => ({
      productId, qty, rate, amount: round(qty * rate),
    }))
    sales.push({
      id: uid(),
      no,
      date,
      at: `${date}T${hour}:00`,
      customerName,
      phone,
      method,
      lines: clean,
      amount: sum(clean, (line) => line.amount),
    })
  }

  pushSale(yesterday, 'RC-1038', 'Meena Gupta', '9813003301', 'cash', '08:40', [['p-chapati', 30, 10]])
  pushSale(yesterday, 'RC-1039', '', '', 'cash', '18:10', [['p-chapati', 15, 10]])
  pushSale(today, 'RC-1040', 'Meena Gupta', '9813003301', 'upi', '07:50', [['p-chapati', 25, 10]])
  pushSale(today, 'RC-1041', 'Rahul Kitchen', '9813003302', 'cash', '09:15', [['p-chapati', 40, 10]])
  pushSale(today, 'RC-1042', '', '', 'cash', '11:05', [['p-chapati', 12, 10]])
  pushSale(today, 'RC-1043', 'S.P. Canteen', '9813003303', 'upi', '13:20', [['p-chapati', 30, 10]])

  const expenses = []
  function pushCost(date, itemId, qty, amount) {
    const item = costItem(itemId)
    expenses.push({ id: uid(), date, itemId, name: item.name, unit: item.unit, qty, amount })
  }
  pushCost(today, 'flour', 50, 2200)
  pushCost(today, 'ghee', 4, 720)
  pushCost(today, 'gas', 1, 1100)
  pushCost(today, 'electric', 86, 1450)
  pushCost(today, 'pack', 20, 180)
  pushCost(yesterday, 'flour', 50, 2100)
  pushCost(yesterday, 'transport', 1, 250)
  pushCost(older, 'ghee', 3, 540)

  return {
    settings: { ...defaultSettings, books: 'chapati-2' },
    products,
    workers,
    hotels,
    production,
    orders,
    payments,
    sales,
    expenses,
    attendance: workers.slice(0, 10).map((worker) => ({
      id: uid(),
      workerId: worker.id,
      date: today,
      present: worker.id !== 'w12',
    })),
    advances: [{ id: uid(), workerId: 'w1', date: today, amount: 5000, note: 'Advance' }],
    advanceCuts: [],
    users: defaultUsers(),
    personal: emptyPersonal(),
  }
}

function droppedBread(product) {
  const name = String(product?.name || '')
  return product?.id === 'p-roti'
    || product?.id === 'p-tandoor'
    || /tawa|tandoori|\btandoor\b/i.test(name)
    || (/roti/i.test(name) && !/chapati/i.test(name))
}

function migrateExpense(expense) {
  if (expense?.itemId && expense?.name && expense?.unit && expense.qty != null) return expense
  const known = {
    'Wheat flour': ['flour', 'kg'],
    'Ghee / oil': ['ghee', 'liter'],
    Gas: ['gas', 'cylinder'],
    Electricity: ['electric', 'unit'],
    'Electric bill': ['electric', 'unit'],
    Packaging: ['pack', 'packet'],
    Transport: ['transport', 'trip'],
  }[expense?.category]
  const item = known ? costItem(known[0]) : null
  return {
    id: expense.id,
    date: expense.date,
    itemId: item?.id || 'other',
    name: item?.name || expense.note || expense.category || 'Other',
    unit: item?.unit || expense.unit || 'piece',
    qty: Number(expense.qty) > 0 ? Number(expense.qty) : 1,
    amount: expense.amount,
  }
}

function migrate(state) {
  const oldChapati = (state.products || []).find((product) => product.id === 'p-chapati')
    || (state.products || []).find((product) => /chapati/i.test(product?.name || '') && !droppedBread(product))
  const products = [{
    id: 'p-chapati',
    name: 'Chapati',
    workerRate: Number(oldChapati?.workerRate) > 0 ? Number(oldChapati.workerRate) : 1.5,
    hotelRate: Number(oldChapati?.hotelRate) > 0 ? Number(oldChapati.hotelRate) : 7,
    retailRate: Number(oldChapati?.retailRate) > 0 ? Number(oldChapati.retailRate) : 10,
    active: true,
  }]
  const keep = new Set(['p-chapati'])
  const defaultRate = Number(products[0]?.workerRate) || 1.5
  const orders = state.orders
    .map((order) => {
      const lines = (order.lines || []).filter((line) => keep.has(line.productId))
      return {
        ...order,
        lines,
        amount: sum(lines, (line) => line.amount),
        status: order.status === 'completed' ? 'completed' : 'pending',
      }
    })
    .filter((order) => order.lines.length)
  const orderIds = new Set(orders.map((order) => order.id))
  const settings = {
    ...state.settings,
    name: state.settings?.name === 'Annapurna Roti Co.' ? 'Kwality Foods' : (state.settings?.name || 'Kwality Foods'),
    tagline: state.settings?.tagline || 'Homemade Chapatis',
  }
  return {
    ...state,
    settings,
    products,
    workers: (state.workers || []).map((worker) => ({
      ...worker,
      rate: Number(worker.rate) > 0 ? Number(worker.rate) : defaultRate,
    })),
    attendance: state.attendance || [],
    advances: state.advances || [],
    advanceCuts: state.advanceCuts || [],
    production: state.production.filter((row) => keep.has(row.productId)),
    orders,
    payments: state.payments.filter((payment) => !payment.orderId || orderIds.has(payment.orderId)),
    sales: state.sales
      .map((sale) => {
        const lines = (sale.lines || []).filter((line) => keep.has(line.productId))
        return { ...sale, lines, amount: sum(lines, (line) => line.amount) }
      })
      .filter((sale) => sale.lines.length),
    hotels: state.hotels.map((hotel) => {
      const rates = {}
      for (const [id, value] of Object.entries(hotel.rates || {})) {
        if (keep.has(id)) rates[id] = value
      }
      return { ...hotel, rates }
    }),
    expenses: (state.expenses || []).map(migrateExpense),
    users: cleanUsers(state.users),
    personal: cleanPersonal(state.personal),
  }
}

function readSession() {
  try {
    const raw = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null')
    if (raw?.id && (raw.role === 'admin' || raw.role === 'worker' || raw.role === 'owner')) return raw
  } catch {
    // A bad session should only send the person back to login.
  }
  return null
}

function readBooks(key) {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || 'null')
    if (raw?.settings?.name && Array.isArray(raw.workers) && Array.isArray(raw.products)) return raw
  } catch {
    // A damaged backup should not block the shop from opening the books.
  }
  return null
}

function load() {
  const saved = readBooks(KEY)
  if (saved?.settings?.books === 'chapati-2') return migrate(normalize(saved))
  const older = saved || readBooks(OLD_KEY)
  if (older?.settings?.hint === false) {
    const next = migrate(normalize(older))
    next.settings = { ...next.settings, books: 'chapati-2' }
    return next
  }
  return seed()
}

const StoreContext = createContext(null)

export function StoreProvider({ children }) {
  const [state, setState] = useState(load)
  const [date, setDate] = useState(todayISO)
  const [session, setSession] = useState(readSession)
  const dateRef = useRef(date)
  dateRef.current = date

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      // Private mode or a full disk should still leave the screen usable.
    }
  }, [state])

  useEffect(() => {
    document.title = `${state.settings.name} · Homemade Chapatis`
  }, [state.settings.name])

  const api = {
    state,
    date,
    session,
    setDate,
    login(username, password) {
      const name = String(username || '').trim().toLowerCase()
      const user = state.users.find((item) => item.username === name)
      if (!user || user.password !== hashPass(password)) {
        return { ok: false, reason: 'Wrong username or password.' }
      }
      const next = { id: user.id, username: user.username, role: user.role, name: user.name }
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(next))
      setSession(next)
      return { ok: true, session: next }
    },
    logout() {
      sessionStorage.removeItem(SESSION_KEY)
      setSession(null)
    },
    saveUser(draft) {
      const username = String(draft.username || '').trim().toLowerCase()
      const name = String(draft.name || username).trim()
      if (!username) return { ok: false, reason: 'Enter a username.' }
      if (!draft.id && !String(draft.password || '').trim()) return { ok: false, reason: 'Enter a password.' }
      const result = { ok: false, reason: 'Could not save this login.' }
      setState((current) => {
        if (current.users.some((user) => user.username === username && user.id !== draft.id)) {
          result.reason = 'That username is already used.'
          return current
        }
        const existing = draft.id ? current.users.find((user) => user.id === draft.id) : null
        if (existing?.role === 'owner') {
          result.reason = 'Owner login cannot be changed here.'
          return current
        }
        const nextRole = userRole(draft.role) === 'owner' ? 'worker' : userRole(draft.role)
        const row = {
          id: existing?.id || uid(),
          username,
          name,
          role: nextRole,
          password: String(draft.password || '').trim() ? hashPass(draft.password) : existing?.password || hashPass('staff123'),
        }
        result.ok = true
        return {
          ...current,
          users: existing
            ? current.users.map((user) => (user.id === existing.id ? row : user))
            : [...current.users, row],
        }
      })
      return result
    },
    removeUser(id) {
      let removed = false
      setState((current) => {
        const target = current.users.find((user) => user.id === id)
        if (!target) return current
        const admins = current.users.filter((user) => user.role === 'admin')
        if (target.role === 'admin' && admins.length <= 1) return current
        if (target.role === 'owner') return current
        removed = true
        return { ...current, users: current.users.filter((user) => user.id !== id) }
      })
      if (removed && session?.id === id) {
        sessionStorage.removeItem(SESSION_KEY)
        setSession(null)
      }
      return removed
    },
    patchSettings(partial) {
      setState((current) => ({ ...current, settings: { ...current.settings, ...partial } }))
    },
    savePersonalExpense(draft) {
      const amount = moneyInput(draft.amount)
      const note = String(draft.note || '').trim()
      if (amount <= 0) return { ok: false, reason: 'Enter the amount.' }
      const category = ['emi', 'petrol', 'ration', 'home', 'education', 'other'].includes(draft.category) ? draft.category : 'other'
      let saved = null
      setState((current) => {
        const books = cleanPersonal(current.personal)
        const no = draft.no || `H-${String(books.nextBill).padStart(4, '0')}`
        const row = {
          id: draft.id || uid(),
          date: draft.date || dateRef.current,
          category,
          amount,
          note,
          method: draft.method === 'upi' || draft.method === 'bank' ? draft.method : 'cash',
          no,
        }
        saved = row
        const expenses = draft.id
          ? books.expenses.map((item) => (item.id === draft.id ? row : item))
          : [...books.expenses, row]
        return {
          ...current,
          personal: {
            ...books,
            expenses,
            nextBill: draft.id ? books.nextBill : books.nextBill + 1,
          },
        }
      })
      return { ok: true, row: saved }
    },
    deletePersonalExpense(id) {
      setState((current) => ({
        ...current,
        personal: {
          ...cleanPersonal(current.personal),
          expenses: cleanPersonal(current.personal).expenses.filter((row) => row.id !== id),
        },
      }))
    },
    savePersonalIncome(draft) {
      const amount = moneyInput(draft.amount)
      const source = String(draft.source || '').trim()
      if (amount <= 0) return { ok: false, reason: 'Enter the amount.' }
      if (!source) return { ok: false, reason: 'Write where this money came from.' }
      setState((current) => {
        const books = cleanPersonal(current.personal)
        const no = draft.no || `M-${String(books.nextBill).padStart(4, '0')}`
        const row = {
          id: draft.id || uid(),
          date: draft.date || dateRef.current,
          source,
          amount,
          note: String(draft.note || '').trim(),
          method: draft.method === 'upi' || draft.method === 'bank' ? draft.method : 'cash',
          no,
        }
        const incomes = draft.id
          ? books.incomes.map((item) => (item.id === draft.id ? row : item))
          : [...books.incomes, row]
        return {
          ...current,
          personal: {
            ...books,
            incomes,
            nextBill: draft.id ? books.nextBill : books.nextBill + 1,
          },
        }
      })
      return { ok: true }
    },
    deletePersonalIncome(id) {
      setState((current) => ({
        ...current,
        personal: {
          ...cleanPersonal(current.personal),
          incomes: cleanPersonal(current.personal).incomes.filter((row) => row.id !== id),
        },
      }))
    },
    resetBooks() {
      setState(seed())
      setDate(todayISO())
    },
    importBooks(raw) {
      setState(normalize(raw))
    },
    setProduction(workerId, productId, qty) {
      const workingDate = dateRef.current
      setState((current) => {
        const product = current.products.find((item) => item.id === productId)
        if (!product) return current
        const worker = current.workers.find((item) => item.id === workerId)
        const existing = current.production.find(
          (row) => row.date === workingDate && row.workerId === workerId && row.productId === productId,
        )
        if (existing?.paid) return current
        const count = whole(qty)
        if (!count) {
          if (!existing) return current
          return { ...current, production: current.production.filter((row) => row.id !== existing.id) }
        }
        const rate = workerPrice(product, worker)
        const row = {
          id: existing?.id || uid(),
          date: workingDate,
          workerId,
          productId,
          qty: count,
          rate,
          amount: round(count * rate),
          paid: false,
        }
        if (existing && existing.qty === row.qty && existing.rate === row.rate && existing.amount === row.amount) {
          return current
        }
        const production = existing
          ? current.production.map((item) => (item.id === existing.id ? row : item))
          : [...current.production, row]
        return { ...current, production }
      })
    },
    setWorkerPaid(workerId, paid, span) {
      const workingDate = dateRef.current
      const from = span?.from || workingDate
      const to = span?.to || workingDate
      setState((current) => ({
        ...current,
        production: current.production.map((row) => {
          if (row.workerId !== workerId || row.date < from || row.date > to) return row
          if (paid) return { ...row, paid: true, payMethod: row.payMethod || 'cash', paidOn: row.paidOn || workingDate }
          return { ...row, paid: false, payMethod: '', paidOn: '' }
        }),
        advanceCuts: paid
          ? current.advanceCuts
          : (current.advanceCuts || []).filter((row) => !(row.workerId === workerId && row.date >= from && row.date <= to)),
      }))
    },
    payWage(workerId, deductAmount, extra = {}) {
      const workingDate = dateRef.current
      const from = extra.from || workingDate
      const to = extra.to || workingDate
      const method = extra.method === 'upi' || extra.method === 'bank' ? extra.method : 'cash'
      const cut = round(Math.max(0, moneyInput(deductAmount)))
      setState((current) => {
        const given = sum((current.advances || []).filter((row) => row.workerId === workerId), (row) => row.amount)
        const already = sum((current.advanceCuts || []).filter((row) => row.workerId === workerId), (row) => row.amount)
        const left = round(Math.max(0, given - already))
        const take = round(Math.min(cut, left))
        const production = current.production.map((row) => (
          row.workerId === workerId && !row.paid && row.date >= from && row.date <= to
            ? { ...row, paid: true, payMethod: method, paidOn: workingDate }
            : row
        ))
        const advanceCuts = take > 0
          ? [...(current.advanceCuts || []), { id: uid(), workerId, date: workingDate, amount: take, method }]
          : current.advanceCuts || []
        return { ...current, production, advanceCuts }
      })
    },
    payAllUnpaid(extra = {}) {
      const workingDate = dateRef.current
      const from = extra.from || workingDate
      const to = extra.to || workingDate
      const method = extra.method === 'upi' || extra.method === 'bank' ? extra.method : 'cash'
      setState((current) => ({
        ...current,
        production: current.production.map((row) => (
          !row.paid && row.date >= from && row.date <= to
            ? { ...row, paid: true, payMethod: method, paidOn: workingDate }
            : row
        )),
      }))
    },
    giveAdvance(draft) {
      const amount = moneyInput(draft.amount)
      if (!draft.workerId || amount <= 0) return { ok: false, reason: 'Enter the worker and the advance amount.' }
      const workingDate = dateRef.current
      setState((current) => ({
        ...current,
        advances: [...(current.advances || []), {
          id: uid(),
          workerId: draft.workerId,
          date: workingDate,
          amount,
          note: (draft.note || '').trim(),
        }],
      }))
      return { ok: true }
    },
    setAttendance(workerId, present) {
      const workingDate = dateRef.current
      setState((current) => {
        const existing = (current.attendance || []).find((row) => row.date === workingDate && row.workerId === workerId)
        const row = { id: existing?.id || uid(), workerId, date: workingDate, present: Boolean(present) }
        return {
          ...current,
          attendance: existing
            ? current.attendance.map((item) => (item.id === existing.id ? row : item))
            : [...(current.attendance || []), row],
        }
      })
    },
    setOrderStatus(id, status) {
      const next = status === 'completed' ? 'completed' : 'pending'
      setState((current) => ({
        ...current,
        orders: current.orders.map((order) => (order.id === id ? { ...order, status: next } : order)),
      }))
    },
    saveWorker(draft) {
      const name = (draft.name || '').trim()
      if (!name) return { ok: false, reason: 'Enter the maker’s name.' }
      setState((current) => {
        const fallback = current.products.find((product) => product.id === 'p-chapati')?.workerRate || 1.5
        const row = {
          id: draft.id || uid(),
          name,
          phone: (draft.phone || '').trim(),
          rate: moneyInput(draft.rate) || fallback,
          active: draft.active !== false,
        }
        const exists = current.workers.some((worker) => worker.id === row.id)
        return {
          ...current,
          workers: exists
            ? current.workers.map((worker) => (worker.id === row.id ? { ...worker, ...row } : worker))
            : [...current.workers, row],
        }
      })
      return { ok: true }
    },
    setWorkerActive(id, active) {
      setState((current) => ({
        ...current,
        workers: current.workers.map((worker) => (worker.id === id ? { ...worker, active } : worker)),
      }))
    },
    removeWorker(id) {
      let removed = false
      setState((current) => {
        if (current.production.some((row) => row.workerId === id)) return current
        removed = true
        return { ...current, workers: current.workers.filter((worker) => worker.id !== id) }
      })
      return removed
    },
    saveHotel(draft) {
      const contact = (draft.contact || '').trim()
      const phone = (draft.phone || '').trim()
      const address = (draft.address || '').trim()
      const name = (draft.name || '').trim() || contact || phone
      if (!contact && !phone) return { ok: false, reason: 'Enter a contact person or a phone number.' }
      const rates = {}
      for (const [productId, value] of Object.entries(draft.rates || {})) {
        const amount = moneyInput(value)
        if (amount > 0) rates[productId] = amount
      }
      setState((current) => {
        const row = {
          id: draft.id || uid(),
          name,
          contact,
          phone,
          address,
          rates,
          active: draft.active !== false,
        }
        const exists = current.hotels.some((hotel) => hotel.id === row.id)
        return {
          ...current,
          hotels: exists
            ? current.hotels.map((hotel) => (hotel.id === row.id ? row : hotel))
            : [...current.hotels, row],
        }
      })
      return { ok: true }
    },
    setHotelActive(id, active) {
      setState((current) => ({
        ...current,
        hotels: current.hotels.map((hotel) => (hotel.id === id ? { ...hotel, active } : hotel)),
      }))
    },
    removeHotel(id) {
      let removed = false
      setState((current) => {
        const used = current.orders.some((order) => order.hotelId === id) || current.payments.some((payment) => payment.hotelId === id)
        if (used) return current
        removed = true
        return { ...current, hotels: current.hotels.filter((hotel) => hotel.id !== id) }
      })
      return removed
    },
    saveProduct(draft) {
      if (droppedBread(draft)) return { ok: false, reason: 'This shop is chapati only.' }
      if (draft.id && draft.id !== 'p-chapati') return { ok: false, reason: 'This shop is chapati only.' }
      setState((current) => {
        const row = {
          id: 'p-chapati',
          name: 'Chapati',
          workerRate: moneyInput(draft.workerRate),
          hotelRate: moneyInput(draft.hotelRate),
          retailRate: moneyInput(draft.retailRate),
          active: true,
        }
        const exists = current.products.some((product) => product.id === row.id)
        return {
          ...current,
          products: exists
            ? current.products.map((product) => (product.id === row.id ? row : product))
            : [...current.products, row],
        }
      })
      return { ok: true }
    },
    setProductActive(id, active) {
      let changed = false
      setState((current) => {
        const activeCount = current.products.filter((product) => product.active !== false).length
        const target = current.products.find((product) => product.id === id)
        if (!target) return current
        if (!active && target.active !== false && activeCount <= 1) return current
        changed = true
        return {
          ...current,
          products: current.products.map((product) => (product.id === id ? { ...product, active } : product)),
        }
      })
      return changed
    },
    removeProduct(id) {
      let removed = false
      setState((current) => {
        const used = current.production.some((row) => row.productId === id)
          || current.orders.some((order) => order.lines.some((line) => line.productId === id))
          || current.sales.some((sale) => sale.lines.some((line) => line.productId === id))
        if (used) return current
        removed = true
        return { ...current, products: current.products.filter((product) => product.id !== id) }
      })
      return removed
    },
    saveOrder(draft) {
      const result = { ok: false, reason: 'Could not save the delivery.' }
      const workingDate = dateRef.current
      setState((current) => {
        const lines = cleanLines(draft.lines)
        if (!draft.hotelId || !lines.length) {
          result.reason = 'Choose a hotel and add at least one item.'
          return current
        }
        const amount = sum(lines, (line) => line.amount)
        const existing = draft.id ? current.orders.find((order) => order.id === draft.id) : null
        const already = existing ? orderPaid(current, existing.id) : 0
        if (existing && amount + 0.001 < already) {
          result.reason = 'The new total is less than money already received on this challan.'
          return current
        }
        const no = existing?.no || `HD-${current.settings.nextChallan}`
        const order = {
          id: existing?.id || uid(),
          no,
          date: existing?.date || draft.date || workingDate,
          hotelId: draft.hotelId,
          note: (draft.note || '').trim(),
          lines,
          amount,
          status: existing?.status || 'pending',
        }
        const orders = existing
          ? current.orders.map((item) => (item.id === existing.id ? order : item))
          : [...current.orders, order]
        let payments = current.payments
        const payNow = existing ? 0 : Math.min(moneyInput(draft.payNow), amount)
        if (payNow > 0) {
          payments = [...payments, {
            id: uid(),
            orderId: order.id,
            hotelId: order.hotelId,
            date: order.date,
            amount: round(payNow),
            method: draft.method || 'cash',
            note: 'Received with delivery',
          }]
        }
        result.ok = true
        result.no = no
        return {
          ...current,
          orders,
          payments,
          settings: {
            ...current.settings,
            nextChallan: existing ? current.settings.nextChallan : current.settings.nextChallan + 1,
          },
        }
      })
      return result
    },
    deleteOrder(id) {
      setState((current) => ({
        ...current,
        orders: current.orders.filter((order) => order.id !== id),
        payments: current.payments.filter((payment) => payment.orderId !== id),
      }))
    },
    receivePayment(draft) {
      const result = { ok: false, reason: 'Enter the amount received.' }
      const workingDate = dateRef.current
      setState((current) => {
        const created = allocatePayment({
          orders: current.orders,
          payments: current.payments,
          hotelId: draft.hotelId,
          amount: moneyInput(draft.amount),
          date: workingDate,
          method: draft.method || 'cash',
          note: (draft.note || '').trim(),
          uid,
          orderId: draft.orderId,
        })
        if (!created.length) {
          result.reason = 'Enter an amount greater than zero.'
          return current
        }
        result.ok = true
        return { ...current, payments: [...current.payments, ...created] }
      })
      return result
    },
    saveSale(draft) {
      const result = { ok: false, reason: 'Add at least one item.' }
      const workingDate = dateRef.current
      setState((current) => {
        const lines = cleanLines(draft.lines)
        if (!lines.length) return current
        const existing = draft.id ? current.sales.find((sale) => sale.id === draft.id) : null
        const no = existing?.no || `RC-${current.settings.nextBill}`
        const sale = {
          id: existing?.id || uid(),
          no,
          date: existing?.date || workingDate,
          at: existing?.at || new Date().toISOString(),
          customerName: (draft.customerName || '').trim(),
          phone: (draft.phone || '').trim(),
          method: draft.method === 'upi' || draft.method === 'bank' ? draft.method : 'cash',
          lines,
          amount: sum(lines, (line) => line.amount),
        }
        result.ok = true
        result.no = no
        result.sale = sale
        return {
          ...current,
          sales: existing
            ? current.sales.map((item) => (item.id === existing.id ? sale : item))
            : [...current.sales, sale],
          settings: {
            ...current.settings,
            nextBill: existing ? current.settings.nextBill : current.settings.nextBill + 1,
          },
        }
      })
      return result
    },
    deleteSale(id) {
      setState((current) => ({ ...current, sales: current.sales.filter((sale) => sale.id !== id) }))
    },
    saveExpense(draft) {
      const amount = moneyInput(draft.amount)
      const qty = moneyInput(draft.qty)
      const name = (draft.name || '').trim()
      if (!name) return { ok: false, reason: 'Choose what you bought. If it is Other, write the name.' }
      if (qty <= 0) return { ok: false, reason: 'Enter the quantity.' }
      if (amount <= 0) return { ok: false, reason: 'Enter the price.' }
      const workingDate = dateRef.current
      setState((current) => {
        const row = {
          id: draft.id || uid(),
          date: draft.date || workingDate,
          itemId: draft.itemId || 'other',
          name,
          unit: draft.unit || '',
          qty,
          amount,
        }
        const exists = current.expenses.some((expense) => expense.id === row.id)
        return {
          ...current,
          expenses: exists
            ? current.expenses.map((expense) => (expense.id === row.id ? row : expense))
            : [...current.expenses, row],
        }
      })
      return { ok: true }
    },
    deleteExpense(id) {
      setState((current) => ({ ...current, expenses: current.expenses.filter((expense) => expense.id !== id) }))
    },
  }

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>
}

export function useStore() {
  const value = useContext(StoreContext)
  if (!value) throw new Error('useStore must be used inside StoreProvider')
  return value
}
