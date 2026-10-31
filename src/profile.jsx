import { hotelCard } from './calc'
import { inr, methodLabel, num, prettyDate } from './format'

function Flag({ children, tone }) {
  return <span className={`badge ${tone || 'wait'}`}>{children}</span>
}

export function HotelProfile({ state, book }) {
  const hotel = book.hotel
  const card = hotelCard(hotel)
  if (!hotel) return <p className="empty">Search and tap a hotel.</p>
  return (
    <div className="profile">
      <h2>{card.title}</h2>
      <p className="muted">{[hotel.contact, hotel.phone, hotel.address].filter(Boolean).join(' · ') || 'No phone or address'}</p>
      <section className="stats">
        <article className="stat"><span>Chapati</span><strong>{num(book.pieces)}</strong><em>Delivered in this period</em></article>
        <article className="stat"><span>Bill amount</span><strong>{inr(book.billed)}</strong><em>{num(book.orders.length)} deliveries</em></article>
        <article className="stat"><span>Received</span><strong>{inr(book.collected)}</strong><em>Cash / UPI / bank</em></article>
        <article className={book.balance > 0 ? 'stat warn' : 'stat good'}><span>Still due</span><strong>{inr(book.balance)}</strong><em>On the books</em></article>
      </section>
      <div className="table-wrap ledger">
        <table className="data seq">
          <thead>
            <tr>
              <th>Date</th>
              <th>Delivery</th>
              <th>Challan</th>
              <th>Note</th>
              <th className="num">Chapati qty</th>
              <th className="num">Bill amount</th>
              <th className="num">Received</th>
              <th>How</th>
            </tr>
          </thead>
          <tbody>
            {book.days.map((row) => (
              <tr key={row.date} className={row.orders.length ? '' : 'dim-row'}>
                <td>{prettyDate(row.date)}</td>
                <td>
                  {row.delivery === 'Delivered' && <Flag tone="paid">Delivered</Flag>}
                  {row.delivery === 'Pending' && <Flag tone="wait">Pending</Flag>}
                  {row.delivery === 'No delivery' && <Flag tone="off">No delivery</Flag>}
                </td>
                <td>{row.challans || '—'}</td>
                <td>{row.notes || '—'}</td>
                <td className="num">{row.pieces ? num(row.pieces) : '—'}</td>
                <td className="num">{row.billed ? inr(row.billed) : '—'}</td>
                <td className="num">{row.paid ? inr(row.paid) : '—'}</td>
                <td>{row.methods ? row.methods.split(',').map(methodLabel).join(', ') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function WorkerProfile({ book }) {
  const worker = book.worker
  if (!worker) return <p className="empty">Search and tap a worker.</p>
  return (
    <div className="profile">
      <h2>{worker.name}</h2>
      <p className="muted">{[worker.phone, worker.rate ? `${inr(worker.rate)} each` : ''].filter(Boolean).join(' · ') || 'No phone'}</p>
      <section className="stats">
        <article className="stat"><span>Attendance</span><strong>{num(book.presentDays)}</strong><em>{num(book.absentDays)} absent · rest not marked</em></article>
        <article className="stat"><span>Chapati</span><strong>{num(book.pieces)}</strong><em>Made in this period</em></article>
        <article className="stat"><span>Pay</span><strong>{inr(book.amount)}</strong><em>Still {inr(book.unpaid)}</em></article>
        <article className="stat"><span>Advance left</span><strong>{inr(book.advanceLeft)}</strong><em>Given {inr(book.advanceGiven)} · cut {inr(book.advanceCut)}</em></article>
      </section>
      <div className="table-wrap ledger">
        <table className="data seq">
          <thead>
            <tr>
              <th>Date</th>
              <th>Attendance</th>
              <th className="num">Chapati qty</th>
              <th className="num">Rate</th>
              <th className="num">Pay amount</th>
              <th>Pay status</th>
              <th className="num">Advance taken</th>
              <th className="num">Advance cut</th>
            </tr>
          </thead>
          <tbody>
            {book.days.map((row) => (
              <tr key={row.date} className={row.pieces || row.advanceGiven || row.present != null ? '' : 'dim-row'}>
                <td>{prettyDate(row.date)}</td>
                <td>
                  {row.attendance === 'Present' && <Flag tone="paid">Present</Flag>}
                  {row.attendance === 'Absent' && <Flag tone="due">Absent</Flag>}
                  {row.attendance === 'Not marked' && <Flag tone="off">Not marked</Flag>}
                </td>
                <td className="num">{row.pieces ? num(row.pieces) : '—'}</td>
                <td className="num">{row.rate ? inr(row.rate) : '—'}</td>
                <td className="num">{row.amount ? inr(row.amount) : '—'}</td>
                <td>
                  {row.amount === 0 && '—'}
                  {row.amount > 0 && row.due === 0 && <Flag tone="paid">Paid{row.payMethod ? ` · ${methodLabel(row.payMethod)}` : ''}</Flag>}
                  {row.amount > 0 && row.paid > 0 && row.due > 0 && <Flag tone="wait">Part paid</Flag>}
                  {row.amount > 0 && row.paid === 0 && <Flag tone="due">Due</Flag>}
                </td>
                <td className="num">{row.advanceGiven ? `${inr(row.advanceGiven)}${row.advanceNote ? ` · ${row.advanceNote}` : ''}` : '—'}</td>
                <td className="num">{row.advanceCut ? inr(row.advanceCut) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function WalkInProfile({ state, book }) {
  if (!book) return <p className="empty">Search and tap a customer.</p>
  return (
    <div className="profile">
      <h2>{book.name}</h2>
      <p className="muted">{book.phone || 'No phone'}</p>
      <section className="stats">
        <article className="stat"><span>Bills</span><strong>{num(book.bills)}</strong><em>Walk-in sales</em></article>
        <article className="stat"><span>Chapati</span><strong>{num(book.pieces)}</strong><em>Bought in this period</em></article>
        <article className="stat"><span>Amount</span><strong>{inr(book.amount)}</strong><em>Cash / UPI / bank</em></article>
      </section>
      <div className="table-wrap ledger">
        <table className="data seq">
          <thead>
            <tr>
              <th>Date</th>
              <th>Time</th>
              <th>Bill</th>
              <th>Items</th>
              <th>How</th>
              <th className="num">Chapati qty</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {book.sales.map((sale) => (
              <tr key={sale.id}>
                <td>{prettyDate(sale.date)}</td>
                <td>{(sale.at || '').slice(11, 16) || '—'}</td>
                <td>{sale.no}</td>
                <td>{sale.lines.map((line) => `${num(line.qty)} ${(state.products.find((product) => product.id === line.productId)?.name) || 'Chapati'}`).join(', ')}</td>
                <td>{methodLabel(sale.method)}</td>
                <td className="num">{num(sale.lines.reduce((total, line) => total + (Number(line.qty) || 0), 0))}</td>
                <td className="num">{inr(sale.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
