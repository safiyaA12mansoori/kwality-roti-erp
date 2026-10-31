import { useEffect, useMemo, useState } from 'react'
import {
  between,
  byId,
  costSummary,
  hotelCard,
  hotelDayBook,
  hotelOrderBoard,
  rangeSummary,
  walkInDayBook,
  walkInKey,
  workerDayBook,
  workerReport,
} from '../calc'
import {
  addDaysISO,
  esc,
  inr,
  lastDaysBounds,
  methodLabel,
  monthBounds,
  num,
  prettyDate,
  prettyMonth,
  qtyWithUnit,
  thisMonth,
  todayISO,
  weekBounds,
} from '../format'
import { companyBlock, downloadExcel, downloadPdf, printDocument } from '../print'
import { HotelProfile, WalkInProfile, WorkerProfile } from '../profile'
import { useStore } from '../store'
import { SearchBar } from '../ui'

function boundsFor(mode, day, month, from, to) {
  if (mode === 'day') return { from: day, to: day }
  if (mode === 'week') return weekBounds(day)
  if (mode === 'month') return monthBounds(month)
  if (mode === 'days15') return lastDaysBounds(day, 15)
  return { from: from <= to ? from : to, to: from <= to ? to : from }
}

function invoicePeriodLabel(mode, bounds, month) {
  if (mode === 'day') return prettyDate(bounds.from)
  if (mode === 'days15') return `15 days · ${prettyDate(bounds.from)} to ${prettyDate(bounds.to)}`
  if (mode === 'month') return prettyMonth(month)
  if (mode === 'week') return `Week · ${prettyDate(bounds.from)} to ${prettyDate(bounds.to)}`
  return `${prettyDate(bounds.from)} to ${prettyDate(bounds.to)}`
}

function itemText(state, lines) {
  return lines.map((line) => `${num(line.qty)} ${esc(byId(state.products, line.productId)?.name || '')}`).join(', ')
}

function hotelInvoiceBody(state, book, title) {
  const hotel = book.hotel
  const card = hotelCard(hotel)
  const dayRows = (book.days || []).map((row) => `<tr>
      <td>${esc(prettyDate(row.date))}</td>
      <td>${esc(row.delivery)}</td>
      <td>${esc(row.challans || '—')}</td>
      <td>${esc(row.notes || '—')}</td>
      <td class="num">${row.pieces ? num(row.pieces) : '—'}</td>
      <td class="num">${row.billed ? inr(row.billed) : '—'}</td>
      <td class="num">${row.paid ? inr(row.paid) : '—'}</td>
      <td>${esc(row.methods ? row.methods.split(',').map((item) => methodLabel(item.trim())).join(', ') : '—')}</td>
    </tr>`).join('')
  return `
    ${companyBlock(state.settings)}
    <h2>Hotel invoice · ${esc(title)}</h2>
    <p><strong>${esc(hotel?.name || card.title)}</strong></p>
    <p>${esc([hotel?.contact, hotel?.phone, hotel?.address].filter(Boolean).join(' · '))}</p>
    <p>Chapati ${num(book.pieces)} · billed ${inr(book.billed)} · received ${inr(book.collected)} · still due ${inr(book.balance)}</p>
    <table>
      <thead><tr><th>Date</th><th>Delivery</th><th>Challan</th><th>Note</th><th class="num">Chapati qty</th><th class="num">Bill amount</th><th class="num">Received</th><th>How</th></tr></thead>
      <tbody>${dayRows || '<tr><td colspan="8">No days in this period.</td></tr>'}</tbody>
    </table>
    <div class="sign"><div>Received by hotel</div><div>For ${esc(state.settings.name)}</div></div>
  `
}

function workerInvoiceBody(state, book, title) {
  const worker = book.worker
  const dayRows = (book.days || []).map((row) => `<tr>
      <td>${esc(prettyDate(row.date))}</td>
      <td>${esc(row.attendance)}</td>
      <td class="num">${row.pieces ? num(row.pieces) : '—'}</td>
      <td class="num">${row.rate ? inr(row.rate) : '—'}</td>
      <td class="num">${row.amount ? inr(row.amount) : '—'}</td>
      <td>${esc(row.amount ? (row.due === 0 ? `Paid${row.payMethod ? ` · ${methodLabel(row.payMethod)}` : ''}` : row.paid ? 'Part paid' : 'Due') : '—')}</td>
      <td class="num">${row.advanceGiven ? inr(row.advanceGiven) : '—'}</td>
      <td class="num">${row.advanceCut ? inr(row.advanceCut) : '—'}</td>
    </tr>`).join('')
  return `
    ${companyBlock(state.settings)}
    <h2>Worker invoice · ${esc(title)}</h2>
    <p><strong>${esc(worker?.name || 'Worker')}</strong>${worker?.phone ? ` · ${esc(worker.phone)}` : ''}</p>
    <p>Present ${num(book.presentDays)} · absent ${num(book.absentDays)} · chapati ${num(book.pieces)} · pay ${inr(book.amount)} · still ${inr(book.unpaid)} · advance left ${inr(book.advanceLeft)}</p>
    <table>
      <thead><tr><th>Date</th><th>Attendance</th><th class="num">Chapati qty</th><th class="num">Rate</th><th class="num">Pay amount</th><th>Pay status</th><th class="num">Advance taken</th><th class="num">Advance cut</th></tr></thead>
      <tbody>${dayRows || '<tr><td colspan="8">No days in this period.</td></tr>'}</tbody>
    </table>
    <div class="sign"><div>Received by worker</div><div>For ${esc(state.settings.name)}</div></div>
  `
}

function walkInInvoiceBody(state, statement, title) {
  const rows = statement.sales.map((sale) => `<tr>
      <td>${esc(prettyDate(sale.date))}</td>
      <td>${esc(sale.no)}</td>
      <td>${itemText(state, sale.lines)}</td>
      <td>${esc(methodLabel(sale.method))}</td>
      <td class="num">${inr(sale.amount)}</td>
    </tr>`).join('')
  return `
    ${companyBlock(state.settings)}
    <h2>Walk-in invoice · ${esc(title)}</h2>
    <p><strong>${esc(statement.name)}</strong>${statement.phone ? ` · ${esc(statement.phone)}` : ''}</p>
    <table>
      <thead><tr><th>Date</th><th>Bill</th><th>Items</th><th>How</th><th class="num">Amount</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5">No walk-in sale in this period.</td></tr>'}</tbody>
      <tfoot>
        <tr><td colspan="4">Bills ${num(statement.bills)} · Chapati ${num(statement.pieces)}</td><td class="num">${inr(statement.amount)}</td></tr>
      </tfoot>
    </table>
    <div class="sign"><div>Received by customer</div><div>For ${esc(state.settings.name)}</div></div>
  `
}

export function Reports() {
  const { state } = useStore()
  const [mode, setMode] = useState('month')
  const [day, setDay] = useState(todayISO)
  const [month, setMonth] = useState(thisMonth)
  const [from, setFrom] = useState(addDaysISO(todayISO(), -6))
  const [to, setTo] = useState(todayISO())
  const [tab, setTab] = useState('shop')
  const [hotelId, setHotelId] = useState('')
  const [workerId, setWorkerId] = useState('')
  const [walkKey, setWalkKey] = useState('')
  const [hotelQuery, setHotelQuery] = useState('')
  const [workerQuery, setWorkerQuery] = useState('')
  const [walkQuery, setWalkQuery] = useState('')

  const bounds = boundsFor(mode, day, month, from, to)
  const summary = rangeSummary(state, bounds.from, bounds.to)
  const board = hotelOrderBoard(state, bounds.from, bounds.to)
  const makers = workerReport(state, bounds.from, bounds.to)
  const costs = costSummary(state.expenses.filter((expense) => between(expense.date, bounds.from, bounds.to)))
  const title = invoicePeriodLabel(mode, bounds, month)

  const hotelNeedle = hotelQuery.trim().toLowerCase()
  const hotels = state.hotels
    .filter((hotel) => hotel.active !== false)
    .filter((hotel) => {
      if (!hotelNeedle) return true
      return [hotel.name, hotel.contact, hotel.phone, hotel.address].join(' ').toLowerCase().includes(hotelNeedle)
    })
    .slice()
    .sort((a, b) => (a.contact || a.phone || '').localeCompare(b.contact || b.phone || ''))

  const workerNeedle = workerQuery.trim().toLowerCase()
  const workers = state.workers
    .filter((worker) => worker.active !== false)
    .filter((worker) => !workerNeedle || `${worker.name} ${worker.phone}`.toLowerCase().includes(workerNeedle))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))

  const walkNeedle = walkQuery.trim().toLowerCase()
  const walkIns = useMemo(() => {
    const map = new Map()
    for (const sale of state.sales.filter((row) => between(row.date, bounds.from, bounds.to))) {
      const key = walkInKey(sale)
      const current = map.get(key) || {
        key,
        name: sale.customerName || 'Walk-in',
        phone: sale.phone || '',
        bills: 0,
        amount: 0,
      }
      current.bills += 1
      current.amount += Number(sale.amount) || 0
      if (sale.customerName) current.name = sale.customerName
      if (sale.phone) current.phone = sale.phone
      map.set(key, current)
    }
    return [...map.values()]
      .filter((row) => !walkNeedle || `${row.name} ${row.phone}`.toLowerCase().includes(walkNeedle))
      .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name))
  }, [state.sales, bounds.from, bounds.to, walkNeedle])

  const hotelBill = useMemo(
    () => (hotelId ? hotelDayBook(state, hotelId, bounds.from, bounds.to) : null),
    [state, hotelId, bounds.from, bounds.to],
  )
  const workerBill = useMemo(
    () => (workerId ? workerDayBook(state, workerId, bounds.from, bounds.to) : null),
    [state, workerId, bounds.from, bounds.to],
  )
  const walkBill = useMemo(
    () => (walkKey ? walkInDayBook(state, walkKey, bounds.from, bounds.to) : null),
    [state, walkKey, bounds.from, bounds.to],
  )

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('erp-profile')
      if (!raw) return
      sessionStorage.removeItem('erp-profile')
      const saved = JSON.parse(raw)
      if (saved.kind === 'hotel' && saved.id) {
        setTab('hotel')
        setHotelId(saved.id)
      }
      if (saved.kind === 'worker' && saved.id) {
        setTab('worker')
        setWorkerId(saved.id)
      }
      if (saved.kind === 'walk' && saved.id) {
        setTab('walk')
        setWalkKey(saved.id)
      }
    } catch {
      /* ignore */
    }
  }, [])

  function printTotals() {
    const costRows = costs.map((row, index) => `<tr><td class="sno">${index + 1}</td><td>${esc(row.name)}</td><td class="num">${esc(qtyWithUnit(row.qty, row.unit))}</td><td class="num">${inr(row.amount)}</td></tr>`).join('')
    const workerRows = makers.map((row, index) => `<tr><td class="sno">${index + 1}</td><td>${esc(row.worker.name)}</td><td class="num">${num(row.pieces)}</td><td class="num">${inr(row.amount)}</td><td class="num">${inr(row.unpaid)}</td></tr>`).join('')
    printDocument(`Statement ${title}`, `
      ${companyBlock(state.settings)}
      <h2>Statement · ${esc(title)}</h2>
      <p>Orders ${num(board.orderCount)} · Hotels ordered ${board.orderedHotels} of ${board.hotels} · Chapati ${num(summary.pieces)} · Worker pay ${inr(summary.wages)} · Received ${inr(summary.collected)} · Costs ${inr(summary.costs)}</p>
      <h2>Costs</h2>
      <table><thead><tr><th class="sno">#</th><th>Item</th><th class="num">Quantity</th><th class="num">Price</th></tr></thead><tbody>${costRows || '<tr><td colspan="4">None</td></tr>'}</tbody></table>
      <h2>Workers</h2>
      <table><thead><tr><th class="sno">#</th><th>Name</th><th class="num">Chapati qty</th><th class="num">Pay amount</th><th class="num">Still to pay</th></tr></thead><tbody>${workerRows || '<tr><td colspan="5">None</td></tr>'}</tbody></table>
    `)
  }

  function excelTotals() {
    downloadExcel(`statement-${bounds.from}-to-${bounds.to}.csv`, [
      ['Statement', title],
      ['Orders', board.orderCount],
      ['Hotels ordered', board.orderedHotels],
      ['Hotels with no order', board.missingHotels],
      ['Chapati made', summary.pieces],
      ['Worker pay', summary.wages],
      ['Money received', summary.collected],
      ['Costs', summary.costs],
      [],
      ['Hotel contact', 'Phone', 'Address', 'Ordered', 'Orders', 'Amount'],
      ...board.rows.map((row) => [row.card.title, row.hotel.phone, row.hotel.address, row.ordered ? 'Yes' : 'No', row.orders.length, row.amount]),
    ])
  }

  function printHotel() {
    if (!hotelBill?.hotel) return
    printDocument(`Hotel invoice ${title}`, hotelInvoiceBody(state, hotelBill, title))
  }
  function pdfHotel() {
    if (!hotelBill?.hotel) return
    downloadPdf(`Hotel invoice ${title}`, hotelInvoiceBody(state, hotelBill, title))
  }
  function excelHotel() {
    if (!hotelBill?.hotel) return
    downloadExcel(`invoice-hotel-${hotelBill.hotel.phone || 'hotel'}-${bounds.from}.csv`, [
      ['Hotel invoice', title],
      ['Contact', hotelBill.hotel.contact],
      ['Phone', hotelBill.hotel.phone],
      ['Address', hotelBill.hotel.address],
      ['Billed', hotelBill.billed],
      ['Received in period', hotelBill.collected],
      ['Still due', hotelBill.balance],
      [],
      ['Date', 'Delivery', 'Challan', 'Note', 'Chapati qty', 'Bill amount', 'Received', 'How'],
      ...hotelBill.days.map((row) => [
        row.date,
        row.delivery,
        row.challans,
        row.notes,
        row.pieces,
        row.billed,
        row.paid,
        row.methods,
      ]),
    ])
  }

  function printWorker() {
    if (!workerBill?.worker) return
    printDocument(`Worker invoice ${title}`, workerInvoiceBody(state, workerBill, title))
  }
  function pdfWorker() {
    if (!workerBill?.worker) return
    downloadPdf(`Worker invoice ${title}`, workerInvoiceBody(state, workerBill, title))
  }
  function excelWorker() {
    if (!workerBill?.worker) return
    downloadExcel(`invoice-worker-${workerBill.worker.name}-${bounds.from}.csv`, [
      ['Worker invoice', title],
      ['Name', workerBill.worker.name],
      ['Phone', workerBill.worker.phone],
      ['Chapati', workerBill.pieces],
      ['Pay', workerBill.amount],
      ['Still to pay', workerBill.unpaid],
      ['Advance left', workerBill.advanceLeft],
      [],
      ['Date', 'Attendance', 'Chapati qty', 'Rate', 'Pay amount', 'Pay status', 'Advance taken', 'Advance cut'],
      ...workerBill.days.map((row) => [
        row.date,
        row.attendance,
        row.pieces,
        row.rate,
        row.amount,
        row.amount ? (row.due === 0 ? 'Paid' : row.paid ? 'Part paid' : 'Due') : '',
        row.advanceGiven,
        row.advanceCut,
      ]),
    ])
  }

  function printWalk() {
    if (!walkBill?.sales.length && !walkBill?.key) return
    printDocument(`Walk-in invoice ${title}`, walkInInvoiceBody(state, walkBill, title))
  }
  function pdfWalk() {
    if (!walkBill) return
    downloadPdf(`Walk-in invoice ${title}`, walkInInvoiceBody(state, walkBill, title))
  }
  function excelWalk() {
    if (!walkBill) return
    downloadExcel(`invoice-walkin-${walkBill.phone || walkBill.name}-${bounds.from}.csv`, [
      ['Walk-in invoice', title],
      ['Name', walkBill.name],
      ['Phone', walkBill.phone],
      ['Bills', walkBill.bills],
      ['Amount', walkBill.amount],
      [],
      ['Date', 'Bill', 'Items', 'How', 'Amount'],
      ...walkBill.sales.map((sale) => [
        sale.date,
        sale.no,
        sale.lines.map((line) => `${line.qty} ${byId(state.products, line.productId)?.name || ''}`).join(', '),
        methodLabel(sale.method),
        sale.amount,
      ]),
    ])
  }

  const tabs = [
    { id: 'shop', label: 'Shop totals' },
    { id: 'hotel', label: 'Hotel invoice' },
    { id: 'worker', label: 'Worker invoice' },
    { id: 'walk', label: 'Walk-in invoice' },
  ]

  return (
    <>
      <article className="card">
        <div className="card-head">
          <h2>Choose dates</h2>
          <div className="row-actions">
            <button className="btn" type="button" onClick={printTotals}>Print shop</button>
            <button className="btn" type="button" onClick={excelTotals}>Excel shop</button>
          </div>
        </div>
        <div className="row-actions">
          <button className={mode === 'day' ? 'btn on' : 'btn'} type="button" onClick={() => setMode('day')}>1 day</button>
          <button className={mode === 'days15' ? 'btn on' : 'btn'} type="button" onClick={() => setMode('days15')}>15 days</button>
          <button className={mode === 'month' ? 'btn on' : 'btn'} type="button" onClick={() => setMode('month')}>1 month</button>
          <button className={mode === 'week' ? 'btn on' : 'btn'} type="button" onClick={() => setMode('week')}>Week</button>
          <button className={mode === 'range' ? 'btn on' : 'btn'} type="button" onClick={() => setMode('range')}>Custom</button>
        </div>
        <div className="period-bar">
          {(mode === 'day' || mode === 'week' || mode === 'days15') && (
            <label className="field">Day<input type="date" value={day} onChange={(event) => event.target.value && setDay(event.target.value)} /></label>
          )}
          {mode === 'month' && <label className="field">Month<input type="month" value={month} onChange={(event) => event.target.value && setMonth(event.target.value)} /></label>}
          {mode === 'range' && (
            <>
              <label className="field">From<input type="date" value={from} onChange={(event) => event.target.value && setFrom(event.target.value)} /></label>
              <label className="field">To<input type="date" value={to} onChange={(event) => event.target.value && setTo(event.target.value)} /></label>
            </>
          )}
          <p className="muted" style={{ margin: '0 0 8px' }}>{title}</p>
        </div>
      </article>

      <article className="card">
        <p className="eyebrow">Print one invoice</p>
        <div className="stmt-tabs">
          {tabs.map((item) => (
            <button key={item.id} className={tab === item.id ? 'btn on' : 'btn'} type="button" onClick={() => setTab(item.id)}>
              {item.label}
            </button>
          ))}
        </div>

        {tab === 'shop' && (
          <>
            <section className="stats">
              <article className="stat"><span>Orders done</span><strong>{num(board.orderCount)}</strong><em>{board.orderedHotels} hotels ordered · {board.missingHotels} did not</em></article>
              <article className="stat"><span>Chapati made</span><strong>{num(summary.pieces)}</strong><em>Counted from workers</em></article>
              <article className="stat"><span>Money received</span><strong>{inr(summary.collected)}</strong><em>Walk-in {inr(summary.counterSales)}</em></article>
              <article className={summary.margin >= 0 ? 'stat good' : 'stat warn'}><span>Left</span><strong>{inr(summary.margin)}</strong><em>After pay {inr(summary.wages)} and costs {inr(summary.costs)}</em></article>
            </section>
            <h2 style={{ marginTop: 18 }}>Costs</h2>
            {costs.length === 0 && <p className="empty">No costs in this period.</p>}
            {costs.length > 0 && (
              <div className="table-wrap">
                <table className="data seq">
                  <thead><tr><th className="sno">#</th><th>Item</th><th className="num">Quantity</th><th className="num">Price</th></tr></thead>
                  <tbody>
                    {costs.map((row, index) => (
                      <tr key={`${row.name}-${row.unit}`}>
                        <td className="sno">{index + 1}</td>
                        <td>{row.name}</td>
                        <td className="num">{qtyWithUnit(row.qty, row.unit)}</td>
                        <td className="num">{inr(row.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr><td className="sno" /><td colSpan={2}>Total</td><td className="num">{inr(summary.costs)}</td></tr></tfoot>
                </table>
              </div>
            )}
            <h2 style={{ marginTop: 18 }}>Workers</h2>
            {makers.length === 0 && <p className="empty">No chapati counted in this period.</p>}
            {makers.length > 0 && (
              <div className="table-wrap">
                <table className="data seq">
                  <thead>
                    <tr>
                      <th className="sno">#</th>
                      <th>Name</th>
                      <th className="num">Chapati qty</th>
                      <th className="num">Pay amount</th>
                      <th className="num">Still to pay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {makers.map((row, index) => (
                      <tr key={row.worker.id}>
                        <td className="sno">{index + 1}</td>
                        <td>{row.worker.name}</td>
                        <td className="num">{num(row.pieces)}</td>
                        <td className="num">{inr(row.amount)}</td>
                        <td className="num">{inr(row.unpaid)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {tab === 'hotel' && (
          <div className="stmt-split">
            <div>
              <SearchBar className="wide" value={hotelQuery} onChange={setHotelQuery} placeholder="Search hotel, phone, address" />
              <div className="pick-list" style={{ marginTop: 10 }}>
                {hotels.length === 0 && <p className="empty" style={{ padding: 12 }}>No hotel matches.</p>}
                {hotels.map((hotel) => {
                  const card = hotelCard(hotel)
                  const mine = board.rows.find((row) => row.hotel.id === hotel.id)
                  return (
                    <button key={hotel.id} className={hotelId === hotel.id ? 'pick-row on' : 'pick-row'} type="button" onClick={() => setHotelId(hotel.id)}>
                      <span>
                        <strong>{card.title}</strong>
                        <small className="muted">{card.detail || 'No phone or address'}</small>
                      </span>
                      <span className="muted">{mine?.ordered ? `${num(mine.orders.length)} orders` : 'No order'}</span>
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="invoice-preview">
              {!hotelBill?.hotel && <p className="empty">Search and tap a hotel to see every day.</p>}
              {hotelBill?.hotel && (
                <>
                  <HotelProfile state={state} book={hotelBill} />
                  <div className="row-actions" style={{ marginTop: 12 }}>
                    <button className="btn primary" type="button" onClick={printHotel}>Print</button>
                    <button className="btn" type="button" onClick={pdfHotel}>PDF</button>
                    <button className="btn" type="button" onClick={excelHotel}>Excel</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {tab === 'worker' && (
          <div className="stmt-split">
            <div>
              <SearchBar className="wide" value={workerQuery} onChange={setWorkerQuery} placeholder="Search worker name or phone" />
              <div className="pick-list" style={{ marginTop: 10 }}>
                {workers.length === 0 && <p className="empty" style={{ padding: 12 }}>No worker matches.</p>}
                {workers.map((worker) => {
                  const row = makers.find((item) => item.worker.id === worker.id)
                  return (
                    <button key={worker.id} className={workerId === worker.id ? 'pick-row on' : 'pick-row'} type="button" onClick={() => setWorkerId(worker.id)}>
                      <span>
                        <strong>{worker.name}</strong>
                        <small className="muted">{worker.phone || 'No phone'}</small>
                      </span>
                      <span className="muted">{row ? `${num(row.pieces)} chapati` : 'No count'}</span>
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="invoice-preview">
              {!workerBill?.worker && <p className="empty">Search and tap a worker to see every day.</p>}
              {workerBill?.worker && (
                <>
                  <WorkerProfile book={workerBill} />
                  <div className="row-actions" style={{ marginTop: 12 }}>
                    <button className="btn primary" type="button" onClick={printWorker}>Print</button>
                    <button className="btn" type="button" onClick={pdfWorker}>PDF</button>
                    <button className="btn" type="button" onClick={excelWorker}>Excel</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {tab === 'walk' && (
          <div className="stmt-split">
            <div>
              <SearchBar className="wide" value={walkQuery} onChange={setWalkQuery} placeholder="Search walk-in name or phone" />
              <div className="pick-list" style={{ marginTop: 10 }}>
                {walkIns.length === 0 && <p className="empty" style={{ padding: 12 }}>No walk-in sale in this period.</p>}
                {walkIns.map((row) => (
                  <button key={row.key} className={walkKey === row.key ? 'pick-row on' : 'pick-row'} type="button" onClick={() => setWalkKey(row.key)}>
                    <span>
                      <strong>{row.name}</strong>
                      <small className="muted">{row.phone || 'No phone'}</small>
                    </span>
                    <span className="muted">{num(row.bills)} {row.bills === 1 ? 'bill' : 'bills'} · {inr(row.amount)}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="invoice-preview">
              {!walkBill && <p className="empty">Search and tap a customer to see every bill.</p>}
              {walkBill && (
                <>
                  <WalkInProfile state={state} book={walkBill} />
                  <div className="row-actions" style={{ marginTop: 12 }}>
                    <button className="btn primary" type="button" onClick={printWalk} disabled={!walkBill.sales.length}>Print</button>
                    <button className="btn" type="button" onClick={pdfWalk} disabled={!walkBill.sales.length}>PDF</button>
                    <button className="btn" type="button" onClick={excelWalk} disabled={!walkBill.sales.length}>Excel</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </article>
    </>
  )
}
