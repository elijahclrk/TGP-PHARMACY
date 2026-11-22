import { useAuth } from '../auth/auth-context'
import Icon from './Icon'

const descriptions = {
  Products: 'A clear view of every medicine, down to the last batch.',
  Batches: 'Check batch quantities, recorded prices, and expiry dates.',
  Suppliers: 'Your partners in reliable medicine supply.',
  'Purchase orders': 'Keep your shelves stocked and your orders organized.',
  'Stock-in': 'Record incoming medicines with complete batch information.',
  'Point of Sale': 'A little care, in every transaction.',
  Reports: 'Understand performance. Make informed decisions.',
  'User accounts': 'Manage your team and their assigned access.',
  'Audit logs': 'A traceable record of recorded account and business actions.',
  'Inventory alerts': 'Act early. Keep essential medicines available and safe.',
}
export default function PageHeading({ title, description, action, date = false }) {
  const { user } = useAuth()
  return <div className="page-heading"><div><h1>{title}</h1><p className="sr-only">{user.role[0].toUpperCase() + user.role.slice(1)} workspace</p>{(description || descriptions[title]) && <p className="page-subtitle">{description || descriptions[title]}</p>}</div>{action || (date && <p className="page-date"><Icon name="calendar" />{new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'full' }).format(new Date())}</p>)}</div>
}
