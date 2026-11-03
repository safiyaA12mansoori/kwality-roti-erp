import { Component, useEffect, useState } from 'react'
import { Costs } from './pages/Costs'
import { Counter } from './pages/Counter'
import { Count } from './pages/Count'
import { Hotels } from './pages/Hotels'
import { Login } from './pages/Login'
import { Orders } from './pages/Orders'
import { Prices } from './pages/Prices'
import { OwnerBills, OwnerHome, OwnerMoney, OwnerSpend } from './pages/Owner'
import { Reports } from './pages/Reports'
import { Settings } from './pages/Settings'
import { Attendance } from './pages/Attendance'
import { Today } from './pages/Today'
import { Wages } from './pages/Wages'
import { Workers } from './pages/Workers'
import { useStore } from './store'
import { Brand, DayNav, Glyph } from './ui'

const PAGES = [
  { id: 'today', label: 'Dashboard', group: 'Admin', icon: 'today', dated: true, admin: true, blurb: 'See money, pay, and costs. Tap a card to open the page.' },
  { id: 'reports', label: 'Statement', group: 'Admin', icon: 'reports', dated: false, admin: true, blurb: 'Search and print one hotel, worker, or walk-in invoice.' },
  { id: 'count', label: 'Count chapati', group: 'Daily', icon: 'count', dated: true, blurb: 'Tap +10 or +50, or type the count. Then pay workers.' },
  { id: 'wages', label: 'Pay workers', group: 'Daily', icon: 'wages', dated: true, admin: true, blurb: 'Pay 1 day, 1 week, 15 days, or custom. Cash, UPI, or bank.' },
  { id: 'attend', label: 'Attendance', group: 'Daily', icon: 'attend', dated: true, blurb: 'Tap Present or Absent for each worker.' },
  { id: 'counter', label: 'Walk-in sale', group: 'Entry', icon: 'counter', dated: true, blurb: 'Tap chapati, choose Cash or UPI, save the bill.' },
  { id: 'orders', label: 'Hotel orders', group: 'Entry', icon: 'orders', dated: true, blurb: 'Tap a hotel with no order, type qty, save. Then mark completed.' },
  { id: 'hotels', label: 'Hotel entry', group: 'Entry', icon: 'hotels', dated: false, blurb: 'Add contact and phone. Search to find a hotel fast.' },
  { id: 'workers', label: 'Worker entry', group: 'Entry', icon: 'workers', dated: false, blurb: 'Add makers, set their rate, give advance.' },
  { id: 'costs', label: 'Raw material', group: 'Entry', icon: 'costs', dated: true, blurb: 'Tap the item, type quantity and price, Add.' },
  { id: 'prices', label: 'Chapati price', group: 'Admin', icon: 'prices', dated: false, admin: true, blurb: 'Set worker, hotel, and walk-in rates. Search to jump to a name.' },
  { id: 'settings', label: 'Settings', group: 'Admin', icon: 'settings', dated: false, admin: true, blurb: 'Company name, logins, and a backup file on this computer.' },
]

const OWNER_PAGES = [
  { id: 'home', label: 'My dashboard', group: 'Owner', icon: 'home', dated: false, blurb: 'EMI, petrol, rashan, home, education, and other. Day, week, month, or custom.' },
  { id: 'spend', label: 'My expenses', group: 'Owner', icon: 'spend', dated: true, blurb: 'Enter EMI, petrol, rashan, home expenses, education, or other.' },
  { id: 'money', label: 'Money in', group: 'Owner', icon: 'money', dated: true, blurb: 'Add salary or other money so the available balance is correct.' },
  { id: 'bills', label: 'My bills', group: 'Owner', icon: 'bills', dated: false, blurb: 'Print, Word, Excel, or invoice for the period and for each bill.' },
]

function allowedPages(role) {
  if (role === 'owner') return OWNER_PAGES
  if (role === 'admin') return PAGES
  return PAGES.filter((page) => !page.admin)
}

function homePage(role) {
  if (role === 'owner') return 'home'
  return role === 'admin' ? 'today' : 'orders'
}

function readHash(role) {
  const pages = allowedPages(role)
  const id = location.hash.replace('#', '')
  return pages.some((page) => page.id === id) ? id : homePage(role)
}

class Guard extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="crash card">
          <h1>The books hit a snag</h1>
          <p>{this.state.error.message}</p>
          <button className="btn" type="button" onClick={() => location.reload()}>Reload</button>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  const { state, date, session, setDate, logout } = useStore()
  const [pageId, setPageId] = useState(() => readHash(session?.role))
  const [menuOpen, setMenuOpen] = useState(false)
  const pages = allowedPages(session?.role)
  const page = pages.find((item) => item.id === pageId) || pages[0]

  useEffect(() => {
    if (!session) return undefined
    const allowed = allowedPages(session.role)
    const id = location.hash.replace('#', '')
    const next = allowed.some((item) => item.id === id) ? id : homePage(session.role)
    if (location.hash !== `#${next}`) history.replaceState(null, '', `#${next}`)
    setPageId(next)
    const sync = () => {
      const nextPage = readHash(session.role)
      if (location.hash !== `#${nextPage}`) history.replaceState(null, '', `#${nextPage}`)
      setPageId(nextPage)
    }
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [session])

  function go(id) {
    if (location.hash !== `#${id}`) location.hash = id
    setPageId(id)
    setMenuOpen(false)
  }

  if (!session) {
    return (
      <Guard>
        <Login />
      </Guard>
    )
  }

  const makers = state.workers.filter((worker) => worker.active !== false).length
  const hotels = state.hotels.filter((hotel) => hotel.active !== false).length
  let lastGroup = ''

  return (
    <Guard>
      <div className="app" data-page={page.id}>
        {menuOpen && <button className="scrim" type="button" aria-label="Close menu" onClick={() => setMenuOpen(false)} />}
        <aside className={menuOpen ? 'sidebar open' : 'sidebar'}>
          <Brand subtitle={state.settings.tagline || 'Homemade Chapatis'} />
          <nav>
            {pages.map((item) => {
              const group = item.group !== lastGroup ? item.group : ''
              lastGroup = item.group
              return (
                <div key={item.id}>
                  {group && <div className="nav-group">{group}</div>}
                  <button
                    className={`nav-btn tone-${item.id}`}
                    type="button"
                    aria-current={item.id === page.id ? 'page' : undefined}
                    onClick={() => go(item.id)}
                  >
                    <Glyph name={item.icon} />
                    {item.label}
                  </button>
                </div>
              )
            })}
          </nav>
          <p className="side-foot">
            {session.name} · {session.role === 'admin' ? 'Admin' : session.role === 'owner' ? 'Owner' : 'Staff'}
            <br />
            {session.role === 'owner' ? 'Personal books' : `${makers} makers · ${hotels} hotels`}
            <br />
            <button className="btn" type="button" style={{ marginTop: 8 }} onClick={logout}>Sign out</button>
          </p>
        </aside>
        <section className={page.id === 'today' ? 'main dash-main' : 'main'}>
          <header className="topbar">
            <button className="btn menu-btn" type="button" onClick={() => setMenuOpen(true)} aria-label="Menu">Menu</button>
            <div className="top-title">
              <h1>{page.label}</h1>
              <p>{page.blurb}</p>
            </div>
            <div className="top-tools">
              {page.dated && <DayNav date={date} onChange={setDate} />}
            </div>
          </header>
          {session.role !== 'owner' && (
            <div className="quick-row desk-only">
              <button className={page.id === 'count' ? 'btn on' : 'btn'} type="button" onClick={() => go('count')}>Count</button>
              <button className={page.id === 'attend' ? 'btn on' : 'btn'} type="button" onClick={() => go('attend')}>Attendance</button>
              <button className={page.id === 'orders' ? 'btn on' : 'btn'} type="button" onClick={() => go('orders')}>Hotel order</button>
              <button className={page.id === 'counter' ? 'btn on' : 'btn'} type="button" onClick={() => go('counter')}>Walk-in</button>
              {session.role === 'admin' && (
                <button className={page.id === 'wages' ? 'btn on' : 'btn'} type="button" onClick={() => go('wages')}>Pay</button>
              )}
            </div>
          )}
          {session.role === 'owner' && (
            <div className="quick-row desk-only">
              <button className={page.id === 'home' ? 'btn on' : 'btn'} type="button" onClick={() => go('home')}>Dashboard</button>
              <button className={page.id === 'spend' ? 'btn on' : 'btn'} type="button" onClick={() => go('spend')}>Expenses</button>
              <button className={page.id === 'money' ? 'btn on' : 'btn'} type="button" onClick={() => go('money')}>Money in</button>
              <button className={page.id === 'bills' ? 'btn on' : 'btn'} type="button" onClick={() => go('bills')}>Bills</button>
            </div>
          )}
          <div className="page" key={page.id}>
            {page.id === 'today' && <Today />}
            {page.id === 'count' && <Count />}
            {page.id === 'wages' && <Wages />}
            {page.id === 'attend' && <Attendance />}
            {page.id === 'counter' && <Counter />}
            {page.id === 'orders' && <Orders />}
            {page.id === 'hotels' && <Hotels />}
            {page.id === 'workers' && <Workers />}
            {page.id === 'prices' && <Prices />}
            {page.id === 'costs' && <Costs />}
            {page.id === 'reports' && <Reports />}
            {page.id === 'settings' && <Settings />}
            {page.id === 'home' && <OwnerHome />}
            {page.id === 'spend' && <OwnerSpend />}
            {page.id === 'money' && <OwnerMoney />}
            {page.id === 'bills' && <OwnerBills />}
          </div>
          {session.role === 'owner' ? (
            <nav className="bottom-dock" aria-label="Owner books">
              <button className={page.id === 'home' ? 'on' : ''} type="button" onClick={() => go('home')}>
                <Glyph name="home" /><span>Home</span>
              </button>
              <button className={page.id === 'spend' ? 'on' : ''} type="button" onClick={() => go('spend')}>
                <Glyph name="spend" /><span>Spend</span>
              </button>
              <button className={page.id === 'money' ? 'on' : ''} type="button" onClick={() => go('money')}>
                <Glyph name="money" /><span>In</span>
              </button>
              <button className={page.id === 'bills' ? 'on' : ''} type="button" onClick={() => go('bills')}>
                <Glyph name="bills" /><span>Bills</span>
              </button>
            </nav>
          ) : (
            <nav className="bottom-dock" aria-label="Daily work">
              <button className={page.id === 'count' ? 'on' : ''} type="button" onClick={() => go('count')}>
                <Glyph name="count" /><span>Count</span>
              </button>
              <button className={page.id === 'orders' ? 'on' : ''} type="button" onClick={() => go('orders')}>
                <Glyph name="orders" /><span>Hotel</span>
              </button>
              <button className={page.id === 'counter' ? 'on' : ''} type="button" onClick={() => go('counter')}>
                <Glyph name="counter" /><span>Walk-in</span>
              </button>
              {session.role === 'admin' && (
                <button className={page.id === 'wages' ? 'on' : ''} type="button" onClick={() => go('wages')}>
                  <Glyph name="wages" /><span>Pay</span>
                </button>
              )}
              <button className={page.id === 'attend' ? 'on' : ''} type="button" onClick={() => go('attend')}>
                <Glyph name="attend" /><span>Attend</span>
              </button>
            </nav>
          )}
        </section>
      </div>
    </Guard>
  )
}
