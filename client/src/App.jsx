import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AuthProvider from './auth/AuthProvider'
import { useAuth } from './auth/auth-context'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Products from './pages/Products'
import Inventory from './pages/Inventory'
import Purchasing from './pages/Purchasing'
import Pos from './pages/Pos'
import Reports from './pages/Reports'
import Users from './pages/Users'
import AuditLogs from './pages/AuditLogs'
import Alerts from './pages/Alerts'
import ReorderThresholds from './pages/ReorderThresholds'
import Approvals from './pages/Approvals'
import ControlledWorkflows from './pages/ControlledWorkflows'
import Notifications from './pages/Notifications'

function Protected({ role, management, children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (management && !['admin', 'manager'].includes(user.role)) return <Navigate to={`/${user.role}`} replace />
  if (role && user.role !== role) return <Navigate to={`/${user.role}`} replace />
  return children || <Dashboard />
}
function AppRoutes() {
  const { user, loading } = useAuth()
  if (loading) return <main className="flex min-h-svh items-center justify-center bg-green-50 text-green-900" role="status">Checking your session…</main>
  return <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/products" element={<Protected><Products /></Protected>} />
    <Route path="/inventory" element={<Protected><Inventory /></Protected>} />
    <Route path="/alerts" element={<Protected><Alerts /></Protected>} />
    <Route path="/notifications" element={<Protected role="admin"><Notifications /></Protected>} />
    <Route path="/reorder-thresholds" element={<Protected role="admin"><ReorderThresholds /></Protected>} />
    <Route path="/approvals" element={<Protected management><Approvals /></Protected>} />
    <Route path="/adjustments" element={<Protected><ControlledWorkflows kind="adjustments" /></Protected>} />
    <Route path="/returns" element={<Protected><ControlledWorkflows kind="returns" /></Protected>} />
    <Route path="/pos" element={<Protected><Pos /></Protected>} />
    <Route path="/reports" element={<Protected management><Reports /></Protected>} />
    <Route path="/users" element={<Protected role="admin"><Users /></Protected>} />
    <Route path="/audit-logs" element={<Protected role="admin"><AuditLogs /></Protected>} />
    {[['suppliers', 'suppliers'], ['purchase-orders', 'orders'], ['stock-ins', 'receiving']].map(([path, kind]) => <Route key={path} path={`/${path}`} element={<Protected management><Purchasing key={kind} kind={kind} /></Protected>} />)}
    {['admin', 'manager', 'employee'].map(role => <Route key={role} path={`/${role}`} element={<Protected role={role} />} />)}
    <Route path="*" element={<Navigate to={user ? `/${user.role}` : '/login'} replace />} />
  </Routes>
}
export default function App() {
  return <BrowserRouter><AuthProvider><AppRoutes /></AuthProvider></BrowserRouter>
}
