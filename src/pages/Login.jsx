import { useState } from 'react'
import { useStore } from '../store'
import { Brand, Field } from '../ui'

const MAIL = 'kwalityroti@gmail.com'

function EyeIcon({ off }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="12" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
      {off && <path d="M5 19 19 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
    </svg>
  )
}

function SecretField({ label, value, onChange, autoComplete }) {
  const [visible, setVisible] = useState(false)
  return (
    <Field label={label}>
      <span className="secret-field">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          autoComplete={autoComplete}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          className="eye-btn"
          type="button"
          aria-label={visible ? 'Hide password' : 'Show password'}
          onClick={() => setVisible((open) => !open)}
        >
          <EyeIcon off={visible} />
        </button>
      </span>
    </Field>
  )
}

export function Login() {
  const { state, login, setPassword } = useStore()
  const [username, setUsername] = useState('')
  const [password, setPasswordValue] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [step, setStep] = useState('login')
  const [otp, setOtp] = useState('')
  const [nextPassword, setNextPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)

  function knownLogin(value) {
    const name = String(value || '').trim().toLowerCase()
    return state.users.some((user) => user.username === name)
  }

  async function sendCode(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    const name = username.trim().toLowerCase()
    if (!name) {
      setError('Enter the login id.')
      return
    }
    if (!knownLogin(name)) {
      setError('Unknown login.')
      return
    }
    setBusy(true)
    try {
      const response = await fetch('https://kwalityroti.com/api/otp.php?action=send', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({ username: name }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(data.error || 'Could not send the code.')
        return
      }
      setStep('reset')
      setNotice(`Code sent to ${MAIL}.`)
    } catch {
      setError('Could not reach the mail server.')
    } finally {
      setBusy(false)
    }
  }

  async function savePassword(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    if (!/^\d{6}$/.test(otp.trim())) {
      setError('Enter the 6 digit code from the email.')
      return
    }
    if (nextPassword.length < 4) {
      setError('Use at least 4 characters.')
      return
    }
    if (nextPassword !== confirm) {
      setError('The two passwords do not match.')
      return
    }
    setBusy(true)
    try {
      const response = await fetch('https://kwalityroti.com/api/otp.php?action=check', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({ username: username.trim().toLowerCase(), otp: otp.trim() }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(data.error || 'That code is wrong or expired.')
        return
      }
      const result = setPassword(username, nextPassword)
      if (!result.ok) {
        setError(result.reason)
        return
      }
      setPasswordValue('')
      setOtp('')
      setNextPassword('')
      setConfirm('')
      setStep('login')
      setNotice('Password updated. Sign in with the new password.')
    } catch {
      setError('Could not reach the mail server.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-screen">
      <article className="card login-card">
        <Brand />
        <h1>Sign in</h1>
        {step === 'login' && (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              setNotice('')
              const result = login(username, password)
              if (!result.ok) {
                setError(result.reason)
                return
              }
              location.hash = result.session.role === 'admin' ? 'today' : result.session.role === 'owner' ? 'home' : 'orders'
            }}
          >
            <div className="stack">
              <Field label="Login id">
                <input value={username} autoComplete="username" onChange={(event) => setUsername(event.target.value)} />
              </Field>
              <SecretField label="Password" value={password} autoComplete="current-password" onChange={setPasswordValue} />
              {error && <p className="form-error">{error}</p>}
              {notice && <p className="ok">{notice}</p>}
              <button className="btn primary big" type="submit">Enter</button>
              <button
                className="link-btn"
                type="button"
                onClick={() => {
                  setError('')
                  setNotice('')
                  setStep('forgot')
                }}
              >
                Forgot password
              </button>
            </div>
          </form>
        )}
        {step === 'forgot' && (
          <form onSubmit={sendCode}>
            <div className="stack">
              <Field label="Login id">
                <input value={username} autoComplete="username" onChange={(event) => setUsername(event.target.value)} />
              </Field>
              <p className="muted">A code will be sent to {MAIL}.</p>
              {error && <p className="form-error">{error}</p>}
              <button className="btn primary big" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send code'}</button>
              <button className="link-btn" type="button" onClick={() => { setError(''); setStep('login') }}>Back to sign in</button>
            </div>
          </form>
        )}
        {step === 'reset' && (
          <form onSubmit={savePassword}>
            <div className="stack">
              {notice && <p className="ok">{notice}</p>}
              <Field label="Code from email">
                <input value={otp} inputMode="numeric" autoComplete="one-time-code" onChange={(event) => setOtp(event.target.value)} />
              </Field>
              <SecretField label="New password" value={nextPassword} autoComplete="new-password" onChange={setNextPassword} />
              <SecretField label="Confirm password" value={confirm} autoComplete="new-password" onChange={setConfirm} />
              {error && <p className="form-error">{error}</p>}
              <button className="btn primary big" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save new password'}</button>
              <button className="link-btn" type="button" onClick={sendCode} disabled={busy}>Send a new code</button>
              <button className="link-btn" type="button" onClick={() => { setError(''); setNotice(''); setStep('login') }}>Back to sign in</button>
            </div>
          </form>
        )}
      </article>
    </div>
  )
}
