import mysql from 'mysql2/promise'

const pool = mysql.createPool({
  host: '127.0.0.1',
  user: 'root',
  password: '',
  database: 'kwality_roti',
  waitForConnections: true,
  connectionLimit: 4,
  dateStrings: true,
})

const CLEAR = [
  'sale_lines',
  'order_lines',
  'hotel_rates',
  'payments',
  'sales',
  'orders',
  'production',
  'attendance',
  'advances',
  'advance_cuts',
  'expenses',
  'personal_incomes',
  'personal_expenses',
  'hotels',
  'workers',
  'products',
  'users',
  'settings',
]

function money(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function text(value) {
  return value == null ? '' : String(value)
}

function day(value) {
  const raw = text(value).slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null
}

function flag(value) {
  return value ? 1 : 0
}

function num(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

async function insert(conn, sql, rows) {
  for (const row of rows) await conn.query(sql, row)
}

export async function saveState(state) {
  const settings = state.settings || {}
  const personal = state.personal || {}
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    for (const table of CLEAR) await conn.query(`DELETE FROM \`${table}\``)
    await conn.query(
      `INSERT INTO settings (id, name, tagline, phone, address, next_bill, next_challan, hint, books, personal_next_bill)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        text(settings.name || 'Kwality Foods'),
        text(settings.tagline),
        text(settings.phone),
        text(settings.address),
        Math.max(1, num(settings.nextBill) || 1),
        Math.max(1, num(settings.nextChallan) || 1),
        flag(settings.hint !== false),
        text(settings.books || 'chapati-2'),
        Math.max(1, num(personal.nextBill) || 1),
      ],
    )
    await insert(
      conn,
      'INSERT INTO users (id, username, password, role, name) VALUES (?, ?, ?, ?, ?)',
      (state.users || []).map((user) => [text(user.id), text(user.username), text(user.password), text(user.role), text(user.name)]),
    )
    await insert(
      conn,
      'INSERT INTO products (id, name, worker_rate, hotel_rate, retail_rate, active) VALUES (?, ?, ?, ?, ?, ?)',
      (state.products || []).map((product) => [
        text(product.id), text(product.name), money(product.workerRate), money(product.hotelRate), money(product.retailRate), flag(product.active !== false),
      ]),
    )
    await insert(
      conn,
      'INSERT INTO workers (id, name, phone, rate, active) VALUES (?, ?, ?, ?, ?)',
      (state.workers || []).map((worker) => [text(worker.id), text(worker.name), text(worker.phone), money(worker.rate), flag(worker.active !== false)]),
    )
    await insert(
      conn,
      'INSERT INTO hotels (id, name, contact, phone, address, active) VALUES (?, ?, ?, ?, ?, ?)',
      (state.hotels || []).map((hotel) => [
        text(hotel.id), text(hotel.name), text(hotel.contact), text(hotel.phone), text(hotel.address), flag(hotel.active !== false),
      ]),
    )
    const rates = []
    for (const hotel of state.hotels || []) {
      for (const [productId, rate] of Object.entries(hotel.rates || {})) {
        if (rate === '' || rate == null) continue
        rates.push([text(hotel.id), text(productId), money(rate)])
      }
    }
    await insert(conn, 'INSERT INTO hotel_rates (hotel_id, product_id, rate) VALUES (?, ?, ?)', rates)
    await insert(
      conn,
      'INSERT INTO orders (id, bill_no, order_date, hotel_id, note, amount, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      (state.orders || []).map((order) => [
        text(order.id), text(order.no), day(order.date), text(order.hotelId), text(order.note), money(order.amount), text(order.status || 'pending'),
      ]),
    )
    const orderLines = []
    for (const order of state.orders || []) {
      ;(order.lines || []).forEach((line, index) => {
        orderLines.push([
          `${order.id}-${index}`, text(order.id), text(line.productId), money(line.qty), money(line.rate), money(line.amount), index,
        ])
      })
    }
    await insert(
      conn,
      'INSERT INTO order_lines (id, order_id, product_id, qty, rate, amount, line_no) VALUES (?, ?, ?, ?, ?, ?, ?)',
      orderLines,
    )
    await insert(
      conn,
      'INSERT INTO payments (id, order_id, hotel_id, pay_date, amount, method, note) VALUES (?, ?, ?, ?, ?, ?, ?)',
      (state.payments || []).map((payment) => [
        text(payment.id), text(payment.orderId), text(payment.hotelId), day(payment.date), money(payment.amount), text(payment.method || 'cash'), text(payment.note),
      ]),
    )
    await insert(
      conn,
      'INSERT INTO sales (id, bill_no, sale_date, sold_at, customer_name, phone, method, amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      (state.sales || []).map((sale) => [
        text(sale.id), text(sale.no), day(sale.date), text(sale.at), text(sale.customerName), text(sale.phone), text(sale.method || 'cash'), money(sale.amount),
      ]),
    )
    const saleLines = []
    for (const sale of state.sales || []) {
      ;(sale.lines || []).forEach((line, index) => {
        saleLines.push([
          `${sale.id}-${index}`, text(sale.id), text(line.productId), money(line.qty), money(line.rate), money(line.amount), index,
        ])
      })
    }
    await insert(
      conn,
      'INSERT INTO sale_lines (id, sale_id, product_id, qty, rate, amount, line_no) VALUES (?, ?, ?, ?, ?, ?, ?)',
      saleLines,
    )
    await insert(
      conn,
      `INSERT INTO production (id, work_date, worker_id, product_id, qty, rate, amount, paid, pay_method, paid_on)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      (state.production || []).map((row) => [
        text(row.id), day(row.date), text(row.workerId), text(row.productId), money(row.qty), money(row.rate), money(row.amount),
        flag(row.paid), text(row.payMethod), day(row.paidOn),
      ]),
    )
    await insert(
      conn,
      'INSERT INTO attendance (id, worker_id, work_date, present) VALUES (?, ?, ?, ?)',
      (state.attendance || []).map((row) => [text(row.id), text(row.workerId), day(row.date), flag(row.present)]),
    )
    await insert(
      conn,
      'INSERT INTO advances (id, worker_id, advance_date, amount, note) VALUES (?, ?, ?, ?, ?)',
      (state.advances || []).map((row) => [text(row.id), text(row.workerId), day(row.date), money(row.amount), text(row.note)]),
    )
    await insert(
      conn,
      'INSERT INTO advance_cuts (id, worker_id, cut_date, amount, method) VALUES (?, ?, ?, ?, ?)',
      (state.advanceCuts || []).map((row) => [text(row.id), text(row.workerId), day(row.date), money(row.amount), text(row.method || 'cash')]),
    )
    await insert(
      conn,
      'INSERT INTO expenses (id, expense_date, item_id, name, unit, qty, amount) VALUES (?, ?, ?, ?, ?, ?, ?)',
      (state.expenses || []).map((row) => [
        text(row.id), day(row.date), text(row.itemId), text(row.name), text(row.unit), money(row.qty), money(row.amount),
      ]),
    )
    await insert(
      conn,
      'INSERT INTO personal_incomes (id, bill_no, income_date, source, amount, method, note) VALUES (?, ?, ?, ?, ?, ?, ?)',
      (personal.incomes || []).map((row) => [
        text(row.id), text(row.no), day(row.date), text(row.source), money(row.amount), text(row.method || 'cash'), text(row.note),
      ]),
    )
    await insert(
      conn,
      'INSERT INTO personal_expenses (id, bill_no, expense_date, category, amount, method, note) VALUES (?, ?, ?, ?, ?, ?, ?)',
      (personal.expenses || []).map((row) => [
        text(row.id), text(row.no), day(row.date), text(row.category), money(row.amount), text(row.method || 'cash'), text(row.note),
      ]),
    )
    await conn.commit()
  } catch (error) {
    await conn.rollback()
    throw error
  } finally {
    conn.release()
  }
}

function yes(value) {
  return Number(value) === 1
}

function groupLines(rows, parentKey) {
  const grouped = new Map()
  for (const row of rows) {
    const list = grouped.get(row[parentKey]) || []
    list.push({
      productId: row.product_id,
      qty: num(row.qty),
      rate: num(row.rate),
      amount: num(row.amount),
      lineNo: num(row.line_no),
    })
    grouped.set(row[parentKey], list)
  }
  for (const list of grouped.values()) {
    list.sort((a, b) => a.lineNo - b.lineNo)
    for (const line of list) delete line.lineNo
  }
  return grouped
}

export async function loadState() {
  const [settingsRows] = await pool.query('SELECT * FROM settings WHERE id = 1')
  if (!settingsRows.length) return null
  const settings = settingsRows[0]
  const [users] = await pool.query('SELECT * FROM users')
  const [products] = await pool.query('SELECT * FROM products')
  const [workers] = await pool.query('SELECT * FROM workers')
  const [hotels] = await pool.query('SELECT * FROM hotels')
  const [rates] = await pool.query('SELECT * FROM hotel_rates')
  const [orders] = await pool.query('SELECT * FROM orders')
  const [orderLines] = await pool.query('SELECT * FROM order_lines')
  const [payments] = await pool.query('SELECT * FROM payments')
  const [sales] = await pool.query('SELECT * FROM sales')
  const [saleLines] = await pool.query('SELECT * FROM sale_lines')
  const [production] = await pool.query('SELECT * FROM production')
  const [attendance] = await pool.query('SELECT * FROM attendance')
  const [advances] = await pool.query('SELECT * FROM advances')
  const [advanceCuts] = await pool.query('SELECT * FROM advance_cuts')
  const [expenses] = await pool.query('SELECT * FROM expenses')
  const [incomes] = await pool.query('SELECT * FROM personal_incomes')
  const [personalExpenses] = await pool.query('SELECT * FROM personal_expenses')
  const orderLineMap = groupLines(orderLines, 'order_id')
  const saleLineMap = groupLines(saleLines, 'sale_id')
  const rateMap = new Map()
  for (const row of rates) {
    const current = rateMap.get(row.hotel_id) || {}
    current[row.product_id] = num(row.rate)
    rateMap.set(row.hotel_id, current)
  }
  return {
    settings: {
      name: settings.name,
      tagline: settings.tagline,
      phone: settings.phone,
      address: settings.address,
      nextBill: num(settings.next_bill) || 1,
      nextChallan: num(settings.next_challan) || 1,
      hint: yes(settings.hint),
      books: settings.books || 'chapati-2',
    },
    users: users.map((user) => ({
      id: user.id, username: user.username, password: user.password, role: user.role, name: user.name,
    })),
    products: products.map((product) => ({
      id: product.id,
      name: product.name,
      workerRate: num(product.worker_rate),
      hotelRate: num(product.hotel_rate),
      retailRate: num(product.retail_rate),
      active: yes(product.active),
    })),
    workers: workers.map((worker) => ({
      id: worker.id, name: worker.name, phone: worker.phone, rate: num(worker.rate), active: yes(worker.active),
    })),
    hotels: hotels.map((hotel) => ({
      id: hotel.id,
      name: hotel.name,
      contact: hotel.contact,
      phone: hotel.phone,
      address: hotel.address,
      rates: rateMap.get(hotel.id) || {},
      active: yes(hotel.active),
    })),
    orders: orders.map((order) => ({
      id: order.id,
      no: order.bill_no,
      date: order.order_date,
      hotelId: order.hotel_id,
      note: order.note,
      lines: orderLineMap.get(order.id) || [],
      amount: num(order.amount),
      status: order.status,
    })),
    payments: payments.map((payment) => ({
      id: payment.id,
      orderId: payment.order_id,
      hotelId: payment.hotel_id,
      date: payment.pay_date,
      amount: num(payment.amount),
      method: payment.method,
      note: payment.note,
    })),
    sales: sales.map((sale) => ({
      id: sale.id,
      no: sale.bill_no,
      date: sale.sale_date,
      at: sale.sold_at,
      customerName: sale.customer_name,
      phone: sale.phone,
      method: sale.method,
      lines: saleLineMap.get(sale.id) || [],
      amount: num(sale.amount),
    })),
    production: production.map((row) => ({
      id: row.id,
      date: row.work_date,
      workerId: row.worker_id,
      productId: row.product_id,
      qty: num(row.qty),
      rate: num(row.rate),
      amount: num(row.amount),
      paid: yes(row.paid),
      payMethod: row.pay_method || '',
      paidOn: row.paid_on || '',
    })),
    attendance: attendance.map((row) => ({
      id: row.id, workerId: row.worker_id, date: row.work_date, present: yes(row.present),
    })),
    advances: advances.map((row) => ({
      id: row.id, workerId: row.worker_id, date: row.advance_date, amount: num(row.amount), note: row.note,
    })),
    advanceCuts: advanceCuts.map((row) => ({
      id: row.id, workerId: row.worker_id, date: row.cut_date, amount: num(row.amount), method: row.method,
    })),
    expenses: expenses.map((row) => ({
      id: row.id,
      date: row.expense_date,
      itemId: row.item_id,
      name: row.name,
      unit: row.unit,
      qty: num(row.qty),
      amount: num(row.amount),
    })),
    personal: {
      incomes: incomes.map((row) => ({
        id: row.id, no: row.bill_no, date: row.income_date, source: row.source, amount: num(row.amount), method: row.method, note: row.note,
      })),
      expenses: personalExpenses.map((row) => ({
        id: row.id, no: row.bill_no, date: row.expense_date, category: row.category, amount: num(row.amount), method: row.method, note: row.note,
      })),
      nextBill: Math.max(1, num(settings.personal_next_bill) || 1),
    },
  }
}

export async function closePool() {
  await pool.end()
}
