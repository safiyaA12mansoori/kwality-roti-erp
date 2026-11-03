import { useMemo, useState } from 'react'
import { PERSONAL_CATS, catColor, catName, personalSummary } from '../personal'
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
  thisMonth,
  todayISO,
  weekBounds,
} from '../format'
import { companyBlock, downloadExcel, downloadPdf, downloadWord, printDocument } from '../print'
import { useStore } from '../store'
import { Field } from '../ui'

function boundsFor(mode, date, month, from, to) {
  if (mode === 'day') return { from: date, to: date }
  if (mode === 'week') return weekBounds(date)
  if (mode === 'month') return monthBounds(month)
  if (mode === 'days15') return lastDaysBounds(date, 15)
  return { from: from <= to ? from : to, to: from <= to ? to : from }
}

function periodTitle(mode, bounds, month) {
  if (mode === 'day') return prettyDate(bounds.from)
  if (mode === 'days15') return `15 days · ${prettyDate(bounds.from)} to ${prettyDate(bounds.to)}`
  if (mode === 'month') return prettyMonth(month)
  if (mode === 'week') return `Week · ${prettyDate(bounds.from)} to ${prettyDate(bounds.to)}`
  return `${prettyDate(bounds.from)} to ${prettyDate(bounds.to)}`
}

function PeriodBar({ mode, setMode, month, setMonth, from, setFrom, to, setTo, date, setDate }) {
  return (
    <div className="dash-tools">
      <button className={mode === 'day' ? 'btn on' : 'btn'} type="button" onClick={() => setMode('day')}>1 day</button>
      <button className={mode === 'week' ? 'btn on' : 'btn'} type="button" onClick={() => setMode('week')}>Week</button>
      <button className={mode === 'month' ? 'btn on' : 'btn'} type="button" onClick={() => setMode('month')}>Month</button>
      <button className={mode === 'days15' ? 'btn on' : 'btn'} type="button" onClick={() => setMode('days15')}>15 days</button>
      <button className={mode === 'range' ? 'btn on' : 'btn'} type="button" onClick={() => setMode('range')}>Custom</button>
      {(mode === 'day' || mode === 'week' || mode === 'days15') && (
        <input type="date" value={date} onChange={(event) => event.target.value && setDate(event.target.value)} />
      )}
      {mode === 'month' && <input type="month" value={month} onChange={(event) => event.target.value && setMonth(event.target.value)} />}
      {mode === 'range' && (
        <>
          <input type="date" value={from} onChange={(event) => event.target.value && setFrom(event.target.value)} />
          <input type="date" value={to} onChange={(event) => event.target.value && setTo(event.target.value)} />
        </>
      )}
    </div>
  )
}

function invoiceBody(settings, title, snap) {
  const catRows = PERSONAL_CATS.map((item) => `<tr>
      <td>${esc(item.name)}</td>
      <td class="num">${inr(snap.byCat[item.id] || 0)}</td>
    </tr>`).join('')
  const spendRows = snap.expenses.map((row, index) => `<tr>
      <td class="sno">${index + 1}</td>
      <td>${esc(prettyDate(row.date))}</td>
      <td>${esc(row.no || '')}</td>
      <td>${esc(catName(row.category))}</td>
      <td>${esc(row.note || '—')}</td>
      <td>${esc(methodLabel(row.method))}</td>
      <td class="num">${inr(row.amount)}</td>
    </tr>`).join('')
  const inRows = snap.incomes.map((row, index) => `<tr>
      <td class="sno">${index + 1}</td>
      <td>${esc(prettyDate(row.date))}</td>
      <td>${esc(row.no || '')}</td>
      <td>${esc(row.source)}</td>
      <td>${esc(row.note || '—')}</td>
      <td>${esc(methodLabel(row.method))}</td>
      <td class="num">${inr(row.amount)}</td>
    </tr>`).join('')
  return `
    ${companyBlock(settings)}
    <h2>Owner personal invoice · ${esc(title)}</h2>
    <p>Money in ${inr(snap.income)} · Spent ${inr(snap.spent)} · Left in this period ${inr(snap.left)} · Balance available ${inr(snap.available)}</p>
    <h2>Head totals</h2>
    <table><thead><tr><th>Head</th><th class="num">Amount</th></tr></thead><tbody>${catRows}</tbody>
      <tfoot><tr><td>Total spent</td><td class="num">${inr(snap.spent)}</td></tr></tfoot>
    </table>
    <h2>Money in</h2>
    <table>
      <thead><tr><th class="sno">#</th><th>Date</th><th>Bill</th><th>From</th><th>Note</th><th>How</th><th class="num">Amount</th></tr></thead>
      <tbody>${inRows || '<tr><td colspan="7">No money in this period.</td></tr>'}</tbody>
    </table>
    <h2>Expenses</h2>
    <table>
      <thead><tr><th class="sno">#</th><th>Date</th><th>Bill</th><th>Head</th><th>Note</th><th>How</th><th class="num">Amount</th></tr></thead>
      <tbody>${spendRows || '<tr><td colspan="7">No expense in this period.</td></tr>'}</tbody>
      <tfoot><tr><td colspan="6">Total</td><td class="num">${inr(snap.spent)}</td></tr></tfoot>
    </table>
    <div class="sign"><div>Owner</div><div>Personal books</div></div>
  `
}

function oneBillBody(settings, row, kind) {
  const head = kind === 'in' ? row.source : catName(row.category)
  return `
    ${companyBlock(settings)}
    <h2>${kind === 'in' ? 'Money in receipt' : 'Expense invoice'} · ${esc(row.no || '')}</h2>
    <p><strong>${esc(prettyDate(row.date))}</strong> · ${esc(head)} · ${esc(methodLabel(row.method))}</p>
    <p>${esc(row.note || '')}</p>
    <table>
      <thead><tr><th>Particulars</th><th class="num">Amount</th></tr></thead>
      <tbody><tr><td>${esc(head)}</td><td class="num">${inr(row.amount)}</td></tr></tbody>
      <tfoot><tr><td>Total</td><td class="num">${inr(row.amount)}</td></tr></tfoot>
    </table>
    <div class="sign"><div>Received / paid</div><div>Owner</div></div>
  `
}

function exportOne(settings, row, kind, format) {
  const title = kind === 'in' ? `Receipt ${row.no}` : `Invoice ${row.no}`
  const body = oneBillBody(settings, row, kind)
  if (format === 'print') printDocument(title, body)
  if (format === 'word') downloadWord(`${kind}-${row.no}.doc`, title, body)
  if (format === 'excel') {
    downloadExcel(`${kind}-${row.no}.csv`, [
      [title],
      ['Date', row.date],
      ['Bill', row.no],
      ['Head', kind === 'in' ? row.source : catName(row.category)],
      ['Note', row.note || ''],
      ['How', methodLabel(row.method)],
      ['Amount', row.amount],
    ])
  }
}

export function OwnerHome() {
  const { state, date, setDate } = useStore()
  const [mode, setMode] = useState('month')
  const [month, setMonth] = useState(thisMonth())
  const [from, setFrom] = useState(addDaysISO(todayISO(), -6))
  const [to, setTo] = useState(todayISO())
  const bounds = boundsFor(mode, date, month, from, to)
  const title = periodTitle(mode, bounds, month)
  const snap = useMemo(
    () => personalSummary(state.personal, bounds.from, bounds.to),
    [state.personal, bounds.from, bounds.to],
  )
  const slices = PERSONAL_CATS
    .map((item) => ({ label: item.name, value: snap.byCat[item.id] || 0, color: item.color }))
    .filter((item) => item.value > 0)

  function exportAll(kind) {
    const body = invoiceBody(state.settings, title, snap)
    if (kind === 'print') printDocument(`Owner invoice ${title}`, body)
    if (kind === 'pdf') downloadPdf(`Owner invoice ${title}`, body)
    if (kind === 'word') downloadWord(`owner-invoice-${bounds.from}.doc`, `Owner invoice ${title}`, body)
    if (kind === 'excel') {
      downloadExcel(`owner-invoice-${bounds.from}.csv`, [
        ['Owner personal invoice', title],
        ['Money in', snap.income],
        ['Spent', snap.spent],
        ['Left in period', snap.left],
        ['Balance available', snap.available],
        [],
        ['Head', 'Amount'],
        ...PERSONAL_CATS.map((item) => [item.name, snap.byCat[item.id] || 0]),
        [],
        ['Date', 'Bill', 'Type', 'Head / From', 'Note', 'How', 'Amount'],
        ...snap.incomes.map((row) => [row.date, row.no, 'Money in', row.source, row.note, methodLabel(row.method), row.amount]),
        ...snap.expenses.map((row) => [row.date, row.no, 'Expense', catName(row.category), row.note, methodLabel(row.method), row.amount]),
      ])
    }
  }

  return (
    <div className="dash">
      <div className="dash-head">
        <div>
          <p className="dash-kicker">{title}</p>
          <p className="muted">Personal books only. Shop staff cannot see this.</p>
        </div>
        <PeriodBar mode={mode} setMode={setMode} month={month} setMonth={setMonth} from={from} setFrom={setFrom} to={to} setTo={setTo} date={date} setDate={setDate} />
      </div>
      <section className="stats">
        <article className="stat"><span>Money in</span><strong>{inr(snap.income)}</strong><em>This period</em></article>
        <article className="stat"><span>Spent</span><strong>{inr(snap.spent)}</strong><em>This period</em></article>
        <article className={snap.left >= 0 ? 'stat good' : 'stat warn'}><span>Left</span><strong>{inr(snap.left)}</strong><em>In minus out this period</em></article>
        <article className={snap.available >= 0 ? 'stat good' : 'stat warn'}><span>Balance available</span><strong>{inr(snap.available)}</strong><em>All money in minus all spend</em></article>
      </section>
      <section className="kpi-grid six" style={{ marginTop: 12 }}>
        {PERSONAL_CATS.map((item) => (
          <article className="kpi" key={item.id} style={{ '--kpi': item.color, background: `${item.color}18`, borderColor: `${item.color}66` }}>
            <div className="kpi-top"><span>{item.name}</span></div>
            <strong>{inr(snap.byCat[item.id] || 0)}</strong>
            <div className="kpi-foot"><small>This period</small></div>
          </article>
        ))}
      </section>
      {slices.length > 0 && (
        <article className="dash-card" style={{ marginTop: 12 }}>
          <h2>Spend mix</h2>
          <ul className="donut-legend">
            {slices.map((slice) => (
              <li key={slice.label}>
                <span className="swatch" style={{ background: slice.color }} />
                <div>
                  <strong>{slice.label}</strong>
                  <em>{inr(slice.value)}</em>
                </div>
              </li>
            ))}
          </ul>
        </article>
      )}
      <div className="row-actions" style={{ marginTop: 14 }}>
        <button className="btn primary" type="button" onClick={() => exportAll('print')}>Print invoice</button>
        <button className="btn" type="button" onClick={() => exportAll('pdf')}>PDF</button>
        <button className="btn" type="button" onClick={() => exportAll('word')}>Word</button>
        <button className="btn" type="button" onClick={() => exportAll('excel')}>Excel</button>
      </div>
    </div>
  )
}

export function OwnerSpend() {
  const { state, date, savePersonalExpense, deletePersonalExpense } = useStore()
  const [form, setForm] = useState({ category: 'emi', amount: '', note: '', method: 'cash' })
  const [error, setError] = useState('')
  const todayRows = (state.personal?.expenses || [])
    .filter((row) => row.date === date)
    .slice()
    .sort((a, b) => String(b.no).localeCompare(String(a.no)))
  const snap = personalSummary(state.personal, '2000-01-01', '2100-01-01')

  function add(event) {
    event.preventDefault()
    const result = savePersonalExpense({ ...form, date })
    if (!result.ok) {
      setError(result.reason)
      return
    }
    setError('')
    setForm({ ...form, amount: '', note: '' })
  }

  return (
    <>
      <article className="card">
        <h2>Add expense for {prettyDate(date)}</h2>
        <p className="muted">Balance available {inr(snap.available)}. Tap a head, type amount, save.</p>
        <form onSubmit={add}>
          <div className="stack">
            <div className="chip-row">
              {PERSONAL_CATS.map((item) => (
                <button
                  key={item.id}
                  className={form.category === item.id ? 'btn on' : 'btn'}
                  type="button"
                  onClick={() => setForm({ ...form, category: item.id })}
                  style={form.category === item.id ? { background: item.color, borderColor: item.color, color: 'white' } : {}}
                >
                  {item.name}
                </button>
              ))}
            </div>
            <div className="grid-2">
              <Field label="Amount">
                <input inputMode="decimal" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
              </Field>
              <Field label="Note">
                <input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="EMI bank, school fees..." />
              </Field>
            </div>
            <div className="method-grid">
              {['cash', 'upi', 'bank'].map((method) => (
                <button key={method} className={form.method === method ? 'btn on' : 'btn'} type="button" onClick={() => setForm({ ...form, method })}>
                  {methodLabel(method)}
                </button>
              ))}
            </div>
            {error && <p className="form-error">{error}</p>}
            <button className="btn primary" type="submit">Save {catName(form.category)}</button>
          </div>
        </form>
      </article>
      <article className="card">
        <h2>Today</h2>
        {todayRows.length === 0 && <p className="empty">No personal expense on this day.</p>}
        {todayRows.map((row) => (
          <div className="list-row" key={row.id}>
            <div>
              <strong>{row.no} · {catName(row.category)}</strong>
              <div className="muted">{row.note || methodLabel(row.method)}</div>
            </div>
            <div className="row-actions">
              <b>{inr(row.amount)}</b>
              <button className="btn danger" type="button" onClick={() => deletePersonalExpense(row.id)}>Remove</button>
            </div>
          </div>
        ))}
      </article>
    </>
  )
}

export function OwnerMoney() {
  const { state, date, savePersonalIncome, deletePersonalIncome } = useStore()
  const [form, setForm] = useState({ source: 'Salary', amount: '', note: '', method: 'cash' })
  const [error, setError] = useState('')
  const todayRows = (state.personal?.incomes || [])
    .filter((row) => row.date === date)
    .slice()
    .sort((a, b) => String(b.no).localeCompare(String(a.no)))
  const snap = personalSummary(state.personal, '2000-01-01', '2100-01-01')

  function add(event) {
    event.preventDefault()
    const result = savePersonalIncome({ ...form, date })
    if (!result.ok) {
      setError(result.reason)
      return
    }
    setError('')
    setForm({ ...form, amount: '', note: '' })
  }

  return (
    <>
      <article className="card">
        <h2>Add money in for {prettyDate(date)}</h2>
        <p className="muted">Put salary, shop cash, or any money that came in. Balance available {inr(snap.available)}.</p>
        <form onSubmit={add}>
          <div className="stack">
            <div className="chip-row">
              {['Salary', 'Shop cash', 'Family', 'Other'].map((source) => (
                <button key={source} className={form.source === source ? 'btn on' : 'btn'} type="button" onClick={() => setForm({ ...form, source })}>
                  {source}
                </button>
              ))}
            </div>
            <div className="grid-2">
              <Field label="From">
                <input value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })} />
              </Field>
              <Field label="Amount">
                <input inputMode="decimal" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
              </Field>
            </div>
            <Field label="Note">
              <input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
            </Field>
            <div className="method-grid">
              {['cash', 'upi', 'bank'].map((method) => (
                <button key={method} className={form.method === method ? 'btn on' : 'btn'} type="button" onClick={() => setForm({ ...form, method })}>
                  {methodLabel(method)}
                </button>
              ))}
            </div>
            {error && <p className="form-error">{error}</p>}
            <button className="btn primary" type="submit">Save money in</button>
          </div>
        </form>
      </article>
      <article className="card">
        <h2>Today</h2>
        {todayRows.length === 0 && <p className="empty">No money in on this day.</p>}
        {todayRows.map((row) => (
          <div className="list-row" key={row.id}>
            <div>
              <strong>{row.no} · {row.source}</strong>
              <div className="muted">{row.note || methodLabel(row.method)}</div>
            </div>
            <div className="row-actions">
              <b>{inr(row.amount)}</b>
              <button className="btn danger" type="button" onClick={() => deletePersonalIncome(row.id)}>Remove</button>
            </div>
          </div>
        ))}
      </article>
    </>
  )
}

export function OwnerBills() {
  const { state, date, setDate } = useStore()
  const [mode, setMode] = useState('month')
  const [month, setMonth] = useState(thisMonth())
  const [from, setFrom] = useState(addDaysISO(todayISO(), -6))
  const [to, setTo] = useState(todayISO())
  const bounds = boundsFor(mode, date, month, from, to)
  const title = periodTitle(mode, bounds, month)
  const snap = personalSummary(state.personal, bounds.from, bounds.to)

  function exportAll(kind) {
    const body = invoiceBody(state.settings, title, snap)
    if (kind === 'print') printDocument(`Owner invoice ${title}`, body)
    if (kind === 'pdf') downloadPdf(`Owner invoice ${title}`, body)
    if (kind === 'word') downloadWord(`owner-invoice-${bounds.from}.doc`, `Owner invoice ${title}`, body)
    if (kind === 'excel') {
      downloadExcel(`owner-bills-${bounds.from}.csv`, [
        ['Owner bills', title],
        ['Balance available', snap.available],
        [],
        ['Date', 'Bill', 'Type', 'Head / From', 'Note', 'How', 'Amount'],
        ...snap.incomes.map((row) => [row.date, row.no, 'Money in', row.source, row.note, methodLabel(row.method), row.amount]),
        ...snap.expenses.map((row) => [row.date, row.no, 'Expense', catName(row.category), row.note, methodLabel(row.method), row.amount]),
      ])
    }
  }

  return (
    <>
      <article className="card">
        <div className="card-head">
          <div>
            <p className="eyebrow">Owner bills</p>
            <h2>{title}</h2>
          </div>
          <PeriodBar mode={mode} setMode={setMode} month={month} setMonth={setMonth} from={from} setFrom={setFrom} to={to} setTo={setTo} date={date} setDate={setDate} />
        </div>
        <section className="stats">
          <article className="stat"><span>Money in</span><strong>{inr(snap.income)}</strong></article>
          <article className="stat"><span>Spent</span><strong>{inr(snap.spent)}</strong></article>
          <article className="stat good"><span>Balance available</span><strong>{inr(snap.available)}</strong></article>
        </section>
        <div className="row-actions" style={{ marginTop: 12 }}>
          <button className="btn primary" type="button" onClick={() => exportAll('print')}>Print all</button>
          <button className="btn" type="button" onClick={() => exportAll('pdf')}>PDF</button>
          <button className="btn" type="button" onClick={() => exportAll('word')}>Word</button>
          <button className="btn" type="button" onClick={() => exportAll('excel')}>Excel</button>
        </div>
      </article>
      <article className="card">
        <h2>Money in</h2>
        {snap.incomes.length === 0 && <p className="empty">No money in this period.</p>}
        {snap.incomes.map((row) => (
          <div className="list-row" key={row.id}>
            <div>
              <strong>{row.no} · {prettyDate(row.date)} · {row.source}</strong>
              <div className="muted">{row.note || methodLabel(row.method)}</div>
            </div>
            <div className="row-actions">
              <b>{inr(row.amount)}</b>
              <button className="btn" type="button" onClick={() => exportOne(state.settings, row, 'in', 'print')}>Print</button>
              <button className="btn" type="button" onClick={() => exportOne(state.settings, row, 'in', 'word')}>Word</button>
              <button className="btn" type="button" onClick={() => exportOne(state.settings, row, 'in', 'excel')}>Excel</button>
            </div>
          </div>
        ))}
      </article>
      <article className="card">
        <h2>Expenses</h2>
        {snap.expenses.length === 0 && <p className="empty">No expense in this period.</p>}
        {snap.expenses.map((row) => (
          <div className="list-row" key={row.id}>
            <div>
              <strong style={{ color: catColor(row.category) }}>{row.no} · {prettyDate(row.date)} · {catName(row.category)}</strong>
              <div className="muted">{row.note || methodLabel(row.method)}</div>
            </div>
            <div className="row-actions">
              <b>{inr(row.amount)}</b>
              <button className="btn" type="button" onClick={() => exportOne(state.settings, row, 'out', 'print')}>Print</button>
              <button className="btn" type="button" onClick={() => exportOne(state.settings, row, 'out', 'word')}>Word</button>
              <button className="btn" type="button" onClick={() => exportOne(state.settings, row, 'out', 'excel')}>Excel</button>
            </div>
          </div>
        ))}
      </article>
    </>
  )
}
