import { useAuth } from '../auth/auth-context'
import { Link } from 'react-router-dom'
import Workspace from '../components/Workspace'
import PageHeading from '../components/PageHeading'
import DashboardSummary from '../reports/DashboardSummary'

export default function Dashboard() {
  const { user } = useAuth()
  return <Workspace>
    <PageHeading title="Your pharmacy, at a glance." description={`Welcome, ${user.full_name || user.username}. Here's what's happening at Lawang Bato today.`} date />
    {['admin','manager'].includes(user.role) && <DashboardSummary />}
    <section className="mt-5 grid gap-5 md:grid-cols-2">
      {[[ '/pos', 'Cashier workspace', 'Search products and complete regular-price cash sales.' ],[ '/products', 'Product catalog', 'Find products, generic names and stock availability.' ],[ '/inventory', 'Batch inventory', 'Check quantities and expiry dates across your batches.' ]].map(([to,title,text]) => <Link key={to} to={to} className="rounded-sm border border-slate-200 bg-white p-8 shadow-none transition hover:border-red-400 focus-visible:outline-2 focus-visible:outline-red-700"><h2 className="text-xl font-semibold text-slate-800">{title}</h2><p className="mt-3 leading-relaxed text-slate-600">{text}</p></Link>)}
    </section>
  </Workspace>
}
