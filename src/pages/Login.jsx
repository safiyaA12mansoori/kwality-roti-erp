import { useState } from 'react'
import { useStore } from '../store'
import { Brand, Field } from '../ui'

export function Login() {
  const { login } = useStore()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  return (
    <div className="login-screen">
      <article className="card login-card">
        <Brand />
        <h1>Sign in</h1>
        <p className="muted">Admin sees dashboard and statements. Staff enter hotels, workers, raw material, and walk-in sales.</p>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            const result = login(username, password)
            if (!result.ok) {
              setError(result.reason)
              return
            }
            location.hash = result.session.role === 'admin' ? 'today' : 'orders'
          }}
        >
          <div className="stack">
            <Field label="Username">
              <input value={username} autoComplete="username" onChange={(event) => setUsername(event.target.value)} />
            </Field>
            <Field label="Password">
              <input type="password" value={password} autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} />
            </Field>
            {error && <p className="form-error">{error}</p>}
            <button className="btn primary big" type="submit">Enter</button>
            <p className="muted">Try: admin / admin123 or staff / staff123</p>
          </div>
        </form>
      </article>
    </div>
  )
}
