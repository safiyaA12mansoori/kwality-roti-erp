export function round(value) {
  const amount = Number(value) || 0
  return Number(Math.round(Number(`${amount}e2`)) + 'e-2')
}

export function whole(value) {
  const n = parseInt(String(value ?? '').replace(/[^\d]/g, ''), 10)
  return Number.isFinite(n) ? n : 0
}

export function moneyInput(value) {
  const n = Number(String(value ?? '').replace(/[^\d.]/g, ''))
  if (!Number.isFinite(n) || n < 0) return 0
  return round(n)
}

export function sum(rows, pick = (row) => row) {
  return round(rows.reduce((total, row) => total + (Number(pick(row)) || 0), 0))
}

export function byId(list, id) {
  return list.find((item) => item.id === id) || null
}

export function isActive(row) {
  return Boolean(row) && row.active !== false
}

export function between(date, from, to) {
  return date >= from && date <= to
}

export function hotelPrice(product, hotel) {
  if (!product) return 0
  const custom = Number(hotel?.rates?.[product.id])
  if (Number.isFinite(custom) && custom > 0) return custom
  return Number(product.hotelRate) || 0
}

export function workerPrice(product, worker) {
  const custom = Number(worker?.rate)
  if (Number.isFinite(custom) && custom > 0) return custom
  return Number(product?.workerRate) || 0
}

export function advanceGiven(state, workerId) {
  return sum(
    (state.advances || []).filter((row) => row.workerId === workerId),
    (row) => row.amount,
  )
}

export function advanceCut(state, workerId) {
  return sum(
    (state.advanceCuts || []).filter((row) => row.workerId === workerId),
    (row) => row.amount,
  )
}

export function advanceBalance(state, workerId) {
  return round(Math.max(0, advanceGiven(state, workerId) - advanceCut(state, workerId)))
}

export function cleanLines(lines) {
  return (lines || [])
    .map((line) => {
      const qty = whole(line.qty)
      const rate = moneyInput(line.rate)
      return {
        productId: line.productId,
        qty,
        rate,
        amount: round(qty * rate),
      }
    })
    .filter((line) => line.productId && line.qty > 0)
}

export function orderPaid(state, orderId) {
  return sum(
    state.payments.filter((payment) => payment.orderId === orderId),
    (payment) => payment.amount,
  )
}

export function hotelBalance(state, hotelId) {
  const billed = sum(
    state.orders.filter((order) => order.hotelId === hotelId),
    (order) => order.amount,
  )
  const paid = sum(
    state.payments.filter((payment) => payment.hotelId === hotelId),
    (payment) => payment.amount,
  )
  return round(billed - paid)
}

export function partyKind(hotel, note) {
  const blob = `${hotel?.name || ''} ${hotel?.contact || ''} ${hotel?.address || ''} ${note || ''}`.toLowerCase()
  if (/cater|banquet|function|wedding|party hall/.test(blob)) return 'Catering'
  return 'Hotel'
}

export function unpaidBills(state) {
  const orders = state.orders || []
  const rows = orders
    .map((order) => {
      const paid = orderPaid(state, order.id)
      const due = round(order.amount - paid)
      const hotel = byId(state.hotels, order.hotelId)
      return {
        id: order.id,
        no: order.no,
        date: order.date,
        hotel,
        card: hotelCard(hotel),
        kind: partyKind(hotel, order.note),
        pending: order.status !== 'completed',
        amount: order.amount,
        paid,
        due,
      }
    })
    .filter((row) => row.due > 0)
    .sort((a, b) => b.due - a.due || String(b.date).localeCompare(String(a.date)))
  const parties = new Set(rows.map((row) => row.hotel?.id).filter(Boolean))
  return {
    rows,
    total: sum(rows, (row) => row.due),
    parties: parties.size,
    hotels: rows.filter((row) => row.kind === 'Hotel').length,
    catering: rows.filter((row) => row.kind === 'Catering').length,
  }
}

export function allocatePayment({ orders, payments, hotelId, amount, date, method, note, uid }) {
  let left = round(amount)
  if (left <= 0) return []
  const created = []
  const mine = orders
    .filter((order) => order.hotelId === hotelId)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.no).localeCompare(String(b.no)))

  for (const order of mine) {
    if (left <= 0) break
    const due = round(order.amount - orderPaid({ payments }, order.id))
    if (due <= 0) continue
    const take = round(Math.min(due, left))
    created.push({
      id: uid(),
      orderId: order.id,
      hotelId,
      date,
      amount: take,
      method,
      note: note || '',
    })
    left = round(left - take)
  }

  if (left > 0) {
    created.push({
      id: uid(),
      orderId: null,
      hotelId,
      date,
      amount: left,
      method,
      note: note || 'Advance',
    })
  }
  return created
}

const RAW_ITEMS = new Set(['flour', 'ghee', 'gas', 'pack'])

export function shopSnapshot(state, from, to) {
  const summary = rangeSummary(state, from, to)
  const board = hotelOrderBoard(state, from, to)
  const expenses = state.expenses.filter((expense) => between(expense.date, from, to))
  const raw = sum(expenses.filter((expense) => RAW_ITEMS.has(expense.itemId)), (expense) => expense.amount)
  const extra = sum(expenses.filter((expense) => !RAW_ITEMS.has(expense.itemId)), (expense) => expense.amount)
  const dues = sum(
    state.hotels.map((hotel) => hotelBalance(state, hotel.id)).filter((balance) => balance > 0),
  )
  return {
    hotels: state.hotels.filter((hotel) => hotel.active !== false).length,
    hotelOrders: board.orderCount,
    hotelOrdered: board.orderedHotels,
    hotelMissing: board.missingHotels,
    hotelBilled: summary.hotelBilled,
    workers: state.workers.filter((worker) => worker.active !== false).length,
    wages: summary.wages,
    wagesDue: summary.wagesDue,
    pieces: summary.pieces,
    raw,
    expense: extra,
    costs: summary.costs,
    collected: summary.collected,
    walkIn: summary.counterSales,
    billed: summary.billed,
    dues,
  }
}

export function moneyMix(state, from, to) {
  const inSpan = (row) => between(row.date, from, to)
  const sales = state.sales.filter(inSpan)
  const payments = state.payments.filter(inSpan)
  const orders = state.orders.filter(inSpan)
  const cash = round(
    sum(sales.filter((sale) => sale.method !== 'upi'), (sale) => sale.amount)
    + sum(payments.filter((payment) => payment.method === 'cash' || !payment.method), (payment) => payment.amount),
  )
  const digital = round(
    sum(sales.filter((sale) => sale.method === 'upi'), (sale) => sale.amount),
  )
  const online = round(
    sum(payments.filter((payment) => payment.method === 'upi' || payment.method === 'bank'), (payment) => payment.amount),
  )
  const hotelBilled = sum(orders, (order) => order.amount)
  const hotelPaid = sum(payments, (payment) => payment.amount)
  return {
    cash,
    digital,
    online,
    billed: round(hotelBilled + sum(sales, (sale) => sale.amount)),
    collected: round(cash + digital + online),
    due: round(Math.max(0, hotelBilled - hotelPaid)),
    billCount: orders.length + sales.length,
  }
}

export function rangeSummary(state, from, to) {
  const inSpan = (row) => between(row.date, from, to)
  const production = state.production.filter(inSpan)
  const orders = state.orders.filter(inSpan)
  const sales = state.sales.filter(inSpan)
  const expenses = state.expenses.filter(inSpan)
  const payments = state.payments.filter(inSpan)
  const wages = sum(production, (row) => row.amount)
  const hotelBilled = sum(orders, (order) => order.amount)
  const counterSales = sum(sales, (sale) => sale.amount)
  const billed = round(hotelBilled + counterSales)
  const costs = sum(expenses, (expense) => expense.amount)
  return {
    pieces: sum(production, (row) => row.qty),
    wages,
    wagesDue: sum(
      production.filter((row) => !row.paid),
      (row) => row.amount,
    ),
    hotelBilled,
    counterSales,
    billed,
    costs,
    collected: round(sum(payments, (payment) => payment.amount) + counterSales),
    margin: round(billed - wages - costs),
    orderCount: orders.length,
    saleCount: sales.length,
  }
}

export function daySummary(state, date) {
  const makers = state.workers.filter((worker) => worker.active !== false)
  const production = state.production.filter((row) => row.date === date)
  const counted = makers.filter((worker) => production.some((row) => row.workerId === worker.id)).length
  const hotelDues = sum(
    state.hotels.map((hotel) => hotelBalance(state, hotel.id)).filter((balance) => balance > 0),
  )
  return {
    ...rangeSummary(state, date, date),
    production,
    orders: state.orders.filter((order) => order.date === date),
    sales: state.sales.filter((sale) => sale.date === date),
    expenses: state.expenses.filter((expense) => expense.date === date),
    counted,
    makers: makers.length,
    hotelDues,
  }
}

export function workerDay(state, date, workerId) {
  return workerSpan(state, workerId, date, date)
}

export function workerSpan(state, workerId, from, to) {
  const rows = state.production
    .filter((row) => row.workerId === workerId && between(row.date, from, to))
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
  const unpaidRows = rows.filter((row) => !row.paid)
  const paidRows = rows.filter((row) => row.paid)
  return {
    rows,
    pieces: sum(rows, (row) => row.qty),
    amount: sum(rows, (row) => row.amount),
    unpaid: sum(unpaidRows, (row) => row.amount),
    unpaidPieces: sum(unpaidRows, (row) => row.qty),
    paidAmount: sum(paidRows, (row) => row.amount),
    paid: rows.length > 0 && unpaidRows.length === 0,
    partial: unpaidRows.length > 0 && paidRows.length > 0,
    methods: [...new Set(paidRows.map((row) => row.payMethod || 'cash'))],
    days: [...new Set(rows.map((row) => row.date))],
  }
}

export function productMovement(state, from, to) {
  const inSpan = (row) => between(row.date, from, to)
  return state.products
    .map((product) => {
      const made = sum(
        state.production.filter((row) => row.productId === product.id && inSpan(row)),
        (row) => row.qty,
      )
      const hotel = sum(
        state.orders.filter(inSpan).flatMap((order) => order.lines).filter((line) => line.productId === product.id),
        (line) => line.qty,
      )
      const counter = sum(
        state.sales.filter(inSpan).flatMap((sale) => sale.lines).filter((line) => line.productId === product.id),
        (line) => line.qty,
      )
      return { product, made, hotel, counter, sold: hotel + counter, gap: made - (hotel + counter) }
    })
    .filter((row) => row.product.active !== false || row.made || row.sold)
}

export function workerReport(state, from, to) {
  return state.workers
    .map((worker) => {
      const rows = state.production.filter(
        (row) => row.workerId === worker.id && between(row.date, from, to),
      )
      return {
        worker,
        pieces: sum(rows, (row) => row.qty),
        amount: sum(rows, (row) => row.amount),
        unpaid: sum(
          rows.filter((row) => !row.paid),
          (row) => row.amount,
        ),
      }
    })
    .filter((row) => row.pieces > 0)
    .sort((a, b) => b.amount - a.amount)
}

export function hotelReport(state, from, to) {
  return state.hotels
    .map((hotel) => {
      const orders = state.orders.filter((order) => order.hotelId === hotel.id && between(order.date, from, to))
      return {
        hotel,
        orders: orders.length,
        billed: sum(orders, (order) => order.amount),
        collected: sum(
          state.payments.filter((payment) => payment.hotelId === hotel.id && between(payment.date, from, to)),
          (payment) => payment.amount,
        ),
        balance: hotelBalance(state, hotel.id),
      }
    })
    .filter((row) => row.orders > 0 || row.balance !== 0)
    .sort((a, b) => b.balance - a.balance)
}

export function hotelCard(hotel) {
  if (!hotel) return { title: 'Hotel', detail: '' }
  const title = hotel.contact || hotel.phone || hotel.address || 'Hotel'
  const detail = [hotel.phone, hotel.address].filter(Boolean).join(' · ')
  return { title, detail }
}

export function hotelOrderBoard(state, from, to) {
  const hotels = state.hotels.filter((hotel) => hotel.active !== false)
  const orders = state.orders.filter((order) => between(order.date, from, to))
  const orderedIds = new Set(orders.map((order) => order.hotelId))
  const rows = hotels
    .slice()
    .sort((a, b) => (a.contact || a.phone || '').localeCompare(b.contact || b.phone || ''))
    .map((hotel) => {
      const mine = orders.filter((order) => order.hotelId === hotel.id)
      return {
        hotel,
        card: hotelCard(hotel),
        ordered: mine.length > 0,
        orders: mine,
        pieces: sum(mine.flatMap((order) => order.lines), (line) => line.qty),
        amount: sum(mine, (order) => order.amount),
      }
    })
  return {
    rows,
    hotels: hotels.length,
    orderedHotels: rows.filter((row) => row.ordered).length,
    missingHotels: rows.filter((row) => !row.ordered).length,
    orderCount: orders.length,
    pieces: sum(orders.flatMap((order) => order.lines), (line) => line.qty),
    billed: sum(orders, (order) => order.amount),
  }
}

export function workerStatement(state, workerId, from, to) {
  const worker = byId(state.workers, workerId)
  const rows = state.production
    .filter((row) => row.workerId === workerId && between(row.date, from, to))
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
  const advances = (state.advances || [])
    .filter((row) => row.workerId === workerId && between(row.date, from, to))
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
  const cuts = (state.advanceCuts || [])
    .filter((row) => row.workerId === workerId && between(row.date, from, to))
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
  return {
    worker,
    rows,
    pieces: sum(rows, (row) => row.qty),
    amount: sum(rows, (row) => row.amount),
    unpaid: sum(rows.filter((row) => !row.paid), (row) => row.amount),
    paid: sum(rows.filter((row) => row.paid), (row) => row.amount),
    advances,
    advanceGiven: sum(advances, (row) => row.amount),
    cuts,
    advanceCut: sum(cuts, (row) => row.amount),
    advanceLeft: advanceBalance(state, workerId),
  }
}

export function walkInKey(sale) {
  const phone = (sale.phone || '').trim()
  const name = (sale.customerName || '').trim()
  if (phone) return `p:${phone}`
  if (name) return `n:${name.toLowerCase()}`
  return `s:${sale.id}`
}

export function walkInStatement(state, key, from, to) {
  const sales = state.sales
    .filter((sale) => between(sale.date, from, to) && walkInKey(sale) === key)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.no).localeCompare(String(b.no)))
  const first = sales[0]
  return {
    key,
    name: first?.customerName || 'Walk-in',
    phone: first?.phone || '',
    sales,
    bills: sales.length,
    pieces: sum(sales.flatMap((sale) => sale.lines), (line) => line.qty),
    amount: sum(sales, (sale) => sale.amount),
  }
}

export function hotelStatement(state, hotelId, from, to) {
  const hotel = byId(state.hotels, hotelId)
  const orders = state.orders
    .filter((order) => order.hotelId === hotelId && between(order.date, from, to))
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.no).localeCompare(String(b.no)))
  const payments = state.payments
    .filter((payment) => payment.hotelId === hotelId && between(payment.date, from, to))
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
  return {
    hotel,
    orders,
    payments,
    billed: sum(orders, (order) => order.amount),
    collected: sum(payments, (payment) => payment.amount),
    pieces: sum(orders.flatMap((order) => order.lines), (line) => line.qty),
    balance: hotelBalance(state, hotelId),
  }
}

export function regulars(sales) {
  const map = new Map()
  for (const sale of sales) {
    const name = (sale.customerName || '').trim()
    const phone = (sale.phone || '').trim()
    if (!name && !phone) continue
    const key = (phone || name).toLowerCase()
    const current = map.get(key) || { name, phone, visits: 0, amount: 0, last: sale.date }
    current.visits += 1
    current.amount = round(current.amount + sale.amount)
    if (sale.date >= current.last) current.last = sale.date
    if (name) current.name = name
    if (phone) current.phone = phone
    map.set(key, current)
  }
  return [...map.values()].sort((a, b) => b.visits - a.visits || b.amount - a.amount)
}

export function hasWorkerHistory(state, id) {
  return state.production.some((row) => row.workerId === id)
}

export function hasHotelHistory(state, id) {
  return state.orders.some((order) => order.hotelId === id) || state.payments.some((payment) => payment.hotelId === id)
}

export function costSummary(expenses) {
  const grouped = new Map()
  for (const expense of expenses) {
    const name = expense.name || expense.category || 'Cost'
    const unit = expense.unit || ''
    const key = `${name}@@${unit}`
    const current = grouped.get(key) || { name, unit, qty: 0, amount: 0 }
    current.qty = round(current.qty + (Number(expense.qty) || 0))
    current.amount = round(current.amount + (Number(expense.amount) || 0))
    grouped.set(key, current)
  }
  return [...grouped.values()]
}

export function daysInRange(from, to) {
  const days = []
  let current = from
  let guard = 0
  while (current && current <= to && guard < 400) {
    days.push(current)
    const [year, month, day] = current.split('-').map(Number)
    current = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10)
    guard += 1
  }
  return days
}

export function hotelDayBook(state, hotelId, from, to) {
  const statement = hotelStatement(state, hotelId, from, to)
  const days = daysInRange(from, to).map((date) => {
    const orders = statement.orders.filter((order) => order.date === date)
    const payments = statement.payments.filter((payment) => payment.date === date)
    const pending = orders.some((order) => order.status === 'pending')
    return {
      date,
      orders,
      payments,
      pieces: sum(orders.flatMap((order) => order.lines), (line) => line.qty),
      billed: sum(orders, (order) => order.amount),
      paid: sum(payments, (payment) => payment.amount),
      challans: orders.map((order) => order.no).filter(Boolean).join(', '),
      notes: orders.map((order) => order.note).filter(Boolean).join(' · '),
      delivery: orders.length === 0 ? 'No delivery' : pending ? 'Pending' : 'Delivered',
      methods: [...new Set(payments.map((payment) => payment.method).filter(Boolean))].join(', '),
    }
  })
  return { ...statement, days }
}

export function workerDayBook(state, workerId, from, to) {
  const statement = workerStatement(state, workerId, from, to)
  const marks = (state.attendance || []).filter((row) => row.workerId === workerId && between(row.date, from, to))
  const days = daysInRange(from, to).map((date) => {
    const made = statement.rows.filter((row) => row.date === date)
    const mark = marks.find((row) => row.date === date)
    const given = statement.advances.filter((row) => row.date === date)
    const cut = statement.cuts.filter((row) => row.date === date)
    return {
      date,
      attendance: !mark ? 'Not marked' : mark.present ? 'Present' : 'Absent',
      present: mark?.present,
      pieces: sum(made, (row) => row.qty),
      rate: made[0]?.rate || 0,
      amount: sum(made, (row) => row.amount),
      paid: sum(made.filter((row) => row.paid), (row) => row.amount),
      due: sum(made.filter((row) => !row.paid), (row) => row.amount),
      payMethod: [...new Set(made.map((row) => row.payMethod).filter(Boolean))].join(', '),
      advanceGiven: sum(given, (row) => row.amount),
      advanceNote: given.map((row) => row.note).filter(Boolean).join(' · '),
      advanceCut: sum(cut, (row) => row.amount),
    }
  })
  const presentDays = days.filter((row) => row.present === true).length
  const absentDays = days.filter((row) => row.present === false).length
  return { ...statement, days, presentDays, absentDays }
}

export function walkInDayBook(state, key, from, to) {
  const statement = walkInStatement(state, key, from, to)
  const grouped = new Map()
  for (const sale of statement.sales) {
    const current = grouped.get(sale.date) || { date: sale.date, sales: [], pieces: 0, amount: 0 }
    current.sales.push(sale)
    current.pieces = round(current.pieces + sum(sale.lines, (line) => line.qty))
    current.amount = round(current.amount + (Number(sale.amount) || 0))
    grouped.set(sale.date, current)
  }
  return { ...statement, days: [...grouped.values()].sort((a, b) => a.date.localeCompare(b.date)) }
}

export function hasProductHistory(state, id) {
  if (state.production.some((row) => row.productId === id)) return true
  if (state.orders.some((order) => order.lines.some((line) => line.productId === id))) return true
  return state.sales.some((sale) => sale.lines.some((line) => line.productId === id))
}
