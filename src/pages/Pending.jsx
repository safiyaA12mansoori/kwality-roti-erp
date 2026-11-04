import { useEffect, useMemo, useState } from 'react'
import { byId, moneyInput, unpaidBills } from '../calc'
import { inr, methodLabel, num, prettyDate } from '../format'
import { useStore } from '../store'
import { Field, SearchBar } from '../ui'

export function Pending() {
  const { state, receivePayment, setOrderStatus } = useStore()
  const waiting = useMemo(() => unpaidBills(state), [state])
  const [query, setQuery] = useState('')
  const [focusId, setFocusId] = useState('')
  const [forms, setForms] = useState({})
  const [message, setMessage] = useState('')

  useEffect(() => {
    try {
      const id = sessionStorage.getItem('erp-pending') || ''
      if (id) {
        setFocusId(id)
        sessionStorage.removeItem('erp-pending')
      }
    } catch {
      /* ignore */
    }
  }, [])

  const needle = query.trim().toLowerCase()
  const rows = waiting.rows.filter((row) => {
    if (!needle) return true
    return `${row.card.title} ${row.card.detail} ${row.no} ${row.kind}`.toLowerCase().includes(needle)
  })

  function formFor(row) {
    return forms[row.id] || { amount: String(row.due), method: 'upi', note: '' }
  }

  function patchForm(row, patch) {
    setForms((current) => ({
      ...current,
      [row.id]: { ...(current[row.id] || formFor(row)), ...patch },
    }))
  }

  function receive(row) {
    const form = formFor(row)
    const result = receivePayment({
      hotelId: row.hotel?.id,
      orderId: row.id,
      amount: moneyInput(form.amount),
      method: form.method,
      note: form.note,
    })
    if (!result.ok) {
      setMessage(result.reason)
      return
    }
    setMessage(`Received ${inr(moneyInput(form.amount))} on ${row.no}`)
    setForms((current) => {
      const next = { ...current }
      delete next[row.id]
      return next
    })
  }

  return (
    <>
      <article className="card pending-hero">
        <div className="card-head">
          <div>
            <p className="eyebrow">Pending collection</p>
            <h2>{waiting.rows.length ? `${inr(waiting.total)} still to collect` : 'All bills are clear'}</h2>
            <p className="muted">
              {waiting.rows.length
                ? `${num(waiting.parties)} parties · ${num(waiting.hotels)} hotel bills · ${num(waiting.catering)} catering`
                : 'No hotel or catering order is waiting for money.'}
            </p>
          </div>
          <SearchBar value={query} onChange={setQuery} placeholder="Search hotel, catering, challan" />
        </div>
        {message && <p className={message.startsWith('Received') ? 'ok' : 'form-error'}>{message}</p>}
      </article>

      {rows.length === 0 && (
        <article className="card">
          <p className="empty">{waiting.rows.length ? 'No match for that search.' : 'Nothing pending to collect.'}</p>
        </article>
      )}

      <div className="pending-grid">
        {rows.map((row) => {
          const form = formFor(row)
          const product = row.hotel && state.orders.find((order) => order.id === row.id)
          const lines = product?.lines || []
          return (
            <article className={`pending-card ${row.kind === 'Catering' ? 'cater' : ''} ${focusId === row.id ? 'on' : ''}`} key={row.id}>
              <div className="pending-top">
                <div>
                  <span className={`badge ${row.kind === 'Catering' ? 'wait' : 'due'}`}>{row.kind}</span>
                  {row.pending ? <span className="badge wait">Pending</span> : <span className="badge paid">Completed</span>}
                </div>
                <strong>{row.card.title}</strong>
                <p className="muted">{row.card.detail || 'No phone or address'}</p>
                <p className="muted">{row.no} · {prettyDate(row.date)}{product?.note ? ` · ${product.note}` : ''}</p>
                <p className="muted">
                  {lines.length
                    ? lines.map((line) => `${num(line.qty)} ${byId(state.products, line.productId)?.name || 'Chapati'}`).join(' · ')
                    : 'Chapati order'}
                </p>
              </div>
              <div className="pending-money">
                <div><span>Bill</span><b>{inr(row.amount)}</b></div>
                <div><span>Received</span><b>{inr(row.paid)}</b></div>
                <div><span>Still due</span><b>{inr(row.due)}</b></div>
              </div>
              <div className="pending-status">
                <button
                  className={row.pending ? 'btn on' : 'btn'}
                  type="button"
                  onClick={() => setOrderStatus(row.id, 'pending')}
                >
                  Pending
                </button>
                <button
                  className={!row.pending ? 'btn on' : 'btn'}
                  type="button"
                  onClick={() => setOrderStatus(row.id, 'completed')}
                >
                  Completed
                </button>
              </div>
              <div className="pending-receive">
                <Field label="Receive amount">
                  <input
                    inputMode="decimal"
                    value={form.amount}
                    onChange={(event) => patchForm(row, { amount: event.target.value })}
                  />
                </Field>
                <div className="method-grid">
                  {['cash', 'upi', 'bank'].map((method) => (
                    <button
                      key={method}
                      className={form.method === method ? 'btn on' : 'btn'}
                      type="button"
                      onClick={() => patchForm(row, { method })}
                    >
                      {methodLabel(method)}
                    </button>
                  ))}
                </div>
                <Field label="Note">
                  <input
                    value={form.note}
                    placeholder="Part payment, weekly settlement…"
                    onChange={(event) => patchForm(row, { note: event.target.value })}
                  />
                </Field>
                <button className="btn primary" type="button" onClick={() => receive(row)}>
                  Save receive · {inr(moneyInput(form.amount) || row.due)}
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </>
  )
}
