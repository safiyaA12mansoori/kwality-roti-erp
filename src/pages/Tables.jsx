import { useState } from 'react'
import { useStore } from '../store'

const TABLES = [
  {
    id: 'hotels',
    label: 'hotels',
    columns: ['id', 'name', 'contact', 'phone', 'address', 'rates', 'active'],
    rows: (state) => state.hotels || [],
  },
  {
    id: 'workers',
    label: 'workers',
    columns: ['id', 'name', 'phone', 'rate', 'active'],
    rows: (state) => state.workers || [],
  },
  {
    id: 'products',
    label: 'products',
    columns: ['id', 'name', 'workerRate', 'hotelRate', 'retailRate', 'active'],
    rows: (state) => state.products || [],
  },
  {
    id: 'orders',
    label: 'orders',
    columns: ['id', 'no', 'date', 'hotelId', 'note', 'lines', 'amount', 'status'],
    rows: (state) => state.orders || [],
  },
  {
    id: 'payments',
    label: 'payments',
    columns: ['id', 'orderId', 'hotelId', 'date', 'amount', 'method', 'note'],
    rows: (state) => state.payments || [],
  },
  {
    id: 'sales',
    label: 'sales',
    columns: ['id', 'no', 'date', 'at', 'customerName', 'phone', 'method', 'lines', 'amount'],
    rows: (state) => state.sales || [],
  },
  {
    id: 'production',
    label: 'production',
    columns: ['id', 'date', 'workerId', 'productId', 'qty', 'rate', 'amount', 'paid', 'payMethod', 'paidOn'],
    rows: (state) => state.production || [],
  },
  {
    id: 'attendance',
    label: 'attendance',
    columns: ['id', 'workerId', 'date', 'present'],
    rows: (state) => state.attendance || [],
  },
  {
    id: 'advances',
    label: 'advances',
    columns: ['id', 'workerId', 'date', 'amount', 'note'],
    rows: (state) => state.advances || [],
  },
  {
    id: 'advanceCuts',
    label: 'advance_cuts',
    columns: ['id', 'workerId', 'date', 'amount', 'method'],
    rows: (state) => state.advanceCuts || [],
  },
  {
    id: 'expenses',
    label: 'expenses',
    columns: ['id', 'date', 'itemId', 'name', 'unit', 'qty', 'amount'],
    rows: (state) => state.expenses || [],
  },
  {
    id: 'users',
    label: 'users',
    columns: ['id', 'name', 'username', 'role'],
    rows: (state) => state.users || [],
  },
  {
    id: 'settings',
    label: 'settings',
    columns: ['name', 'tagline', 'phone', 'address', 'nextBill', 'nextChallan'],
    rows: (state) => [state.settings || {}],
  },
  {
    id: 'personalExpenses',
    label: 'personal_expenses',
    columns: ['id', 'no', 'date', 'category', 'amount', 'method', 'note'],
    rows: (state) => state.personal?.expenses || [],
  },
  {
    id: 'personalIncomes',
    label: 'personal_incomes',
    columns: ['id', 'no', 'date', 'source', 'amount', 'method', 'note'],
    rows: (state) => state.personal?.incomes || [],
  },
]

function columnsFor(rows, preferred) {
  const columns = preferred.filter((key) => key !== 'password')
  for (const row of rows) {
    for (const key of Object.keys(row || {})) {
      if (key === 'password' || key === 'books' || key === 'hint') continue
      if (!columns.includes(key)) columns.push(key)
    }
  }
  return columns
}

function cell(value) {
  if (value == null || value === '') return ''
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (item && typeof item === 'object') {
        return [item.qty, item.productId, item.rate].filter((part) => part != null && part !== '').join(' × ')
      }
      return String(item)
    }).join('; ')
  }
  if (typeof value === 'object') {
    return Object.entries(value).map(([key, item]) => `${key}: ${item}`).join(', ')
  }
  return String(value)
}

export function Tables() {
  const { state } = useStore()
  const [tableId, setTableId] = useState('hotels')
  const table = TABLES.find((item) => item.id === tableId) || TABLES[0]
  const rows = table.rows(state)
  const columns = columnsFor(rows, table.columns)

  return (
    <article className="card">
      <div className="table-picks">
        {TABLES.map((item) => (
          <button
            className={item.id === table.id ? 'btn on' : 'btn'}
            key={item.id}
            type="button"
            onClick={() => setTableId(item.id)}
          >
            {item.label} ({item.rows(state).length})
          </button>
        ))}
      </div>
      <p className="muted">{rows.length} {rows.length === 1 ? 'row' : 'rows'} in {table.label}. This is the database saved in this browser.</p>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={columns.length}>No rows yet.</td></tr>
            )}
            {rows.map((row, index) => (
              <tr key={row.id || index}>
                {columns.map((column) => <td key={column}>{cell(row[column])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  )
}
