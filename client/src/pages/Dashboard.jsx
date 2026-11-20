import { useAuth } from '../auth/auth-context'
import { Link } from 'react-router-dom'
import Workspace from '../components/Workspace'
import DashboardSummary from '../reports/DashboardSummary'

const labels = { admin: 'Administrator', manager: 'Manager', employee: 'Employee' }
export default function Dashboard() {
  const { user } = useAuth()
  return <Workspace>
    <p className="text-sm font-semibold uppercase tracking-widest text-green-700">{labels[user.role]} workspace</p>
    <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Welcome, {user.full_name || user.username}.</h1>
    <p className="mt-4 text-lg text-slate-600">Review the product catalog and recorded batch inventory.</p>
    {['admin','manager'].includes(user.role) && <DashboardSummary />}
    <section className="mt-10 grid gap-5 md:grid-cols-2">
      {[[ '/pos', 'Cashier workspace', 'Search products and complete regular-price cash sales.' ],[ '/products', 'Product catalog', 'Find products, generic names and stock availability.' ],[ '/inventory', 'Batch inventory', 'Check quantities and expiry dates across your batches.' ]].map(([to,title,text]) => <Link key={to} to={to} className="rounded-2xl border border-green-100 bg-white p-8 shadow-sm transition hover:border-green-500 focus-visible:outline-2 focus-visible:outline-green-700"><h2 className="text-xl font-semibold text-green-900">{title}</h2><p className="mt-3 leading-relaxed text-slate-600">{text}</p></Link>)}
    </section>
  </Workspace>
}
