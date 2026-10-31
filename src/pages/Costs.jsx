import { useState } from 'react'
import { between, costSummary, sum } from '../calc'
import { COST_ITEMS, OTHER_UNITS, costItem } from '../costs'
import { addDaysISO, inr, monthBounds, prettyDate, prettyMonth, qtyWithUnit, thisMonth, todayISO } from '../format'
import { useStore } from '../store'
import { Field } from '../ui'

const blank = { itemId: 'flour', customName: '', unit: 'kg', qty: '', amount: '' }

export function Costs() {
  const { state, date, saveExpense, deleteExpense } = useStore()
  const [form, setForm] = useState(blank)
  const [error, setError] = useState('')
  const [view, setView] = useState('day')
  const [month, setMonth] = useState(thisMonth)
  const [from, setFrom] = useState(addDaysISO(todayISO(), -6))
  const [to, setTo] = useState(todayISO())
  const selected = costItem(form.itemId)
  const unit = form.itemId === 'other' ? form.unit : selected.unit
  const bounds = view === 'day'
    ? { from: date, to: date }
    : view === 'month'
      ? monthBounds(month)
      : { from: from <= to ? from : to, to: from <= to ? to : from }
  const rows = state.expenses
    .filter((expense) => between(expense.date, bounds.from, bounds.to))
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name))
  const grouped = costSummary(rows)
  const total = sum(rows, (expense) => expense.amount)
  const title = view === 'day'
    ? prettyDate(date)
    : view === 'month'
      ? prettyMonth(month)
      : `${prettyDate(bounds.from)} to ${prettyDate(bounds.to)}`

  function add(event) {
    event.preventDefault()
    const result = saveExpense({
      date,
      itemId: form.itemId,
      name: form.itemId === 'other' ? form.customName : selected.name,
      unit,
      qty: form.qty,
      amount: form.amount,
    })
    if (!result.ok) {
      setError(result.reason)
      return
    }
    setError('')
    setForm({ ...form, customName: '', qty: '', amount: '' })
  }

  return (
    <>
      <article className="card">
        <h2>Add cost for {prettyDate(date)}</h2>
        <p className="muted">Select the item, type quantity, type the price, then Add. Use the date at the top for another day.</p>
        <form onSubmit={add}>
          <div className="cost-form">
            <Field label="Item">
              <div className="chip-row">
                {COST_ITEMS.map((item) => (
                  <button
                    key={item.id}
                    className={form.itemId === item.id ? 'btn on' : 'btn'}
                    type="button"
                    onClick={() => setForm({ ...form, itemId: item.id })}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            </Field>
            {form.itemId === 'other' && (
              <Field label="Write the name of the other thing">
                <input
                  value={form.customName}
                  onChange={(event) => setForm({ ...form, customName: event.target.value })}
                  placeholder="Salt, soap, repair…"
                />
              </Field>
            )}
            {form.itemId === 'other' && (
              <Field label="Quantity unit">
                <select value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })}>
                  {OTHER_UNITS.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </Field>
            )}
            <Field label={selected.qtyLabel || (unit ? `Quantity (${unit})` : 'Quantity')}>
              <input
                inputMode="decimal"
                value={form.qty}
                placeholder={unit === 'kg' ? '50' : unit === 'liter' ? '4' : '1'}
                onChange={(event) => setForm({ ...form, qty: event.target.value })}
              />
            </Field>
            <Field label="Price">
              <input
                inputMode="decimal"
                value={form.amount}
                placeholder="0"
                onChange={(event) => setForm({ ...form, amount: event.target.value })}
              />
            </Field>
            <button className="btn primary" type="submit">Add</button>
          </div>
          {error && <p className="form-error">{error}</p>}
        </form>
      </article>

      <article className="card">
        <div className="card-head">
          <h2>{title}</h2>
          <div className="row-actions">
            <button className={view === 'day' ? 'btn on' : 'btn'} type="button" onClick={() => setView('day')}>One day</button>
            <button className={view === 'month' ? 'btn on' : 'btn'} type="button" onClick={() => setView('month')}>One month</button>
            <button className={view === 'range' ? 'btn on' : 'btn'} type="button" onClick={() => setView('range')}>Any dates</button>
          </div>
        </div>
        <div className="row-actions" style={{ marginTop: 10 }}>
          {view === 'month' && (
            <label className="field">Month
              <input className="search" type="month" value={month} onChange={(event) => event.target.value && setMonth(event.target.value)} />
            </label>
          )}
          {view === 'range' && (
            <>
              <label className="field">From
                <input type="date" value={from} onChange={(event) => event.target.value && setFrom(event.target.value)} />
              </label>
              <label className="field">To
                <input type="date" value={to} onChange={(event) => event.target.value && setTo(event.target.value)} />
              </label>
            </>
          )}
        </div>
        <p className="muted">Total price {inr(total)}</p>
        {rows.length === 0 && <p className="empty">Nothing saved for this period.</p>}
        {rows.length > 0 && (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  {view !== 'day' && <th>Date</th>}
                  <th>Item</th>
                  <th className="num">Quantity</th>
                  <th className="num">Price</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((expense) => (
                  <tr key={expense.id}>
                    {view !== 'day' && <td>{prettyDate(expense.date)}</td>}
                    <td>{expense.name}</td>
                    <td className="num">{qtyWithUnit(expense.qty, expense.unit)}</td>
                    <td className="num">{inr(expense.amount)}</td>
                    <td>
                      <button className="btn danger" type="button" onClick={() => deleteExpense(expense.id)}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {grouped.length > 0 && (
          <>
            <h2 style={{ marginTop: 18 }}>Total quantity and price</h2>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="num">Quantity</th>
                    <th className="num">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped.map((row) => (
                    <tr key={`${row.name}-${row.unit}`}>
                      <td>{row.name}</td>
                      <td className="num">{qtyWithUnit(row.qty, row.unit)}</td>
                      <td className="num">{inr(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2}>Total price</td>
                    <td className="num">{inr(total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </article>
    </>
  )
}
