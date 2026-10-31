import { useState } from 'react'
import { hasHotelHistory, hotelBalance, hotelPrice } from '../calc'
import { inr } from '../format'
import { useStore } from '../store'
import { Avatar, EmptyState, Field, Modal, SearchBar, openProfile } from '../ui'

const blank = { id: '', name: '', contact: '', phone: '', address: '', active: true, rates: {} }

export function Hotels() {
  const { state, saveHotel, setHotelActive, removeHotel } = useStore()
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const needle = query.trim().toLowerCase()
  const chapati = state.products.find((product) => product.id === 'p-chapati')
  const hotels = state.hotels
    .filter((hotel) => {
      if (!needle) return true
      return [hotel.name, hotel.contact, hotel.phone, hotel.address].join(' ').toLowerCase().includes(needle)
    })
    .slice()
    .sort((a, b) => (a.contact || a.phone || '').localeCompare(b.contact || b.phone || ''))

  function openNew() {
    setError('')
    setEditing({ ...blank, rates: {} })
  }

  function openEdit(hotel) {
    setError('')
    setEditing({
      ...hotel,
      rates: Object.fromEntries(state.products.map((product) => [product.id, hotel.rates?.[product.id] ?? ''])),
    })
  }

  return (
    <>
      <article className="card">
        <div className="card-head">
          <h2>{hotels.length} hotels</h2>
          <div className="row-actions">
            <SearchBar value={query} onChange={setQuery} placeholder="Search hotel, phone, address" />
            <button className="btn primary" type="button" onClick={openNew}>Add hotel</button>
          </div>
        </div>
      </article>
      {hotels.length === 0 && (
        <article className="card">
          <EmptyState title="No hotel matches" text="Add a hotel, or clear the search." action={<button className="btn primary" type="button" onClick={openNew}>Add hotel</button>} />
        </article>
      )}
      <div className="people-grid">
        {hotels.map((hotel) => {
          const balance = hotelBalance(state, hotel.id)
          const recent = state.orders.filter((order) => order.hotelId === hotel.id).slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 2)
          const title = hotel.contact || hotel.phone || 'Hotel'
          return (
            <article className={`wage-card ${balance > 0 ? 'due' : ''}`} key={hotel.id}>
              <div className="wage-card-top">
                <Avatar name={title} />
                <div>
                  <h3>{title}{hotel.active === false && <span className="badge off"> Hidden</span>}</h3>
                  <div className="muted">{[hotel.phone, hotel.address].filter(Boolean).join(' · ')}</div>
                  <div className="muted">Rate {inr(hotelPrice(chapati, hotel))} · {recent.length === 0 ? 'No deliveries yet' : recent.map((order) => order.no).join(' · ')}</div>
                </div>
                {balance > 0 && <span className="badge due">Due {inr(balance)}</span>}
                {balance < 0 && <span className="badge paid">Advance {inr(Math.abs(balance))}</span>}
                {balance === 0 && <span className="badge wait">Clear</span>}
              </div>
              <div className="row-actions">
                <button className="btn" type="button" onClick={() => openProfile('hotel', hotel.id)}>Details</button>
                <button className="btn primary" type="button" onClick={() => openEdit(hotel)}>Edit</button>
                {hasHotelHistory(state, hotel.id)
                  ? <button className="btn" type="button" onClick={() => setHotelActive(hotel.id, hotel.active === false)}>
                    {hotel.active === false ? 'Show again' : 'Hide'}
                  </button>
                  : <button className="btn danger" type="button" onClick={() => removeHotel(hotel.id)}>Remove</button>}
              </div>
            </article>
          )
        })}
      </div>
      {editing && (
        <Modal title={editing.id ? 'Edit hotel' : 'Add hotel'} onClose={() => setEditing(null)}>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              const result = saveHotel(editing)
              if (!result.ok) {
                setError(result.reason)
                return
              }
              setEditing(null)
            }}
          >
            <div className="stack">
              <div className="grid-2">
                <Field label="Contact person">
                  <input value={editing.contact} onChange={(event) => setEditing({ ...editing, contact: event.target.value })} />
                </Field>
                <Field label="Phone">
                  <input value={editing.phone} onChange={(event) => setEditing({ ...editing, phone: event.target.value })} />
                </Field>
              </div>
              <Field label="Address">
                <input value={editing.address} onChange={(event) => setEditing({ ...editing, address: event.target.value })} />
              </Field>
              <Field label="Name on invoice only (not shown in the hotel list)">
                <input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} placeholder="Optional" />
              </Field>
              <p className="muted">Special chapati price for this hotel. Leave blank to use the normal hotel price.</p>
              {state.products.filter((product) => product.id === 'p-chapati').map((product) => (
                <Field key={product.id} label="Chapati special price">
                  <input
                    inputMode="decimal"
                    placeholder={`Normal ${inr(product.hotelRate)}`}
                    value={editing.rates?.[product.id] ?? ''}
                    onChange={(event) => setEditing({ ...editing, rates: { ...editing.rates, [product.id]: event.target.value } })}
                  />
                </Field>
              ))}
              {error && <p className="form-error">{error}</p>}
              <button className="btn primary" type="submit">Save hotel</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
