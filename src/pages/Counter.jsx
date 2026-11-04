import { useState } from 'react'
import { byId, cleanLines, regulars, sum, whole } from '../calc'
import { clock, esc, inr, methodLabel, num, prettyDate } from '../format'
import { companyBlock, printDocument } from '../print'
import { useStore } from '../store'
import { Field, SearchBar } from '../ui'

function emptyBasket() {
  return { id: '', customerName: '', phone: '', method: 'cash', lines: [] }
}

export function Counter() {
  const { state, date, saveSale, deleteSale } = useStore()
  const [basket, setBasket] = useState(emptyBasket)
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')
  const products = state.products.filter((product) => product.active !== false)
  const needle = query.trim().toLowerCase()
  const sales = state.sales
    .filter((sale) => sale.date === date)
    .filter((sale) => !needle || `${sale.customerName} ${sale.phone} ${sale.no}`.toLowerCase().includes(needle))
    .slice()
    .sort((a, b) => b.at.localeCompare(a.at))
  const people = regulars(state.sales).filter((person) => !needle || `${person.name} ${person.phone}`.toLowerCase().includes(needle))
  const total = sum(cleanLines(basket.lines), (line) => line.amount)

  function addProduct(product) {
    setBasket((current) => {
      const exists = current.lines.some((line) => line.productId === product.id)
      const lines = exists
        ? current.lines.map((line) => (
          line.productId === product.id ? { ...line, qty: whole(line.qty) + 1 } : line
        ))
        : [...current.lines, { productId: product.id, qty: 1, rate: product.retailRate }]
      return { ...current, lines }
    })
    setMessage('')
  }

  function setQty(productId, qty) {
    setBasket((current) => ({
      ...current,
      lines: qty <= 0
        ? current.lines.filter((line) => line.productId !== productId)
        : current.lines.map((line) => (line.productId === productId ? { ...line, qty } : line)),
    }))
  }

  function save() {
    const result = saveSale(basket)
    if (!result.ok) {
      setMessage(result.reason)
      return
    }
    setMessage(`Saved ${result.no}`)
    setBasket(emptyBasket())
  }

  function edit(sale) {
    setBasket({
      id: sale.id,
      customerName: sale.customerName,
      phone: sale.phone,
      method: sale.method,
      lines: sale.lines.map((line) => ({ ...line })),
    })
    setMessage('')
  }

  function printReceipt(sale) {
    const rows = sale.lines.map((line) => `<tr>
      <td>${esc(byId(state.products, line.productId)?.name || '')}</td>
      <td class="num">${num(line.qty)}</td>
      <td class="num">${inr(line.amount)}</td>
    </tr>`).join('')
    printDocument(sale.no, `
      ${companyBlock(state.settings)}
      <h2>Bill ${esc(sale.no)}</h2>
      <p>${esc(prettyDate(sale.date))} ${esc(clock(sale.at))} · ${esc(methodLabel(sale.method))}</p>
      <p>${esc(sale.customerName || 'Walk-in')}${sale.phone ? ` · ${esc(sale.phone)}` : ''}</p>
      <table>
        <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Amount</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td colspan="2">Total</td><td class="num">${inr(sale.amount)}</td></tr></tfoot>
      </table>
      <p>Paid in full.</p>
    `)
  }

  return (
    <>
      <div className="counter-grid">
        <article className="card">
          <div className="card-head">
            <h2>Add to the bill</h2>
            <SearchBar value={query} onChange={setQuery} placeholder="Search walk-in customer" />
          </div>
          <div className="tiles">
            {products.map((product) => (
              <button className="tile" type="button" key={product.id} onClick={() => addProduct(product)}>
                <b>{product.name}</b>
                <span>{inr(product.retailRate)} each</span>
              </button>
            ))}
          </div>
          {people.length > 0 && (
            <>
              <h2 style={{ marginTop: 18 }}>Regular customers</h2>
              {people.slice(0, 6).map((person) => (
                <button
                  className="regular"
                  type="button"
                  key={`${person.phone}-${person.name}`}
                  onClick={() => setBasket((current) => ({ ...current, customerName: person.name, phone: person.phone }))}
                >
                  <span>{person.name || person.phone}<small className="muted"> · {person.visits} visits</small></span>
                  <b>{inr(person.amount)}</b>
                </button>
              ))}
            </>
          )}
        </article>

        <article className="card">
          <h2>{basket.id ? 'Edit bill' : 'Current bill'}</h2>
          {basket.lines.length === 0 && <p className="empty">Tap chapati to start the bill.</p>}
          {basket.lines.map((line) => {
            const product = byId(state.products, line.productId)
            const qty = whole(line.qty)
            return (
              <div className="basket-line" key={line.productId}>
                <div>
                  <strong>{product?.name}</strong>
                  <div className="muted">{inr(line.rate)} each</div>
                </div>
                <input
                  className="qty"
                  inputMode="numeric"
                  value={qty || ''}
                  placeholder="Qty"
                  aria-label={`${product?.name || 'Chapati'} quantity`}
                  onChange={(event) => setQty(line.productId, whole(event.target.value))}
                />
                <b>{inr(qty * line.rate)}</b>
              </div>
            )
          })}
          <div className="total-line">
            <span>Total</span>
            <strong>{inr(total)}</strong>
          </div>
          <div className="grid-2">
            <Field label="Customer name">
              <input value={basket.customerName} onChange={(event) => setBasket({ ...basket, customerName: event.target.value })} placeholder="Walk-in if blank" />
            </Field>
            <Field label="Phone">
              <input value={basket.phone} onChange={(event) => setBasket({ ...basket, phone: event.target.value })} />
            </Field>
          </div>
          <div className="methods" style={{ margin: '12px 0' }}>
            <button className={basket.method === 'cash' ? 'btn on' : 'btn'} type="button" onClick={() => setBasket({ ...basket, method: 'cash' })}>Cash</button>
            <button className={basket.method === 'upi' ? 'btn on' : 'btn'} type="button" onClick={() => setBasket({ ...basket, method: 'upi' })}>UPI</button>
            <button className={basket.method === 'bank' ? 'btn on' : 'btn'} type="button" onClick={() => setBasket({ ...basket, method: 'bank' })}>Bank</button>
          </div>
          {message && <p className={message.startsWith('Saved') ? 'ok' : 'form-error'}>{message}</p>}
          <button className="btn primary big" type="button" disabled={!basket.lines.length} onClick={save}>
            {basket.id ? `Update bill · ${inr(total)}` : `Save sale · ${inr(total)}`}
          </button>
          {basket.lines.length > 0 && (
            <button className="btn" type="button" style={{ marginTop: 8 }} onClick={() => setBasket(emptyBasket())}>Clear</button>
          )}
        </article>
      </div>

      <article className="card">
        <h2>Sales on this day</h2>
        {sales.length === 0 && <p className="empty">Nothing sold at the counter yet.</p>}
        {sales.map((sale) => (
          <div className="list-row" key={sale.id}>
            <div>
              <strong>{sale.customerName || 'Walk-in'}</strong>
              <div className="muted">
                {sale.no} · {clock(sale.at)} · {methodLabel(sale.method)} · {sale.lines.map((line) => `${num(line.qty)} ${byId(state.products, line.productId)?.name}`).join(', ')}
              </div>
            </div>
            <div className="row-actions">
              <b>{inr(sale.amount)}</b>
              <button className="btn" type="button" onClick={() => printReceipt(sale)}>Print</button>
              <button className="btn" type="button" onClick={() => edit(sale)}>Edit</button>
              <button
                className="btn danger"
                type="button"
                onClick={() => {
                  if (window.confirm(`Remove bill ${sale.no}?`)) deleteSale(sale.id)
                }}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </article>
    </>
  )
}
