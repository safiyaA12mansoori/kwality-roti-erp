import { useState } from 'react'
import { hotelPrice, workerPrice } from '../calc'
import { inr } from '../format'
import { useStore } from '../store'
import { NumberBox, SearchBar } from '../ui'

export function Prices() {
  const { state, saveProduct, saveWorker, saveHotel } = useStore()
  const [query, setQuery] = useState('')
  const chapati = state.products.find((product) => product.id === 'p-chapati') || state.products[0]
  const needle = query.trim().toLowerCase()
  if (!chapati) {
    return <article className="card"><p className="empty">Chapati price is missing.</p></article>
  }
  const workers = state.workers
    .filter((worker) => worker.active !== false)
    .filter((worker) => !needle || worker.name.toLowerCase().includes(needle) || worker.phone.includes(needle))
  const hotels = state.hotels
    .filter((hotel) => hotel.active !== false)
    .filter((hotel) => !needle || [hotel.contact, hotel.phone, hotel.address, hotel.name].join(' ').toLowerCase().includes(needle))

  return (
    <>
      <article className="card">
        <div className="card-head">
          <h2>Default chapati price</h2>
          <SearchBar value={query} onChange={setQuery} placeholder="Search worker or hotel" />
        </div>
        <p className="muted">Tap a box and type. Search a worker or hotel below to jump to their rate.</p>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Item</th>
                <th className="num">Default worker rate</th>
                <th className="num">Default hotel rate</th>
                <th className="num">Walk-in rate</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Chapati</strong></td>
                <td className="num">
                  <NumberBox decimal value={chapati.workerRate} onCommit={(workerRate) => saveProduct({ ...chapati, name: 'Chapati', workerRate })} />
                </td>
                <td className="num">
                  <NumberBox decimal value={chapati.hotelRate} onCommit={(hotelRate) => saveProduct({ ...chapati, name: 'Chapati', hotelRate })} />
                </td>
                <td className="num">
                  <NumberBox decimal value={chapati.retailRate} onCommit={(retailRate) => saveProduct({ ...chapati, name: 'Chapati', retailRate })} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <article className="card">
        <h2>Each worker’s rate</h2>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Worker</th>
                <th className="num">Pay per chapati</th>
              </tr>
            </thead>
            <tbody>
              {workers.map((worker) => (
                <tr key={worker.id}>
                  <td>{worker.name}</td>
                  <td className="num">
                    <NumberBox
                      decimal
                      value={workerPrice(chapati, worker)}
                      onCommit={(rate) => saveWorker({ ...worker, rate })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <article className="card">
        <h2>Each hotel’s rate</h2>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Hotel</th>
                <th className="num">Hotel pays per chapati</th>
              </tr>
            </thead>
            <tbody>
              {hotels.map((hotel) => (
                <tr key={hotel.id}>
                  <td>
                    {hotel.contact || hotel.phone}
                    <div className="muted">{[hotel.phone, hotel.address].filter(Boolean).join(' · ')}</div>
                  </td>
                  <td className="num">
                    <NumberBox
                      decimal
                      value={hotelPrice(chapati, hotel)}
                      onCommit={(rate) => saveHotel({ ...hotel, rates: { ...hotel.rates, 'p-chapati': rate } })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </>
  )
}
