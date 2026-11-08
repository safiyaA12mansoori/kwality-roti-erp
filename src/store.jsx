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
import { todayISO } from './format'
import { emptyPersonal } from './personal'

const KEY = 'roti-erp-v3'
const BOOKS_URL = 'https://kwalityroti.com/api/books.php?k=kw8f3c1a9e4b27d6'
const SESSION_KEY = 'roti-erp-session'

export const defaultSettings = {
  name: 'Kwality Foods',
  tagline: 'Homemade Chapatis',
  phone: '',
  address: '',
  nextBill: 1,
  nextChallan: 1,
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

function emptyBooks() {
  return {
    settings: { ...defaultSettings, books: 'chapati-2' },
    products: [
      { id: 'p-chapati', name: 'Chapati', workerRate: 1.5, hotelRate: 7, retailRate: 10, active: true },
    ],
    workers: [],
    hotels: [],
    production: [],
    orders: [],
    payments: [],
    sales: [],
    expenses: [],
    attendance: [],
    advances: [],
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
  try {
    localStorage.removeItem('roti-erp-v1')
    localStorage.removeItem('roti-erp-v2')
  } catch {
    // Old sample books can stay unread if storage is blocked.
  }
  const saved = readBooks(KEY)
  if (saved) return migrate(normalize(saved))
  return emptyBooks()
}

const StoreContext = createContext(null)

export function StoreProvider({ children }) {
  const [state, setState] = useState(load)
  const [date, setDate] = useState(todayISO)
  const [session, setSession] = useState(readSession)
  const [dbReady, setDbReady] = useState(false)
  const dateRef = useRef(date)
  dateRef.current = date

  useEffect(() => {
    let ignore = false
    fetch(BOOKS_URL)
      .then((response) => (response.ok ? response.json() : null))
      .then((raw) => {
        if (ignore) return
        if (raw?.settings?.name && Array.isArray(raw.workers) && Array.isArray(raw.products)) {
          setState(migrate(normalize(raw)))
        }
      })
      .catch(() => {
        // The public site keeps working from this browser when MySQL is not running.
      })
      .finally(() => {
        if (!ignore) setDbReady(true)
      })
    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    if (!dbReady) return undefined
    const handle = setTimeout(() => {
      fetch(BOOKS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify(state),
      }).catch(() => {
        // A stopped database should not block the screen.
      })
      try {
        localStorage.setItem(KEY, JSON.stringify(state))
      } catch {
        // Private mode or a full disk should still leave the screen usable.
      }
    }, 200)
    return () => clearTimeout(handle)
  }, [state, dbReady])

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
    setPassword(username, password) {
      const name = String(username || '').trim().toLowerCase()
      const next = String(password || '')
      if (next.length < 4) return { ok: false, reason: 'Use at least 4 characters.' }
      let found = false
      setState((current) => ({
        ...current,
        users: current.users.map((user) => {
          if (user.username !== name) return user
          found = true
          return { ...user, password: hashPass(next) }
        }),
      }))
      if (!found) return { ok: false, reason: 'Unknown login.' }
      return { ok: true }
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
      setState(emptyBooks())
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
