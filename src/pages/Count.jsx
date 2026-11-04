import { useState } from 'react'
import { daySummary, workerDay, workerPrice } from '../calc'
import { inr, num } from '../format'
import { useStore } from '../store'
import { Avatar, EmptyState, QtyStepper, SearchBar, go } from '../ui'

export function Count() {
  const { state, date, setProduction, setWorkerPaid } = useStore()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const products = state.products.filter((product) => product.active !== false)
  const product = products[0]
  const summary = daySummary(state, date)
  const needle = query.trim().toLowerCase()
  const workers = state.workers
    .filter((worker) => worker.active !== false)
    .filter((worker) => !needle || worker.name.toLowerCase().includes(needle) || worker.phone.includes(needle))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))

  if (!state.workers.filter((worker) => worker.active !== false).length) {
    return (
      <article className="card">
        <EmptyState
          title="No makers yet"
          text="Add workers first, then come back to count chapati."
          action={<button className="btn primary" type="button" onClick={() => go('workers')}>Open worker entry</button>}
        />
      </article>
    )
  }

  const shown = workers.filter((worker) => {
    const day = workerDay(state, date, worker.id)
    if (filter === 'open') return !day.rows.length
    if (filter === 'done') return day.rows.length > 0
    return true
  })

  return (
    <>
      <article className="card">
        <div className="card-head">
          <div>
            <p className="eyebrow">Today’s count</p>
            <h2>{summary.counted} of {summary.makers} counted</h2>
          </div>
          <SearchBar value={query} onChange={setQuery} placeholder="Search worker" />
        </div>
        <div className="chip-row">
          <button className={filter === 'all' ? 'btn on' : 'btn'} type="button" onClick={() => setFilter('all')}>All</button>
          <button className={filter === 'open' ? 'btn on' : 'btn'} type="button" onClick={() => setFilter('open')}>Not counted</button>
          <button className={filter === 'done' ? 'btn on' : 'btn'} type="button" onClick={() => setFilter('done')}>Counted</button>
        </div>
        <p className="muted">Type the count, then Save. Pay is count × {product ? inr(product.workerRate) : ''} (or the worker’s own rate).</p>
      </article>

      {shown.length === 0 && (
        <article className="card"><EmptyState title="No worker matches" text="Clear search or change the filter." /></article>
      )}

      <div className="count-grid">
        {shown.map((worker) => {
          const day = workerDay(state, date, worker.id)
          const qty = day.rows[0]?.qty || 0
          return (
            <article className={`wage-card ${day.paid ? 'paid' : day.rows.length ? 'due' : ''}`} key={worker.id}>
              <div className="wage-card-top">
                <Avatar name={worker.name} />
                <div>
                  <h3>{worker.name}</h3>
                  <div className="muted">{worker.phone || 'No phone'} · {inr(workerPrice(product, worker))} each</div>
                </div>
                {!day.rows.length && <span className="badge wait">Not counted</span>}
                {day.rows.length > 0 && !day.paid && <span className="badge due">To pay</span>}
                {day.paid && <span className="badge paid">Paid</span>}
              </div>
              <QtyStepper
                key={`${worker.id}-${date}`}
                value={qty}
                disabled={day.paid || !product}
                onCommit={(next) => product && setProduction(worker.id, product.id, next)}
              />
              <div className="wage-pay">
                <div>
                  <span className="muted">{num(day.pieces)} chapati</span>
                  <strong>{inr(day.amount)}</strong>
                </div>
                {day.paid && <button className="btn" type="button" onClick={() => setWorkerPaid(worker.id, false)}>Undo pay</button>}
              </div>
            </article>
          )
        })}
      </div>

      <div className="paybar">
        <div>
          <span>{summary.counted} of {summary.makers} makers counted</span>
          <strong>{inr(summary.wages)}</strong>
        </div>
        <button className="btn good" type="button" onClick={() => go('wages')}>Pay workers</button>
      </div>
    </>
  )
}
