import { useMemo, useState } from 'react'
import { advanceBalance, hasWorkerHistory, sum, workerPrice } from '../calc'
import { inr, num } from '../format'
import { useStore } from '../store'
import { Avatar, EmptyState, Field, Modal, SearchBar, openProfile } from '../ui'

const blank = { id: '', name: '', phone: '', rate: '', active: true }

export function Workers() {
  const { state, saveWorker, setWorkerActive, removeWorker, giveAdvance } = useStore()
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null)
  const [advance, setAdvance] = useState(null)
  const [error, setError] = useState('')
  const chapati = state.products.find((product) => product.id === 'p-chapati')
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return state.workers
      .filter((worker) => !needle || worker.name.toLowerCase().includes(needle) || worker.phone.includes(needle))
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((worker) => {
        const made = state.production.filter((row) => row.workerId === worker.id)
        return {
          worker,
          pieces: sum(made, (row) => row.qty),
          earned: sum(made, (row) => row.amount),
          unpaid: sum(made.filter((row) => !row.paid), (row) => row.amount),
          advance: advanceBalance(state, worker.id),
          rate: workerPrice(chapati, worker),
        }
      })
  }, [query, state, chapati])

  return (
    <>
      <article className="card">
        <div className="card-head">
          <h2>Makers</h2>
          <div className="row-actions">
            <SearchBar value={query} onChange={setQuery} placeholder="Search worker name or phone" />
            <button className="btn primary" type="button" onClick={() => { setError(''); setEditing({ ...blank, rate: chapati?.workerRate || 1.5 }) }}>Add maker</button>
          </div>
        </div>
        <p className="muted">Each worker can have their own chapati rate. Advance is cut at pay time if you choose.</p>
      </article>
      {rows.length === 0 && (
        <article className="card"><EmptyState title="No makers match" text="Clear search, or add a maker." /></article>
      )}
      <div className="people-grid">
        {rows.map(({ worker, pieces, earned, unpaid, advance: left, rate }) => (
          <article className={`wage-card ${unpaid > 0 ? 'due' : ''}`} key={worker.id}>
            <div className="wage-card-top">
              <Avatar name={worker.name} />
              <div>
                <h3>{worker.name}{worker.active === false && <span className="badge off"> Hidden</span>}</h3>
                <div className="muted">{worker.phone || 'No phone'} · {inr(rate)} each</div>
                <div className="muted">{num(pieces)} pieces · earned {inr(earned)}</div>
                {left > 0 && <div className="muted">Advance remaining {inr(left)}</div>}
              </div>
              {unpaid > 0 && <span className="badge due">Unpaid {inr(unpaid)}</span>}
            </div>
            <div className="row-actions">
              <button className="btn" type="button" onClick={() => openProfile('worker', worker.id)}>Details</button>
              <button className="btn" type="button" onClick={() => setAdvance({ workerId: worker.id, name: worker.name, amount: '', note: '' })}>Advance</button>
              <button className="btn primary" type="button" onClick={() => { setError(''); setEditing({ ...worker, rate }) }}>Edit</button>
              {hasWorkerHistory(state, worker.id)
                ? <button className="btn" type="button" onClick={() => setWorkerActive(worker.id, worker.active === false)}>
                  {worker.active === false ? 'Show again' : 'Hide'}
                </button>
                : (
                    <button
                      className="btn danger"
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Do you want to remove ${worker.name} permanently? This cannot be undone.`)) {
                          removeWorker(worker.id)
                        }
                      }}
                    >
                      Remove
                    </button>
                  )}
            </div>
          </article>
        ))}
      </div>
      {editing && (
        <Modal title={editing.id ? 'Edit maker' : 'Add maker'} onClose={() => setEditing(null)}>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              const result = saveWorker(editing)
              if (!result.ok) {
                setError(result.reason)
                return
              }
              setEditing(null)
            }}
          >
            <div className="stack">
              <Field label="Name">
                <input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} />
              </Field>
              <Field label="Phone">
                <input value={editing.phone} onChange={(event) => setEditing({ ...editing, phone: event.target.value })} />
              </Field>
              <Field label="This worker’s chapati rate">
                <input inputMode="decimal" value={editing.rate} onChange={(event) => setEditing({ ...editing, rate: event.target.value })} />
              </Field>
              <label className="check">
                <input type="checkbox" checked={editing.active !== false} onChange={(event) => setEditing({ ...editing, active: event.target.checked })} />
                Include in the daily count
              </label>
              {error && <p className="form-error">{error}</p>}
              <button className="btn primary" type="submit">Save maker</button>
            </div>
          </form>
        </Modal>
      )}
      {advance && (
        <Modal title={`Advance for ${advance.name}`} onClose={() => setAdvance(null)}>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              const result = giveAdvance(advance)
              if (!result.ok) {
                setError(result.reason)
                return
              }
              setAdvance(null)
            }}
          >
            <div className="stack">
              <p className="muted">Now remaining {inr(advanceBalance(state, advance.workerId))}. Add more advance here.</p>
              <Field label="Amount">
                <input inputMode="decimal" value={advance.amount} onChange={(event) => setAdvance({ ...advance, amount: event.target.value })} />
              </Field>
              <Field label="Note">
                <input value={advance.note} onChange={(event) => setAdvance({ ...advance, note: event.target.value })} placeholder="Festival, home, etc." />
              </Field>
              <button className="btn primary" type="submit">Save advance</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
