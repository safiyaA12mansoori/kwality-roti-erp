import { useMemo, useState } from 'react'
import { BarChart, Donut, Spark } from '../charts'
import { costSummary, hotelBalance, hotelOrderBoard, rangeSummary, shopSnapshot, unpaidBills } from '../calc'
import {
  addDaysISO,
  compactInr,
  inr,
  lastDaysBounds,
  monthBounds,
  num,
  pctChange,
  prettyDate,
  previousBounds,
  qtyWithUnit,
  shiftMonth,
  shortMonth,
  thisMonth,
  todayISO,
  weekBounds,
} from '../format'
import { useStore } from '../store'
import { go } from '../ui'

const COLORS = {
  hotels: '#7c5cfc',
  wages: '#e11d48',
  expense: '#ea580c',
  raw: '#0f9b8e',
  money: '#16a34a',
  dues: '#2563eb',
}

function boundsFor(mode, date, month, from, to) {
  if (mode === 'day') return { from: date, to: date }
  if (mode === 'week') return weekBounds(date)
  if (mode === 'month') return monthBounds(month)
  if (mode === 'days15') return lastDaysBounds(date, 15)
  return { from: from <= to ? from : to, to: from <= to ? to : from }
}

function sparkDays(state, end, pick) {
  return Array.from({ length: 7 }, (_, index) => {
    const day = addDaysISO(end, -(6 - index))
    return pick(shopSnapshot(state, day, day))
  })
}

export function Today() {
  const { state, date } = useStore()
  const [mode, setMode] = useState('month')
  const [month, setMonth] = useState(thisMonth)
  const [from, setFrom] = useState(addDaysISO(todayISO(), -6))
  const [to, setTo] = useState(todayISO())
  const [tab, setTab] = useState('hotels')
  const bounds = boundsFor(mode, date, month, from, to)
  const snap = useMemo(() => shopSnapshot(state, bounds.from, bounds.to), [state, bounds.from, bounds.to])
  const prev = useMemo(() => {
    const span = previousBounds(bounds.from, bounds.to)
    return shopSnapshot(state, span.from, span.to)
  }, [state, bounds.from, bounds.to])
  const summary = useMemo(() => rangeSummary(state, bounds.from, bounds.to), [state, bounds.from, bounds.to])
  const board = useMemo(() => hotelOrderBoard(state, bounds.from, bounds.to), [state, bounds.from, bounds.to])
  const costs = useMemo(
    () => costSummary(state.expenses.filter((expense) => expense.date >= bounds.from && expense.date <= bounds.to)),
    [state.expenses, bounds.from, bounds.to],
  )
  const rawRows = costs.filter((row) => /flour|ghee|gas|pack/i.test(row.name))
  const expenseRows = costs.filter((row) => !/flour|ghee|gas|pack/i.test(row.name))
  const dues = state.hotels
    .map((hotel) => ({ hotel, balance: hotelBalance(state, hotel.id) }))
    .filter((row) => row.balance > 0)
    .sort((a, b) => b.balance - a.balance)
  const waiting = useMemo(() => unpaidBills(state), [state])
  const vsLabel = mode === 'day' ? 'vs yesterday' : 'vs last period'
  const months = Array.from({ length: 6 }, (_, index) => shiftMonth(thisMonth(), index - 5))
  const monthSnap = months.map((key) => {
    const span = monthBounds(key)
    return shopSnapshot(state, span.from, span.to)
  })
  const title = bounds.from === bounds.to
    ? prettyDate(bounds.from)
    : `${prettyDate(bounds.from)} to ${prettyDate(bounds.to)}`

  const cards = [
    {
      label: 'Hotels entry',
      display: num(snap.hotels),
      extra: `${num(snap.hotelOrders)} orders · ${num(snap.hotelMissing)} no order`,
      delta: pctChange(snap.hotelOrders, prev.hotelOrders),
      color: COLORS.hotels,
      spark: sparkDays(state, bounds.to, (row) => row.hotelOrders),
      open: 'orders',
    },
    {
      label: 'Workers payment',
      display: compactInr(snap.wages),
      extra: `${num(snap.workers)} makers · still ${inr(snap.wagesDue)}`,
      delta: pctChange(snap.wages, prev.wages),
      color: COLORS.wages,
      spark: sparkDays(state, bounds.to, (row) => row.wages),
      open: 'wages',
    },
    {
      label: 'Expense',
      display: compactInr(snap.expense),
      extra: 'Electric bill, transport, other',
      delta: pctChange(snap.expense, prev.expense),
      color: COLORS.expense,
      spark: sparkDays(state, bounds.to, (row) => row.expense),
      open: 'costs',
    },
    {
      label: 'Raw material',
      display: compactInr(snap.raw),
      extra: 'Flour, ghee, gas, packing',
      delta: pctChange(snap.raw, prev.raw),
      color: COLORS.raw,
      spark: sparkDays(state, bounds.to, (row) => row.raw),
      open: 'costs',
    },
    {
      label: 'Money received',
      display: compactInr(snap.collected),
      extra: `Shop ${inr(snap.walkIn)} · hotels paid rest`,
      delta: pctChange(snap.collected, prev.collected),
      color: COLORS.money,
      spark: sparkDays(state, bounds.to, (row) => row.collected),
      open: 'counter',
    },
    {
      label: 'Hotel dues',
      display: compactInr(snap.dues),
      extra: `${num(dues.length)} hotels still to pay`,
      delta: pctChange(snap.dues, prev.dues),
      color: COLORS.dues,
      spark: sparkDays(state, bounds.to, (row) => row.dues),
      open: 'orders',
    },
  ]

  const slices = [
    { label: 'Money received', value: snap.collected, color: COLORS.money },
    { label: 'Workers payment', value: snap.wages, color: COLORS.wages },
    { label: 'Raw material', value: snap.raw, color: COLORS.raw },
    { label: 'Expense', value: snap.expense, color: COLORS.expense },
  ]

  return (
    <div className="dash">
      <div className="dash-head">
        <div>
          <p className="dash-kicker">{title}</p>
          <p className="muted">Hotels, worker pay, raw material, expense, and money received for this shop.</p>
        </div>
        <div className="dash-tools">
          <button className={mode === 'day' ? 'btn on' : 'btn'} type="button" onClick={() => setMode('day')}>Day</button>
          <button className={mode === 'week' ? 'btn on' : 'btn'} type="button" onClick={() => setMode('week')}>Week</button>
          <button className={mode === 'month' ? 'btn on' : 'btn'} type="button" onClick={() => setMode('month')}>Month</button>
          <button className={mode === 'days15' ? 'btn on' : 'btn'} type="button" onClick={() => setMode('days15')}>15 days</button>
          <button className={mode === 'range' ? 'btn on' : 'btn'} type="button" onClick={() => setMode('range')}>Custom</button>
          {mode === 'month' && <input type="month" value={month} onChange={(event) => event.target.value && setMonth(event.target.value)} />}
          {mode === 'range' && (
            <>
              <input type="date" value={from} onChange={(event) => event.target.value && setFrom(event.target.value)} />
              <input type="date" value={to} onChange={(event) => event.target.value && setTo(event.target.value)} />
            </>
          )}
        </div>
      </div>

      <section className={waiting.rows.length ? 'due-board live' : 'due-board clear'}>
        <div className="due-board-head">
          <span className={waiting.rows.length ? 'pulse-dot' : 'pulse-dot ok'} />
          {waiting.rows.length ? (
            <div>
              <strong>Waiting for payment</strong>
              <p>
                {waiting.parties === 1 ? '1 party' : `${num(waiting.parties)} parties`}
                {waiting.catering ? ` · ${num(waiting.catering)} catering` : ''}
                {` still to pay ${inr(waiting.total)}`}
              </p>
            </div>
          ) : (
            <div>
              <strong>All hotel and catering bills are paid</strong>
              <p>No pending order is waiting for money.</p>
            </div>
          )}
          {waiting.rows.length > 0 && (
            <button className="btn good" type="button" onClick={() => go('orders')}>Collect now</button>
          )}
        </div>
        {waiting.rows.length > 0 && (
          <div className="due-track" style={{ '--due-speed': `${Math.max(16, waiting.rows.length * 5)}s` }}>
            <div className="due-track-inner">
              {[0, 1].flatMap((copy) => waiting.rows.map((row) => (
                <button
                  className={`due-chip ${row.kind === 'Catering' ? 'cater' : 'hotel'}`}
                  type="button"
                  key={`${copy}-${row.id}`}
                  onClick={() => go('orders')}
                >
                  <span className="due-kind">{row.kind}{row.pending ? ' · pending' : ''}</span>
                  <strong>{row.card.title}</strong>
                  <em>{row.no} · {prettyDate(row.date)}</em>
                  <b>{inr(row.due)}</b>
                </button>
              )))}
            </div>
          </div>
        )}
      </section>

      <section className="kpi-grid six">
        {cards.map((card) => (
          <button
            className="kpi"
            type="button"
            key={card.label}
            onClick={() => go(card.open)}
            style={{ '--kpi': card.color, background: `${card.color}18`, borderColor: `${card.color}66` }}
          >
            <div className="kpi-top">
              <span>{card.label}</span>
              <Spark values={card.spark} color={card.color} />
            </div>
            <strong>{card.display}</strong>
            <div className="kpi-foot">
              <b className={card.delta.up ? 'up' : 'down'}>
                {card.delta.up ? '↑' : '↓'} {Math.abs(card.delta.pct).toFixed(1)}%
              </b>
              <em>{vsLabel}</em>
              <small>{card.extra}</small>
            </div>
          </button>
        ))}
      </section>

      <div className="dash-charts">
        <article className="dash-card">
          <h2>Shop mix</h2>
          <Donut slices={slices} />
        </article>
        <article className="dash-card">
          <div className="card-head">
            <h2>Month wise shop totals</h2>
            <div className="chart-keys">
              <span><i style={{ background: COLORS.money }} /> Money received</span>
              <span><i style={{ background: COLORS.wages }} /> Worker pay</span>
              <span><i style={{ background: COLORS.raw }} /> Raw material</span>
              <span><i style={{ background: COLORS.expense }} /> Expense</span>
            </div>
          </div>
          <BarChart
            labels={months.map(shortMonth)}
            series={[
              { label: 'Money received', color: COLORS.money, values: monthSnap.map((row) => row.collected) },
              { label: 'Worker pay', color: COLORS.wages, values: monthSnap.map((row) => row.wages) },
              { label: 'Raw material', color: COLORS.raw, values: monthSnap.map((row) => row.raw) },
              { label: 'Expense', color: COLORS.expense, values: monthSnap.map((row) => row.expense) },
            ]}
          />
        </article>
      </div>

      <article className="dash-card">
        <div className="card-head">
          <h2>Details</h2>
          <div className="dash-tabs">
            <button className={tab === 'due' ? 'on' : ''} type="button" onClick={() => setTab('due')}>Still to pay</button>
            <button className={tab === 'hotels' ? 'on' : ''} type="button" onClick={() => setTab('hotels')}>Hotels entry</button>
            <button className={tab === 'wages' ? 'on' : ''} type="button" onClick={() => setTab('wages')}>Workers payment</button>
            <button className={tab === 'raw' ? 'on' : ''} type="button" onClick={() => setTab('raw')}>Raw material</button>
            <button className={tab === 'expense' ? 'on' : ''} type="button" onClick={() => setTab('expense')}>Expense</button>
            <button className={tab === 'money' ? 'on' : ''} type="button" onClick={() => setTab('money')}>Money received</button>
          </div>
        </div>
        {tab === 'due' && (
          waiting.rows.length === 0
            ? <p className="empty">Every hotel and catering bill is clear.</p>
            : waiting.rows.map((row) => (
              <div className="list-row miss" key={row.id}>
                <div>
                  <strong>{row.card.title}</strong>
                  <div className="muted">{row.kind} · {row.no} · {prettyDate(row.date)}{row.pending ? ' · pending delivery' : ''}</div>
                </div>
                <div className="row-actions">
                  <b>{inr(row.due)}</b>
                  <button className="btn good" type="button" onClick={() => go('orders')}>Receive</button>
                </div>
              </div>
            ))
        )}
        {tab === 'hotels' && (
          <>
            <p className="muted">{snap.hotelOrdered} of {snap.hotels} hotels ordered · {snap.hotelMissing} have no order · billed {inr(snap.hotelBilled)}</p>
            {board.rows.slice(0, 8).map((row) => (
              <div className={row.ordered ? 'list-row' : 'list-row miss'} key={row.hotel.id}>
                <div>
                  <strong>{row.card.title}</strong>
                  <div className="muted">{row.card.detail}</div>
                </div>
                <b>{row.ordered ? inr(row.amount) : 'No order'}</b>
              </div>
            ))}
            <button className="btn" type="button" onClick={() => go('hotels')}>Open hotel entry</button>
          </>
        )}
        {tab === 'wages' && (
          <div className="list-row">
            <div>
              <strong>{num(snap.workers)} makers</strong>
              <div className="muted">{num(snap.pieces)} chapati · still to pay {inr(snap.wagesDue)}</div>
            </div>
            <div className="row-actions">
              <b>{inr(snap.wages)}</b>
              <button className="btn" type="button" onClick={() => go('wages')}>Pay workers</button>
            </div>
          </div>
        )}
        {tab === 'raw' && (
          rawRows.length === 0
            ? <p className="empty">No raw material in this period.</p>
            : rawRows.map((row) => (
              <div className="list-row" key={`${row.name}-${row.unit}`}>
                <div>
                  <strong>{row.name}</strong>
                  <div className="muted">{qtyWithUnit(row.qty, row.unit)}</div>
                </div>
                <b>{inr(row.amount)}</b>
              </div>
            ))
        )}
        {tab === 'expense' && (
          expenseRows.length === 0
            ? <p className="empty">No other expense in this period.</p>
            : expenseRows.map((row) => (
              <div className="list-row" key={`${row.name}-${row.unit}`}>
                <div>
                  <strong>{row.name}</strong>
                  <div className="muted">{qtyWithUnit(row.qty, row.unit)}</div>
                </div>
                <b>{inr(row.amount)}</b>
              </div>
            ))
        )}
        {tab === 'money' && (
          <>
            <div className="list-row">
              <div><strong>Shop sales</strong><div className="muted">{num(summary.saleCount)} walk-in bills</div></div>
              <b>{inr(snap.walkIn)}</b>
            </div>
            <div className="list-row">
              <div><strong>Hotel money received</strong><div className="muted">Payments in this period</div></div>
              <b>{inr(Math.max(0, snap.collected - snap.walkIn))}</b>
            </div>
            <div className="list-row">
              <div><strong>Still due from hotels</strong></div>
              <b>{inr(snap.dues)}</b>
            </div>
          </>
        )}
      </article>
    </div>
  )
}
