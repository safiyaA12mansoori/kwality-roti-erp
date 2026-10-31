import { useMemo, useState } from 'react'
import { advanceBalance, byId, rangeSummary, workerDayBook, workerSpan } from '../calc'
import {
  addDaysISO,
  esc,
  inr,
  lastDaysBounds,
  methodLabel,
  num,
  prettyDate,
  todayISO,
  weekBounds,
} from '../format'
import { companyBlock, printDocument } from '../print'
import { useStore } from '../store'
import { Field, Modal, SearchBar, go } from '../ui'

const METHODS = [
  { id: 'cash', label: 'Cash' },
  { id: 'upi', label: 'UPI' },
  { id: 'bank', label: 'Bank' },
]

function boundsFor(mode, day, from, to) {
  if (mode === 'week') return weekBounds(day)
  if (mode === 'days15') return lastDaysBounds(day, 15)
  if (mode === 'range') return { from: from <= to ? from : to, to: from <= to ? to : from }
  return { from: day, to: day }
}

function periodLabel(mode, bounds) {
  if (mode === 'day') return prettyDate(bounds.from)
  if (mode === 'week') return `Week · ${prettyDate(bounds.from)} to ${prettyDate(bounds.to)}`
  if (mode === 'days15') return `15 days · ${prettyDate(bounds.from)} to ${prettyDate(bounds.to)}`
  return `${prettyDate(bounds.from)} to ${prettyDate(bounds.to)}`
}

export function Wages() {
  const { state, date, setWorkerPaid, payAllUnpaid, payWage } = useStore()
  const [mode, setMode] = useState('day')
  const [from, setFrom] = useState(addDaysISO(date || todayISO(), -6))
  const [to, setTo] = useState(date || todayISO())
  const [query, setQuery] = useState('')
  const [paying, setPaying] = useState(null)
  const [bulk, setBulk] = useState(null)
  const bounds = boundsFor(mode, date, from, to)
  const title = periodLabel(mode, bounds)
  const summary = rangeSummary(state, bounds.from, bounds.to)
  const products = state.products
  const needle = query.trim().toLowerCase()
  const workers = state.workers
    .filter((worker) => worker.active !== false)
    .filter((worker) => !needle || worker.name.toLowerCase().includes(needle) || worker.phone.includes(needle))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))

  const spans = useMemo(
    () => workers.map((worker) => ({ worker, span: workerSpan(state, worker.id, bounds.from, bounds.to) })),
    [workers, state, bounds.from, bounds.to],
  )
  const counted = spans.filter((row) => row.span.rows.length > 0)
  const pending = counted.filter((row) => row.span.unpaid > 0)
  const missing = workers.filter((worker) => !counted.some((row) => row.worker.id === worker.id))
  const paidCount = counted.filter((row) => row.span.paid).length

  function printSheet() {
    const rows = counted.map(({ worker, span }) => {
      const detail = span.rows
        .map((row) => `${esc(prettyDate(row.date))} ${num(row.qty)} ${esc(byId(products, row.productId)?.name || '')} × ${inr(row.rate)}${row.paid ? ` · ${esc(methodLabel(row.payMethod))}` : ''}`)
        .join('<br>')
      return `<tr>
        <td>${esc(worker.name)}</td>
        <td>${detail}</td>
        <td class="num">${num(span.pieces)}</td>
        <td class="num">${inr(span.amount)}</td>
        <td>${span.paid ? esc(span.methods.map(methodLabel).join(', ') || 'Paid') : span.partial ? 'Part paid' : 'Due'}</td>
        <td></td>
      </tr>`
    }).join('')
    printDocument(`Wages ${title}`, `
      ${companyBlock(state.settings)}
      <h2>Wage sheet · ${esc(title)}</h2>
      <p class="muted">Paid per piece. Cash, UPI, or bank. Each maker signs after receiving money.</p>
      <table>
        <thead><tr><th>Maker</th><th>Count</th><th class="num">Pieces</th><th class="num">Wage</th><th>Status</th><th>Signature</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td colspan="3">Total</td><td class="num">${inr(summary.wages)}</td><td colspan="2"></td></tr></tfoot>
      </table>
    `)
  }

  function openPay(worker, span) {
    const advance = advanceBalance(state, worker.id)
    const book = workerDayBook(state, worker.id, bounds.from, bounds.to)
    setPaying({
      workerId: worker.id,
      name: worker.name,
      salary: span.unpaid,
      pieces: span.unpaidPieces,
      dayCount: span.days.length,
      days: book.days,
      presentDays: book.presentDays,
      absentDays: book.absentDays,
      advance,
      method: 'cash',
      mode: advance > 0 ? 'partial' : 'full',
      deduct: advance > 0 ? String(Math.min(advance, span.unpaid)) : '0',
    })
  }

  return (
    <>
      <article className="card">
        <p className="eyebrow">Pay period</p>
        <h2>{title}</h2>
        <div className="row-actions" style={{ marginBottom: 10 }}>
          <button className={mode === 'day' ? 'btn on' : 'btn'} type="button" onClick={() => setMode('day')}>1 day</button>
          <button className={mode === 'week' ? 'btn on' : 'btn'} type="button" onClick={() => setMode('week')}>1 week</button>
          <button className={mode === 'days15' ? 'btn on' : 'btn'} type="button" onClick={() => setMode('days15')}>15 days</button>
          <button className={mode === 'range' ? 'btn on' : 'btn'} type="button" onClick={() => setMode('range')}>Custom</button>
          <SearchBar value={query} onChange={setQuery} placeholder="Search worker" />
          <button className="btn" type="button" onClick={printSheet}>Print wage sheet</button>
        </div>
        {mode === 'range' && (
          <div className="period-bar">
            <label className="field">From<input type="date" value={from} onChange={(event) => event.target.value && setFrom(event.target.value)} /></label>
            <label className="field">To<input type="date" value={to} onChange={(event) => event.target.value && setTo(event.target.value)} /></label>
          </div>
        )}
        {mode !== 'range' && (
          <p className="muted" style={{ marginTop: 10 }}>Uses the working day on the top right. Change that date to move the period.</p>
        )}
        <section className="wage-kpis">
          <article className="stat"><span>Waiting</span><strong>{inr(summary.wagesDue)}</strong><em>{pending.length} makers still to pay</em></article>
          <article className="stat good"><span>Already paid</span><strong>{inr(summary.wages - summary.wagesDue)}</strong><em>{paidCount} makers settled</em></article>
          <article className="stat"><span>Chapati</span><strong>{num(summary.pieces)}</strong><em>{counted.length} counted · {missing.length} not counted</em></article>
        </section>
      </article>

      {missing.length > 0 && mode === 'day' && (
        <div className="banner">
          <p>Still no count for {missing.map((worker) => worker.name).join(', ')}.</p>
          <button className="btn" type="button" onClick={() => go('count')}>Open day count</button>
        </div>
      )}

      {counted.length === 0 && (
        <article className="card"><p className="empty">No chapati counted in this period.</p></article>
      )}

      <div className="wage-grid">
        {counted.map(({ worker, span }) => {
          const advance = advanceBalance(state, worker.id)
          const tone = span.paid ? 'paid' : span.partial ? 'partial' : 'due'
          return (
            <article className={`wage-card ${tone}`} key={worker.id}>
              <div className="wage-card-top">
                <div className="wage-avatar">{worker.name.slice(0, 1)}</div>
                <div>
                  <h3>{worker.name}</h3>
                  <div className="muted">{worker.phone || 'No phone'}</div>
                  <div className="muted">
                    {num(span.pieces)} chapati · {span.days.length} {span.days.length === 1 ? 'day' : 'days'}
                  </div>
                  {advance > 0 && <div className="muted">Advance left {inr(advance)}</div>}
                </div>
                {span.paid && <span className="badge paid">{span.methods.map(methodLabel).join(' · ') || 'Paid'}</span>}
                {span.partial && <span className="badge due">Part paid</span>}
                {!span.paid && !span.partial && <span className="badge wait">To pay</span>}
              </div>
              <div className="muted">
                {span.rows.slice(0, 3).map((row) => `${prettyDate(row.date)} · ${num(row.qty)} × ${inr(row.rate)}`).join(' · ')}
                {span.rows.length > 3 ? ` · +${span.rows.length - 3} more` : ''}
              </div>
              <div className="wage-pay">
                <div>
                  <span className="muted">{span.unpaid > 0 ? 'Still to hand over' : 'Paid'}</span>
                  <strong>{inr(span.unpaid > 0 ? span.unpaid : span.amount)}</strong>
                </div>
                <div className="row-actions">
                  {span.unpaid > 0 && (
                    <button className="btn good" type="button" onClick={() => openPay(worker, span)}>Pay</button>
                  )}
                  {(span.paid || span.partial) && (
                    <button className="btn" type="button" onClick={() => setWorkerPaid(worker.id, false, bounds)}>Undo</button>
                  )}
                </div>
              </div>
            </article>
          )
        })}
      </div>

      <div className="paybar">
        <div>
          <span>{pending.length} makers waiting · {title}</span>
          <strong>{inr(summary.wagesDue)}</strong>
        </div>
        <button
          className="btn good"
          type="button"
          disabled={!summary.wagesDue}
          onClick={() => setBulk({ method: 'cash' })}
        >
          Pay everyone
        </button>
      </div>

      {paying && (
        <PayModal
          paying={paying}
          setPaying={setPaying}
          title={title}
          onClose={() => setPaying(null)}
          onSave={(form) => {
            const deduct = form.mode === 'full' ? 0 : form.mode === 'all' ? Math.min(form.advance, form.salary) : Number(form.deduct) || 0
            payWage(form.workerId, deduct, { from: bounds.from, to: bounds.to, method: form.method })
            setPaying(null)
          }}
        />
      )}
      {bulk && (
        <Modal title="Pay everyone" onClose={() => setBulk(null)}>
          <div className="stack">
            <p>Pay {inr(summary.wagesDue)} to {pending.length} makers for {title}. Advance is not cut on this bulk pay.</p>
            <p className="muted">How will you pay?</p>
            <div className="method-grid">
              {METHODS.map((item) => (
                <button
                  key={item.id}
                  className={bulk.method === item.id ? 'btn on' : 'btn'}
                  type="button"
                  onClick={() => setBulk({ method: item.id })}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <button
              className="btn primary"
              type="button"
              onClick={() => {
                payAllUnpaid({ from: bounds.from, to: bounds.to, method: bulk.method })
                setBulk(null)
              }}
            >
              Pay {inr(summary.wagesDue)} by {methodLabel(bulk.method)}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}

function PayModal({ paying, setPaying, title, onClose, onSave }) {
  const deduct = paying.mode === 'full'
    ? 0
    : paying.mode === 'all'
      ? Math.min(paying.advance, paying.salary)
      : Math.min(Math.max(0, Number(paying.deduct) || 0), paying.advance, paying.salary)
  const hand = Math.max(0, paying.salary - deduct)
  const left = Math.max(0, paying.advance - deduct)
  return (
    <Modal title={`Pay ${paying.name}`} onClose={onClose}>
      <div className="stack">
        <p>
          {title} · {num(paying.pieces)} chapati · salary due {inr(paying.salary)}
        </p>
        <p className="muted">
          Present {num(paying.presentDays || 0)} days · absent {num(paying.absentDays || 0)} days · advance left {inr(paying.advance)}.
        </p>
        {paying.days?.length > 0 && (
          <div className="table-wrap pay-days">
            <table className="data seq">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Attendance</th>
                  <th className="num">Chapati</th>
                  <th className="num">Earned</th>
                </tr>
              </thead>
              <tbody>
                {paying.days.map((row) => (
                  <tr key={row.date} className={row.pieces || row.present != null ? '' : 'dim-row'}>
                    <td>{prettyDate(row.date)}</td>
                    <td>
                      {row.attendance === 'Present' && <span className="badge paid">Present</span>}
                      {row.attendance === 'Absent' && <span className="badge due">Absent</span>}
                      {row.attendance === 'Not marked' && <span className="badge off">Not marked</span>}
                    </td>
                    <td className="num">{row.pieces ? num(row.pieces) : '—'}</td>
                    <td className="num">{row.amount ? inr(row.amount) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted">How will you pay?</p>
        <div className="method-grid">
          {METHODS.map((item) => (
            <button
              key={item.id}
              className={paying.method === item.id ? 'btn on' : 'btn'}
              type="button"
              onClick={() => setPaying({ ...paying, method: item.id })}
            >
              {item.label}
            </button>
          ))}
        </div>
        <label className="check">
          <input type="radio" checked={paying.mode === 'full'} onChange={() => setPaying({ ...paying, mode: 'full' })} />
          Pay full salary (do not cut advance)
        </label>
        {paying.advance > 0 && (
          <label className="check">
            <input type="radio" checked={paying.mode === 'all'} onChange={() => setPaying({ ...paying, mode: 'all' })} />
            Deduct as much advance as this salary allows
          </label>
        )}
        {paying.advance > 0 && (
          <label className="check">
            <input type="radio" checked={paying.mode === 'partial'} onChange={() => setPaying({ ...paying, mode: 'partial' })} />
            Deduct this amount from salary of the advance
          </label>
        )}
        {paying.mode === 'partial' && paying.advance > 0 && (
          <Field label="Deduct from this salary">
            <input
              inputMode="decimal"
              value={paying.deduct}
              onChange={(event) => setPaying({ ...paying, deduct: event.target.value })}
            />
          </Field>
        )}
        <p>Hand over <strong>{inr(hand)}</strong> by {methodLabel(paying.method)}. Advance remaining <strong>{inr(left)}</strong>.</p>
        <button className="btn primary" type="button" onClick={() => onSave(paying)}>Save {methodLabel(paying.method)} payment</button>
      </div>
    </Modal>
  )
}
