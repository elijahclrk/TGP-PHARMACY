import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import Workspace from '../components/Workspace'
import PageHeading from '../components/PageHeading'
import { useInventory } from '../inventory/useInventory'
import { Paging, QueryState, secondaryClass } from '../inventory/shared'
import { PurchasingDetails } from './Purchasing'
import {useWorkflowCapabilities} from '../workflows/useWorkflowCapabilities'
import WorkflowDetails from '../workflows/WorkflowDetails'
import Exchanges from '../workflows/Exchanges'

export default function Approvals() {
  const { user } = useAuth()
  if (!user || !['admin', 'manager'].includes(user.role)) return <Navigate to={user ? `/${user.role}` : '/login'} replace />
  return <ApprovalQueue />
}
function ApprovalQueue() {
  const [status, setStatus] = useState('pending')
  const [kind, setKind] = useState('orders')
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [selected, setSelected] = useState(null)
  const workflows=useWorkflowCapabilities()
  const exchanges=useInventory('/exchanges/availability')
  // Rejection is supported only by the controlled workflows. Background
  // purchasing reads must retain their own supported status contract.
  const purchasingStatus=status==='rejected'?'pending':status
  const orders = useInventory(`/purchase-orders?status=${purchasingStatus}&page=${kind === 'orders' ? page : 1}&limit=20`, revision)
  const receiving = useInventory(`/stock-ins?status=${purchasingStatus}&page=${kind === 'receiving' ? page : 1}&limit=20`, revision)
  const controlled=useInventory(workflows.enabled?`/workflows/${['adjustments','returns','dispositions'].includes(kind)?kind:'adjustments'}?status=${status}&page=${page}&limit=20`:'/workflows/capabilities',revision)
  const isControlled=['adjustments','returns','dispositions'].includes(kind)
  const result = isControlled?controlled:kind === 'orders' ? orders : receiving
  const key = isControlled?({adjustments:'adjustment_id',returns:'return_id',dispositions:'disposition_id'})[kind]:kind === 'orders' ? 'po_id' : 'stock_in_id'
  const path = kind === 'orders' ? '/purchase-orders' : '/stock-ins'
  const refresh = () => setRevision(value => value + 1)
  const change = work => { work(); setPage(1); setSelected(null) }
  return <Workspace>
    <PageHeading title="Approvals" description="Review purchasing and available controlled inventory requests." action={<button className={secondaryClass} onClick={refresh}>Refresh approvals</button>} />
    {kind!=='exchanges'&&<div className="mb-4 flex gap-3" role="group" aria-label="Approval status">{[['pending', 'Pending'], ['approved', 'Approved']].map(([value, label]) => <button className={secondaryClass} key={value} aria-pressed={status === value} onClick={() => change(() => setStatus(value))}>{label}</button>)}</div>}
    {exchanges.data?.data?.available&&<button className={secondaryClass} aria-pressed={kind==='exchanges'} onClick={()=>change(()=>setKind('exchanges'))}>Exchanges</button>}
    <div className="mb-5 flex gap-3" role="group" aria-label="Request type">{[['orders', 'Purchase orders', orders], ['receiving', 'Stock-in', receiving],...(workflows.enabled?[['adjustments','Adjustments',null],['returns','Returns',null],['dispositions','Dispositions',null]]:[])].map(([value, label, data]) => <button className={secondaryClass} key={value} aria-pressed={kind === value} onClick={() => change(() => {setKind(value);if(['orders','receiving'].includes(value)&&status==='rejected')setStatus('pending')})}>{label}{data&&!data.loading && !data.error ? ` (${data.data.total})` : ''}</button>)}</div>
    {isControlled&&<button className={secondaryClass} aria-pressed={status==='rejected'} onClick={()=>change(()=>setStatus('rejected'))}>Rejected history</button>}
    {kind==='exchanges'?<Exchanges approvalsOnly/>:<section className="table-frame" aria-label="Approval requests"><QueryState result={result} retry={refresh} empty="No matching approval requests" />
      {!result.loading && !result.error && result.data?.data.length > 0 && <table><thead><tr>{['Reference', isControlled?'Reason':'Supplier', 'Requested by', 'Status', 'Action'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{result.data.data.map(row => <tr key={row[key]}><td>#{row[key]} {row.delivery_ref}</td><td>{isControlled?row.reason:row.supplier_name}</td><td>User #{isControlled?(row.adjusted_by??row.processed_by??row.requested_by):(row.created_by??row.received_by)}</td><td>{isControlled?row.decision_state:row.approved_by ? 'Approved' : 'Pending'}</td><td><button className="font-semibold text-red-700" aria-label={`Review ${isControlled?kind:kind === 'orders' ? 'purchase order' : 'stock-in'} ${row[key]}`} onClick={() => setSelected(row[key])}>{isControlled&&row.decision_state!=='pending'?'View history':'Review'}</button></td></tr>)}</tbody></table>}
      {!result.loading && !result.error && result.data && <Paging data={result.data} onPage={value => { setSelected(null); setPage(value) }} />}
    </section>}
    {selected && (isControlled?<WorkflowDetails key={`${kind}:${selected}`} kind={kind} id={selected} revision={revision} onChanged={refresh}/>:<PurchasingDetails key={`${kind}:${selected}`} kind={kind} path={path} id={selected} revision={revision} onApproved={refresh} />)}
    <p className="mt-5 text-sm text-slate-500">Purchase-order approval does not post stock. Stock-in approval posts once; current purchasing self-approval permissions are preserved. Adjustments and returns require independent management review. Normal cash sales and valid statutory sales require no routine approval. Statutory checkout remains unavailable.</p>
  </Workspace>
}
