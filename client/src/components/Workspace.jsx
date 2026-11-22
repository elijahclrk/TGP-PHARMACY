import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Brand from './Brand'
import Icon from './Icon'
import { useAuth } from '../auth/auth-context'
import {useWorkflowCapabilities} from '../workflows/useWorkflowCapabilities'

export default function Workspace({ children }) {
  const { user, logout } = useAuth()
  const workflows=useWorkflowCapabilities()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButton = useRef(null)
  const navigation = useRef(null)
  const location = useLocation()
  const manage = ['admin', 'manager'].includes(user.role)
  const admin = user.role === 'admin'
  const names = { '/pos': 'POS', '/products': 'Products', '/inventory': 'Batches', '/suppliers': 'Suppliers', '/purchase-orders': 'Purchase orders', '/stock-ins': 'Stock-in', '/reports': 'Reports', '/users': 'User accounts', '/audit-logs': 'Audit logs' }
  Object.assign(names, { '/alerts': 'Alerts', '/approvals': 'Approvals', '/reorder-thresholds': 'Reorder thresholds','/returns':'Customer returns','/adjustments':'Inventory adjustments','/notifications':'Notification preferences' })
  const page = names[location.pathname] || 'Dashboard'
  function closeMenu() { setMenuOpen(false) }
  useEffect(() => {
    if (!menuOpen) return
    const panel = navigation.current
    const opener = menuButton.current
    const previousOverflow = document.body.style.overflow
    const controls = () => [...panel.querySelectorAll('a[href], button:not(:disabled)')]
    const focusFirst = () => controls()[0]?.focus()
    document.body.style.overflow = 'hidden'
    focusFirst()
    function containFocus(event) { if (!panel.contains(event.target)) focusFirst() }
    function keyboard(event) {
      if (event.key === 'Escape') { event.preventDefault(); setMenuOpen(false); return }
      if (event.key !== 'Tab') return
      const items = controls()
      const first = items[0], last = items.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    const viewport = window.matchMedia?.('(max-width: 760px)')
    const resize = event => { if (!event.matches) setMenuOpen(false) }
    viewport?.addEventListener('change', resize)
    document.addEventListener('focusin', containFocus)
    document.addEventListener('keydown', keyboard)
    return () => {
      viewport?.removeEventListener('change', resize)
      document.removeEventListener('focusin', containFocus)
      document.removeEventListener('keydown', keyboard)
      document.body.style.overflow = previousOverflow
      if (!viewport || viewport.matches) opener?.focus()
      else (panel.querySelector('[aria-current="page"]') || panel.querySelector('a[href]'))?.focus()
    }
  }, [menuOpen])
  const icons = { Returns:'return',Adjustments:'settings',Approvals: 'shield', Dashboard: 'dashboard', 'POS / Sales': 'cart', 'Product search': 'search', Alerts: 'bell', Products: 'box', Batches: 'archive', Suppliers: 'truck', 'Purchase orders': 'file', 'Stock-in': 'download', 'Sales Reports': 'chart', 'User accounts': 'users', 'Reorder Thresholds': 'settings', 'Audit Logs': 'clock' }
  const roleName = {admin:'Owner / Admin',manager:'Manager',employee:'Employee'}[user.role]
  Object.assign(icons,{Notifications:'bell'})
  function link(path, label, active) {
    const selected = active ?? location.pathname === path
    return <Link key={label} to={path} aria-current={selected ? 'page' : undefined} onClick={closeMenu} className={`sidebar-link ${selected ? 'is-active' : ''}`}><Icon name={icons[label]} /><span>{label}</span></Link>
  }
  const unavailable = (label, note = 'Unavailable') => <div key={label} className="sidebar-unavailable"><Icon name={{Returns:'return',Adjustments:'settings',Approvals:'shield','Discount Rules':'tag',Notifications:'bell'}[label]} /><span>{label}</span><small>{note}</small></div>
  async function signOut() {
    setPending(true)
    try { await logout() } catch { setError('Sign out could not be confirmed. Please try again.') }
    finally { setPending(false) }
  }
  return <div className="workspace">
    <a inert={menuOpen} className="skip-link" href="#main-content">Skip to main content</a>
    {menuOpen && <div className="navigation-backdrop" aria-hidden="true" onClick={closeMenu} />}
    <aside ref={navigation} role={menuOpen ? 'dialog' : undefined} aria-modal={menuOpen ? true : undefined} aria-label={menuOpen ? 'Workspace navigation' : undefined} id="workspace-navigation" className={`workspace-sidebar ${menuOpen ? 'is-open' : ''}`}>
      {menuOpen && <button type="button" className="mobile-navigation-close ui-button ui-button-secondary" onClick={closeMenu}>Close navigation</button>}
      <div className="sidebar-brand"><Brand /></div><div className="branch-card"><Icon name="pin" /><div><strong>Lawang Bato Branch</strong><span>Valenzuela City, Metro Manila</span></div></div>
      <nav aria-label="Workspace">
        <div className="sidebar-group"><p>Overview</p>{link(`/${user.role}`, 'Dashboard')}</div>
        <div className="sidebar-group"><p>Operations</p>{link('/pos', 'POS / Sales')}{workflows.enabled?link('/returns','Returns'):unavailable('Returns')}
          {link('/products#product-search', 'Product search', location.pathname === '/products' && location.hash === '#product-search')}
          {link('/alerts', 'Alerts')}
        </div>
        <div className="sidebar-group"><p>Inventory</p>
          {link('/products', 'Products', location.pathname === '/products' && !location.hash)}
          {link('/inventory', 'Batches')}
          {workflows.enabled&&link('/adjustments','Adjustments')}
          {manage && <>{link('/suppliers', 'Suppliers')}{link('/purchase-orders', 'Purchase orders')}{link('/stock-ins', 'Stock-in')}{!workflows.enabled&&unavailable('Adjustments')}</>}
        </div>
        {manage && <div className="sidebar-group"><p>Management</p>{link('/approvals', 'Approvals')}{link('/reports', 'Sales Reports')}</div>}
        {admin && <div className="sidebar-group"><p>Administration</p>{link('/users', 'User accounts')}{unavailable('Discount Rules')}
          {link('/reorder-thresholds', 'Reorder Thresholds')}
          {link('/notifications','Notifications')}{link('/audit-logs', 'Audit Logs')}
        </div>}
      </nav>
      <div className="sidebar-footer"><p>{roleName}</p><button type="button" onClick={signOut} disabled={pending} className="sidebar-signout"><Icon name="logout" />{pending ? 'Signing out…' : 'Sign out'}</button></div>
    </aside>
    <div className="workspace-body" inert={menuOpen}>
      <header className="workspace-header">
        <button type="button" ref={menuButton} className="mobile-menu-button ui-button ui-button-secondary" aria-expanded={menuOpen} aria-controls="workspace-navigation" onClick={() => setMenuOpen(value => !value)}>Menu</button>
        <p className="workspace-breadcrumb">Workspace <span aria-hidden="true">/</span> {page}</p>
        <div className="workspace-account"><span className="workspace-status"><i aria-hidden="true" />Signed in</span>
          <Link className="inventory-alert-link" to="/alerts" aria-label="View inventory alerts"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg></Link>
          <span className="account-avatar" aria-hidden="true">{(user.full_name || user.username || 'U').split(/\s+/).slice(0, 2).map(part => part[0]).join('')}</span>
          <div className="account-name"><strong>{user.full_name || user.username}</strong><span>{roleName}</span></div>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="workspace-main">{error && <p role="alert" className="mb-6 border border-red-200 bg-red-50 p-4 text-red-800">{error}</p>}{children}</main>
    </div>
  </div>
}
