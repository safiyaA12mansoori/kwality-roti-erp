import { useState } from 'react'
import { useStore } from '../store'
import { Avatar, EmptyState, SearchBar } from '../ui'

export function Attendance() {
  const { state, date, setAttendance } = useStore()
  const [query, setQuery] = useState('')
  const needle = query.trim().toLowerCase()
  const workers = state.workers
    .filter((worker) => worker.active !== false)
    .filter((worker) => !needle || worker.name.toLowerCase().includes(needle) || worker.phone.includes(needle))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
  const presentCount = workers.filter((worker) =>
    (state.attendance || []).some((row) => row.date === date && row.workerId === worker.id && row.present),
  ).length
  const unmarked = workers.filter((worker) => !(state.attendance || []).some((row) => row.date === date && row.workerId === worker.id)).length

  function mark(workerId) {
    return (state.attendance || []).find((row) => row.date === date && row.workerId === workerId)
  }

  return (
    <>
      <article className="card">
        <div className="card-head">
          <div>
            <p className="eyebrow">Today</p>
            <h2>{presentCount} present · {unmarked} not marked</h2>
          </div>
          <SearchBar value={query} onChange={setQuery} placeholder="Search worker name or phone" />
        </div>
        <p className="muted">Tap Present or Absent. You can change it any time today.</p>
      </article>
      {workers.length === 0 && (
        <article className="card"><EmptyState title="No workers" text="Add makers on Worker entry first." /></article>
      )}
      <div className="attend-grid">
        {workers.map((worker) => {
          const row = mark(worker.id)
          const present = row?.present
          return (
            <article className={`wage-card ${present === true ? 'paid' : present === false ? 'due' : ''}`} key={worker.id}>
              <div className="wage-card-top">
                <Avatar name={worker.name} />
                <div>
                  <h3>{worker.name}</h3>
                  <div className="muted">{worker.phone || 'No phone'}</div>
                </div>
                {present === true && <span className="badge paid">Present</span>}
                {present === false && <span className="badge due">Absent</span>}
                {present == null && <span className="badge wait">Tap below</span>}
              </div>
              <div className="method-grid">
                <button className={present === true ? 'btn good' : 'btn'} type="button" onClick={() => setAttendance(worker.id, true)}>Present</button>
                <button className={present === false ? 'btn on' : 'btn'} type="button" onClick={() => setAttendance(worker.id, false)}>Absent</button>
              </div>
            </article>
          )
        })}
      </div>
    </>
  )
}
