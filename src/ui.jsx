import { useEffect, useState } from 'react'
import { moneyInput, whole } from './calc'
import { addDaysISO } from './format'

export function Brand({ subtitle }) {
  return (
    <div className="brand">
      <img className="logo" src="/logo.jpg" alt="Kwality Foods" />
      <div>
        <strong>Kwality Foods</strong>
        <em>{subtitle || 'Homemade Chapatis'}</em>
      </div>
    </div>
  )
}

export function SearchBar({ value, onChange, placeholder = 'Search', className = '' }) {
  return (
    <input
      className={`search ${className}`.trim()}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      type="search"
    />
  )
}

export function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-back" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <h2>{title}</h2>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Close">×</button>
        </header>
        {children}
      </div>
    </div>
  )
}

export function Avatar({ name }) {
  const letter = String(name || '?').trim().slice(0, 1).toUpperCase() || '?'
  return <div className="wage-avatar" aria-hidden="true">{letter}</div>
}

export function EmptyState({ title, text, action }) {
  return (
    <div className="empty-hero">
      <strong>{title}</strong>
      {text && <p className="muted">{text}</p>}
      {action}
    </div>
  )
}

export function DayNav({ date, onChange }) {
  return (
    <div className="day-nav">
      <button className="btn day-shift" type="button" onClick={() => onChange(addDaysISO(date, -1))} aria-label="Previous day">‹</button>
      <label className="datebox">
        <span className="date-label">Day</span>
        <input type="date" value={date} onChange={(event) => { if (event.target.value) onChange(event.target.value) }} />
      </label>
      <button className="btn day-shift" type="button" onClick={() => onChange(addDaysISO(date, 1))} aria-label="Next day">›</button>
    </div>
  )
}

export function QtyStepper({ value, onCommit, disabled, jumps = [10, 50] }) {
  const n = whole(value)
  return (
    <div className="qty-step">
      {jumps.slice().reverse().map((jump) => (
        <button key={`m${jump}`} className="btn" type="button" disabled={disabled} onClick={() => onCommit(Math.max(0, n - jump))}>−{jump}</button>
      ))}
      <button className="btn" type="button" disabled={disabled} onClick={() => onCommit(Math.max(0, n - 1))}>−</button>
      <NumberBox value={n} onCommit={onCommit} disabled={disabled} />
      <button className="btn" type="button" disabled={disabled} onClick={() => onCommit(n + 1)}>+</button>
      {jumps.map((jump) => (
        <button key={`p${jump}`} className="btn" type="button" disabled={disabled} onClick={() => onCommit(n + jump)}>+{jump}</button>
      ))}
    </div>
  )
}

export function NumberBox({ value, onCommit, disabled, placeholder = '0', decimal = false, className = 'qty' }) {
  const shown = value ? String(value) : ''
  const [text, setText] = useState(shown)
  const [focus, setFocus] = useState(false)

  useEffect(() => {
    if (!focus) setText(shown)
  }, [shown, focus])

  return (
    <input
      className={className}
      inputMode={decimal ? 'decimal' : 'numeric'}
      disabled={disabled}
      value={text}
      placeholder={placeholder}
      aria-label={placeholder}
      onFocus={() => setFocus(true)}
      onChange={(event) => {
        const next = event.target.value
        setText(next)
        onCommit(decimal ? moneyInput(next) : whole(next))
      }}
      onBlur={(event) => {
        const next = event.currentTarget.value
        setFocus(false)
        setText(next)
        onCommit(decimal ? moneyInput(next) : whole(next))
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
      }}
    />
  )
}

export function Glyph({ name }) {
  const pen = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  }
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      {name === 'today' && <><circle cx="12" cy="12" r="8" {...pen} /><path d="M12 8v5l3 2" {...pen} /></>}
      {name === 'count' && <><path d="M4 19V5M4 19h16" {...pen} /><path d="M8 16v-4M12 16V8M16 16v-6" {...pen} /></>}
      {name === 'wages' && <path d="M12 3v18M17 7.5c-.8-1.6-2.4-2.5-5-2.5-3 0-4.5 1.4-4.5 3.2 0 4.6 10 1.6 10 5.6 0 2-1.8 3.4-5 3.4-2.8 0-4.6-.9-5.5-2.4" {...pen} />}
      {name === 'counter' && <><path d="M4 7h16l-1.2 8.2a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8L4 7z" {...pen} /><path d="M8 7V5.5A2.5 2.5 0 0 1 10.5 3h3A2.5 2.5 0 0 1 16 5.5V7" {...pen} /></>}
      {name === 'orders' && <><path d="M6 4h12v16H6z" {...pen} /><path d="M9 8h6M9 12h6M9 16h3" {...pen} /></>}
      {name === 'hotels' && <path d="M4 20V9l8-5 8 5v11M9 20v-6h6v6" {...pen} />}
      {name === 'workers' && <><circle cx="9" cy="9" r="3" {...pen} /><path d="M3.8 19c.6-2.8 2.7-4.2 5.2-4.2s4.6 1.4 5.2 4.2" {...pen} /><circle cx="17" cy="10" r="2" {...pen} /><path d="M16 14.8c1.5.2 2.8 1 3.6 2.4" {...pen} /></>}
      {name === 'prices' && <><path d="M4 12V6h6l10 10-6 6L4 12z" {...pen} /><circle cx="8.5" cy="8.5" r="1" fill="currentColor" stroke="none" /></>}
      {name === 'costs' && <path d="M5 8h14v10H5zM5 8l2-3h10l2 3M12 11v4M10 13h4" {...pen} />}
      {name === 'reports' && <path d="M5 19V5M5 19h14M8 16l3-4 3 2 4-6" {...pen} />}
      {name === 'settings' && <><circle cx="12" cy="12" r="3" {...pen} /><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M18 6l-1.6 1.6M7.6 16.4 6 18" {...pen} /></>}
      {name === 'attend' && <><rect x="4" y="5" width="16" height="15" rx="2" {...pen} /><path d="M8 3v4M16 3v4M8 12l2.2 2.2L16 9" {...pen} /></>}
    </svg>
  )
}

export function go(id) {
  location.hash = id
}
