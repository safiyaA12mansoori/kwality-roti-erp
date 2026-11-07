import { useState } from 'react'
import { todayISO } from '../format'
import { useStore } from '../store'
import { Field } from '../ui'

const blankUser = { id: '', name: '', username: '', password: '', role: 'worker' }

const storedBooks = [
  { id: 'hotels', label: 'Hotels', columns: [['Name', 'name'], ['Contact', 'contact'], ['Phone', 'phone'], ['Address', 'address']] },
  { id: 'workers', label: 'Workers', columns: [['Name', 'name'], ['Phone', 'phone'], ['Rate', 'rate']] },
  { id: 'orders', label: 'Hotel orders', columns: [['Bill', 'no'], ['Date', 'date'], ['Amount', 'amount'], ['Status', 'status']] },
  { id: 'payments', label: 'Payments', columns: [['Date', 'date'], ['Amount', 'amount'], ['Method', 'method'], ['Note', 'note']] },
  { id: 'sales', label: 'Walk-in sales', columns: [['Bill', 'no'], ['Date', 'date'], ['Customer', 'customerName'], ['Amount', 'amount']] },
  { id: 'production', label: 'Chapati counts', columns: [['Date', 'date'], ['Quantity', 'qty'], ['Amount', 'amount'], ['Paid', 'paid']] },
  { id: 'attendance', label: 'Attendance', columns: [['Date', 'date'], ['Present', 'present']] },
  { id: 'advances', label: 'Advances', columns: [['Date', 'date'], ['Amount', 'amount'], ['Note', 'note']] },
  { id: 'expenses', label: 'Costs', columns: [['Date', 'date'], ['Item', 'name'], ['Quantity', 'qty'], ['Amount', 'amount']] },
  { id: 'products', label: 'Chapati price', columns: [['Name', 'name'], ['Worker rate', 'workerRate'], ['Hotel rate', 'hotelRate'], ['Shop rate', 'retailRate']] },
  { id: 'users', label: 'Logins', columns: [['Name', 'name'], ['Username', 'username'], ['Role', 'role']] },
]

function shownCell(value) {
  if (value == null || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

function StoredBooks({ state }) {
  const [bookId, setBookId] = useState('hotels')
  const lists = storedBooks.map((book) => ({ ...book, rows: state[book.id] || [] }))
  const personal = state.personal || { incomes: [], expenses: [] }
  const selected = lists.find((book) => book.id === bookId) || lists[0]

  return (
    <article className="card">
      <h2>Stored books</h2>
      <p className="muted">
        These rows are the database. They are saved in this browser under the name roti-erp-v3.
        Another computer does not see them.
      </p>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr><th>List</th><th className="num">Rows</th><th /></tr>
          </thead>
          <tbody>
            {lists.map((book) => (
              <tr key={book.id}>
                <td>{book.label}</td>
                <td className="num">{book.rows.length}</td>
                <td><button className="btn" type="button" onClick={() => setBookId(book.id)}>Open</button></td>
              </tr>
            ))}
            <tr>
              <td>Owner income</td>
              <td className="num">{personal.incomes?.length || 0}</td>
              <td><button className="btn" type="button" onClick={() => setBookId('incomes')}>Open</button></td>
            </tr>
            <tr>
              <td>Owner expenses</td>
              <td className="num">{personal.expenses?.length || 0}</td>
              <td><button className="btn" type="button" onClick={() => setBookId('expenses-personal')}>Open</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      {bookId === 'incomes' && (
        <BookTable title="Owner income" columns={[['Bill', 'no'], ['Date', 'date'], ['Source', 'source'], ['Amount', 'amount']]} rows={personal.incomes || []} />
      )}
      {bookId === 'expenses-personal' && (
        <BookTable title="Owner expenses" columns={[['Bill', 'no'], ['Date', 'date'], ['Category', 'category'], ['Amount', 'amount']]} rows={personal.expenses || []} />
      )}
      {selected && bookId !== 'incomes' && bookId !== 'expenses-personal' && (
        <BookTable title={selected.label} columns={selected.columns} rows={selected.rows} />
      )}
    </article>
  )
}

function BookTable({ title, columns, rows }) {
  return (
    <>
      <h2 style={{ marginTop: 18 }}>{title}</h2>
      {rows.length === 0 && <p className="empty">No rows saved yet.</p>}
      {rows.length > 0 && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>{columns.map(([label]) => <th key={label}>{label}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id || `${row.no}-${row.date}`}>
                  {columns.map(([label, key]) => <td key={label}>{shownCell(row[key])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

export function Settings() {
  const { state, patchSettings, resetBooks, importBooks, saveUser, removeUser } = useStore()
  const [message, setMessage] = useState('')
  const [userForm, setUserForm] = useState(blankUser)
  const [userError, setUserError] = useState('')
  const settings = state.settings

  function exportBooks() {
    const slug = settings.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'roti-erp'
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${slug}-books-${todayISO()}.json`
    link.click()
    URL.revokeObjectURL(link.href)
    setMessage('Backup downloaded.')
  }

  function onImport(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result))
        if (!data?.settings?.name || !Array.isArray(data.workers) || !Array.isArray(data.products)) {
          throw new Error('This file is not a Roti ERP backup.')
        }
        importBooks(data)
        setMessage('Backup loaded on this computer.')
      } catch (error) {
        setMessage(error.message || 'Could not read that file.')
      }
    }
    reader.readAsText(file)
  }

  return (
    <>
    <article className="card">
      <h2>Company</h2>
      <div className="stack">
        <Field label="Company name">
          <input value={settings.name} onChange={(event) => patchSettings({ name: event.target.value })} />
        </Field>
        <Field label="Tagline">
          <input value={settings.tagline || ''} onChange={(event) => patchSettings({ tagline: event.target.value })} />
        </Field>
        <div className="grid-2">
          <Field label="Phone">
            <input value={settings.phone} onChange={(event) => patchSettings({ phone: event.target.value })} />
          </Field>
          <Field label="Address">
            <input value={settings.address} onChange={(event) => patchSettings({ address: event.target.value })} />
          </Field>
        </div>
        <p className="muted">
          These books stay in this browser on this computer. They are not on the internet.
          Download a backup after wages are paid, and keep that file somewhere safe.
        </p>
        <div className="row-actions">
          <button className="btn primary" type="button" onClick={exportBooks}>Download backup</button>
          <label className="btn">
            Load backup
            <input
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(event) => {
                onImport(event.target.files?.[0])
                event.target.value = ''
              }}
            />
          </label>
          <button
            className="btn danger"
            type="button"
            onClick={() => {
              if (window.confirm('Erase every hotel, worker, order, payment, and sale on this computer? Download a backup first if you need these books.')) {
                resetBooks()
                setMessage('All books cleared.')
              }
            }}
          >
            Clear all data
          </button>
        </div>
        {message && <p className="ok">{message}</p>}
      </div>
    </article>
    <StoredBooks state={state} />
    <article className="card">
      <h2>Admin and staff logins</h2>
      <p className="muted">Admin can open Dashboard and Statement. Staff can only enter hotels, workers, raw material, walk-in sales, and hotel orders. The owner login is private personal books and cannot be changed here.</p>
      {state.users.filter((user) => user.role !== 'owner').map((user) => (
        <div className="list-row" key={user.id}>
          <div>
            <strong>{user.name}</strong>
            <div className="muted">{user.username} · {user.role === 'admin' ? 'Admin' : 'Staff'}</div>
          </div>
          <div className="row-actions">
            <button className="btn" type="button" onClick={() => { setUserError(''); setUserForm({ ...user, password: '' }) }}>Edit</button>
            <button
              className="btn danger"
              type="button"
              onClick={() => {
                if (!removeUser(user.id)) setUserError('Keep at least one admin login.')
              }}
            >
              Remove
            </button>
          </div>
        </div>
      ))}
      <form
        style={{ marginTop: 14 }}
        onSubmit={(event) => {
          event.preventDefault()
          const result = saveUser(userForm)
          if (!result.ok) {
            setUserError(result.reason)
            return
          }
          setUserError('')
          setUserForm(blankUser)
        }}
      >
        <h2>{userForm.id ? 'Edit login' : 'Add staff login'}</h2>
        <div className="grid-2">
          <Field label="Display name">
            <input value={userForm.name} onChange={(event) => setUserForm({ ...userForm, name: event.target.value })} />
          </Field>
          <Field label="Username">
            <input value={userForm.username} onChange={(event) => setUserForm({ ...userForm, username: event.target.value })} />
          </Field>
          <Field label={userForm.id ? 'New password (blank = keep)' : 'Password'}>
            <input type="password" value={userForm.password} onChange={(event) => setUserForm({ ...userForm, password: event.target.value })} />
          </Field>
          <Field label="Access">
            <select value={userForm.role} onChange={(event) => setUserForm({ ...userForm, role: event.target.value })}>
              <option value="worker">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </Field>
        </div>
        {userError && <p className="form-error">{userError}</p>}
        <div className="row-actions" style={{ marginTop: 12 }}>
          <button className="btn primary" type="submit">Save login</button>
          {userForm.id && <button className="btn" type="button" onClick={() => setUserForm(blankUser)}>Cancel</button>}
        </div>
      </form>
    </article>
    </>
  )
}
