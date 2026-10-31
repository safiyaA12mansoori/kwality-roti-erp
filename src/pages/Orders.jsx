import { useState } from 'react'
import { byId, cleanLines, hotelBalance, hotelCard, hotelOrderBoard, hotelPrice, moneyInput, orderPaid, round, sum, whole } from '../calc'
import { esc, inr, methodLabel, num, prettyDate } from '../format'
import { companyBlock, printDocument } from '../print'
import { useStore } from '../store'
import { Field, Modal, QtyStepper, SearchBar } from '../ui'

function blankLine(state, hotelId) {
  const hotel = byId(state.hotels, hotelId)
  const product = state.products.find((item) => item.active !== false)
  return {
    productId: product?.id || '',
    qty: '',
    rate: product ? hotelPrice(product, hotel) : '',
  }
}

function freshDraft(state) {
  const hotel = state.hotels.find((item) => item.active !== false)
  return {
    id: '',
    hotelId: hotel?.id || '',
    note: '',
    takePayment: false,
    payNow: '',
    method: 'cash',
    lines: [blankLine(state, hotel?.id || '')],
  }
}

export function Orders() {
  const { state, date, saveOrder, deleteOrder, receivePayment, setOrderStatus } = useStore()
  const [draft, setDraft] = useState(() => freshDraft(state))
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [paying, setPaying] = useState(null)
  const [query, setQuery] = useState('')
  const needle = query.trim().toLowerCase()
  const hotels = state.hotels.filter((hotel) => hotel.active !== false)
  const products = state.products.filter((product) => product.active !== false)
  const todayOrders = state.orders
    .filter((order) => order.date === date)
    .filter((order) => {
      if (!needle) return true
      const hotel = byId(state.hotels, order.hotelId)
      const card = hotelCard(hotel)
      return `${card.title} ${card.detail} ${order.no}`.toLowerCase().includes(needle)
    })
    .slice()
    .sort((a, b) => b.no.localeCompare(a.no))
  const pendingOrders = todayOrders.filter((order) => order.status !== 'completed')
  const doneOrders = todayOrders.filter((order) => order.status === 'completed')
  const board = hotelOrderBoard(state, date, date)
  const dues = state.hotels
    .map((hotel) => ({ hotel, balance: hotelBalance(state, hotel.id) }))
    .filter((row) => row.balance > 0)
    .sort((a, b) => b.balance - a.balance)
  const preview = sum(draft.lines.map((line) => round(whole(line.qty) * moneyInput(line.rate))))

  function updateLine(index, patch) {
    setDraft((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)),
    }))
  }

  function chooseHotel(hotelId) {
    const hotel = byId(state.hotels, hotelId)
    setDraft((current) => ({
      ...current,
      hotelId,
      lines: current.lines.map((line) => {
        const product = byId(state.products, line.productId)
        return product ? { ...line, rate: hotelPrice(product, hotel) } : line
      }),
    }))
  }

  function chooseProduct(index, productId) {
    const hotel = byId(state.hotels, draft.hotelId)
    const product = byId(state.products, productId)
    updateLine(index, { productId, rate: product ? hotelPrice(product, hotel) : '' })
  }

  function save(event) {
    event.preventDefault()
    const result = saveOrder({
      ...draft,
      date,
      payNow: draft.takePayment ? draft.payNow || preview : 0,
    })
    if (!result.ok) {
      setError(result.reason)
      setNotice('')
      return
    }
    setError('')
    setNotice(`Saved ${result.no}`)
    setDraft(freshDraft(state))
  }

  function edit(order) {
    setDraft({
      id: order.id,
      hotelId: order.hotelId,
      note: order.note || '',
      takePayment: false,
      payNow: '',
      method: 'cash',
      lines: order.lines.map((line) => ({ productId: line.productId, qty: String(line.qty), rate: String(line.rate) })),
    })
    setError('')
    setNotice('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function printChallan(order) {
    const hotel = byId(state.hotels, order.hotelId)
    const paid = orderPaid(state, order.id)
    const due = round(order.amount - paid)
    const rows = order.lines.map((line) => `<tr>
      <td>${esc(byId(state.products, line.productId)?.name || '')}</td>
      <td class="num">${num(line.qty)}</td>
      <td class="num">${inr(line.rate)}</td>
      <td class="num">${inr(line.amount)}</td>
    </tr>`).join('')
    printDocument(order.no, `
      ${companyBlock(state.settings)}
      <h2>Delivery ${esc(order.no)}</h2>
      <p>${esc(prettyDate(order.date))}</p>
      <p><strong>${esc(hotel?.contact || hotel?.phone || hotel?.name || '')}</strong><br>${esc(hotel?.address || '')}${hotel?.phone ? `<br>${esc(hotel.phone)}` : ''}</p>
      <table>
        <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr><td colspan="3">Total</td><td class="num">${inr(order.amount)}</td></tr>
          <tr><td colspan="3">Received</td><td class="num">${inr(paid)}</td></tr>
          <tr><td colspan="3">Due</td><td class="num">${inr(due)}</td></tr>
        </tfoot>
      </table>
      ${order.note ? `<p>Note: ${esc(order.note)}</p>` : ''}
      <div class="sign"><div>Received by hotel</div><div>For ${esc(state.settings.name)}</div></div>
    `)
  }

  return (
    <>
      <article className="card">
        <div className="card-head">
          <h2>{draft.id ? `Edit ${state.orders.find((order) => order.id === draft.id)?.no || 'order'}` : 'New hotel order'}</h2>
          <SearchBar value={query} onChange={setQuery} placeholder="Search hotel or challan" />
        </div>
        <p className="muted">New orders start as Pending. After delivery, mark Completed.</p>
        <form onSubmit={save}>
          <div className="grid-2">
            <Field label="Hotel (contact · phone · address)">
              <select value={draft.hotelId} onChange={(event) => chooseHotel(event.target.value)}>
                <option value="">Select a hotel</option>
                {hotels.map((hotel) => {
                  const card = hotelCard(hotel)
                  return <option key={hotel.id} value={hotel.id}>{[card.title, card.detail].filter(Boolean).join(' · ')}</option>
                })}
              </select>
            </Field>
            <Field label="Note">
              <input value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} placeholder="Lunch service, banquet…" />
            </Field>
          </div>
          <div style={{ height: 12 }} />
          {draft.lines.map((line, index) => (
            <div className={products.length === 1 ? 'line chapati-line' : 'line'} key={index}>
              {products.length > 1 && (
                <select value={line.productId} onChange={(event) => chooseProduct(index, event.target.value)}>
                  {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                </select>
              )}
              <QtyStepper value={line.qty} onCommit={(qty) => updateLine(index, { qty: String(qty) })} />
              <input value={line.rate} inputMode="decimal" placeholder="Rate" onChange={(event) => updateLine(index, { rate: event.target.value })} />
              <span className="amt">{inr(whole(line.qty) * moneyInput(line.rate))}</span>
              {products.length > 1 && (
                <button
                  className="btn"
                  type="button"
                  onClick={() => setDraft((current) => ({ ...current, lines: current.lines.filter((_, lineIndex) => lineIndex !== index) }))}
                  disabled={draft.lines.length === 1}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          {products.length > 1 && (
            <button className="btn" type="button" onClick={() => setDraft((current) => ({ ...current, lines: [...current.lines, blankLine(state, current.hotelId)] }))}>
              Add item
            </button>
          )}
          {!draft.id && (
            <label className="check" style={{ marginTop: 12 }}>
              <input
                type="checkbox"
                checked={draft.takePayment}
                onChange={(event) => setDraft({ ...draft, takePayment: event.target.checked, payNow: event.target.checked ? String(preview || '') : '' })}
              />
              Money received with this delivery
            </label>
          )}
          {draft.takePayment && !draft.id && (
            <div className="grid-2" style={{ marginTop: 10 }}>
              <Field label="Amount received">
                <input value={draft.payNow} inputMode="decimal" onChange={(event) => setDraft({ ...draft, payNow: event.target.value })} />
              </Field>
              <Field label="How">
                <div className="methods">
                  <button className={draft.method === 'cash' ? 'btn on' : 'btn'} type="button" onClick={() => setDraft({ ...draft, method: 'cash' })}>Cash</button>
                  <button className={draft.method === 'upi' ? 'btn on' : 'btn'} type="button" onClick={() => setDraft({ ...draft, method: 'upi' })}>UPI</button>
                  <button className={draft.method === 'bank' ? 'btn on' : 'btn'} type="button" onClick={() => setDraft({ ...draft, method: 'bank' })}>Bank</button>
                </div>
              </Field>
            </div>
          )}
          {draft.id && <p className="muted">To record more money on this challan, use Receive on the dues list.</p>}
          {error && <p className="form-error">{error}</p>}
          {notice && <p className="ok">{notice}</p>}
          <div className="row-actions" style={{ marginTop: 12 }}>
            <button className="btn primary" type="submit" disabled={!cleanLines(draft.lines).length}>Save order · {inr(preview)}</button>
            {draft.id && <button className="btn" type="button" onClick={() => setDraft(freshDraft(state))}>Cancel edit</button>}
          </div>
        </form>
      </article>

      <article className="card">
        <h2>Hotels today</h2>
        <p className="muted">
          {board.orderedHotels} of {board.hotels} hotels ordered · {board.missingHotels} have not given an order (marked).
        </p>
        {board.rows.map((row) => (
          <div className={row.ordered ? 'list-row' : 'list-row miss'} key={row.hotel.id}>
            <div>
              <strong>{row.card.title}</strong>
              <div className="muted">{row.card.detail}</div>
              {row.ordered
                ? <div className="muted">{row.orders.map((order) => `${order.no} · ${num(sum(order.lines, (line) => line.qty))} chapati`).join(' · ')}</div>
                : <div className="note">No order today</div>}
            </div>
            <div className="row-actions">
              {row.ordered ? <span className="badge paid">Ordered</span> : <span className="badge due">No order</span>}
              <b>{row.ordered ? inr(row.amount) : ''}</b>
              {!row.ordered && (
                <button
                  className="btn primary"
                  type="button"
                  onClick={() => {
                    chooseHotel(row.hotel.id)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                >
                  Add order
                </button>
              )}
            </div>
          </div>
        ))}
      </article>

      <article className="card">
        <h2>Pending orders</h2>
        {pendingOrders.length === 0 && <p className="empty">No pending hotel order for this day.</p>}
        {pendingOrders.map((order) => (
          <OrderRow
            key={order.id}
            order={order}
            state={state}
            onComplete={() => setOrderStatus(order.id, 'completed')}
            onEdit={() => edit(order)}
            onPrint={() => printChallan(order)}
            onRemove={() => {
              if (window.confirm(`Remove ${order.no}? Payments on this challan will be removed too.`)) deleteOrder(order.id)
            }}
          />
        ))}
      </article>

      <article className="card">
        <h2>Completed orders</h2>
        {doneOrders.length === 0 && <p className="empty">No completed delivery yet today.</p>}
        {doneOrders.map((order) => (
          <OrderRow
            key={order.id}
            order={order}
            state={state}
            onPending={() => setOrderStatus(order.id, 'pending')}
            onEdit={() => edit(order)}
            onPrint={() => printChallan(order)}
            onRemove={() => {
              if (window.confirm(`Remove ${order.no}? Payments on this challan will be removed too.`)) deleteOrder(order.id)
            }}
          />
        ))}
      </article>

      <article className="card">
        <h2>Still to collect</h2>
        {dues.length === 0 && <p className="empty">Every hotel bill is clear.</p>}
        {dues.map((row) => (
          <div className="list-row" key={row.hotel.id}>
            <div>
              <strong>{row.hotel.contact || row.hotel.phone}</strong>
              <div className="muted">{[row.hotel.phone, row.hotel.address].filter(Boolean).join(' · ')}</div>
            </div>
            <div className="row-actions">
              <b>{inr(row.balance)}</b>
              <button className="btn good" type="button" onClick={() => setPaying({ hotelId: row.hotel.id, amount: String(row.balance), method: 'upi', note: '' })}>
                Receive
              </button>
            </div>
          </div>
        ))}
      </article>

      {paying && (
        <PayModal
          hotels={dues}
          paying={paying}
          setPaying={setPaying}
          onClose={() => setPaying(null)}
          onSave={(form) => {
            const result = receivePayment(form)
            if (!result.ok) return result.reason
            setPaying(null)
            return ''
          }}
        />
      )}
    </>
  )
}

function OrderRow({ order, state, onComplete, onPending, onEdit, onPrint, onRemove }) {
  const paid = orderPaid(state, order.id)
  const due = round(order.amount - paid)
  const card = hotelCard(byId(state.hotels, order.hotelId))
  const done = order.status === 'completed'
  return (
    <div className="list-row">
      <div>
        <strong>{card.title}</strong>
        <div className="muted">
          {order.no} · {card.detail} · {order.lines.map((line) => `${num(line.qty)} ${byId(state.products, line.productId)?.name}`).join(', ')}
          {order.note ? ` · ${order.note}` : ''}
        </div>
      </div>
      <div className="row-actions">
        <b>{inr(order.amount)}</b>
        {done ? <span className="badge paid">Completed</span> : <span className="badge wait">Pending</span>}
        {due > 0 ? <span className="badge due">Due {inr(due)}</span> : <span className="badge paid">Paid</span>}
        {onComplete && <button className="btn good" type="button" onClick={onComplete}>Mark completed</button>}
        {onPending && <button className="btn" type="button" onClick={onPending}>Back to pending</button>}
        <button className="btn" type="button" onClick={onPrint}>Challan</button>
        <button className="btn" type="button" onClick={onEdit}>Edit</button>
        <button className="btn danger" type="button" onClick={onRemove}>Remove</button>
      </div>
    </div>
  )
}

function PayModal({ hotels, paying, setPaying, onClose, onSave }) {
  const [error, setError] = useState('')
  return (
    <Modal title="Receive hotel payment" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          const reason = onSave(paying)
          if (reason) setError(reason)
        }}
      >
        <div className="stack">
          <Field label="Hotel">
            <select value={paying.hotelId} onChange={(event) => setPaying({ ...paying, hotelId: event.target.value })}>
              {hotels.map((row) => <option key={row.hotel.id} value={row.hotel.id}>{[row.hotel.contact, row.hotel.phone].filter(Boolean).join(' · ')} · due {inr(row.balance)}</option>)}
            </select>
          </Field>
          <div className="grid-2">
            <Field label="Amount">
              <input value={paying.amount} inputMode="decimal" onChange={(event) => setPaying({ ...paying, amount: event.target.value })} />
            </Field>
            <Field label="How">
              <div className="methods">
                <button className={paying.method === 'cash' ? 'btn on' : 'btn'} type="button" onClick={() => setPaying({ ...paying, method: 'cash' })}>Cash</button>
                <button className={paying.method === 'upi' ? 'btn on' : 'btn'} type="button" onClick={() => setPaying({ ...paying, method: 'upi' })}>UPI</button>
                <button className={paying.method === 'bank' ? 'btn on' : 'btn'} type="button" onClick={() => setPaying({ ...paying, method: 'bank' })}>Bank</button>
              </div>
            </Field>
          </div>
          <Field label="Note">
            <input value={paying.note} onChange={(event) => setPaying({ ...paying, note: event.target.value })} placeholder="Weekly settlement" />
          </Field>
          <p className="muted">Money is applied to the oldest open challan first. Extra money stays as advance. {methodLabel(paying.method)}</p>
          {error && <p className="form-error">{error}</p>}
          <button className="btn primary" type="submit">Save payment</button>
        </div>
      </form>
    </Modal>
  )
}
