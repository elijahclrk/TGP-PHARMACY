import { useState } from 'react'
import { useAuth } from '../auth/auth-context'
import { loadCheckout,saveCheckout,clearCheckout } from '../checkout-recovery'
import Workspace from '../components/Workspace'
import { requestJson } from '../auth/api'
import { useInventory } from '../inventory/useInventory'
import { buttonClass, secondaryClass, fieldClass, Paging, QueryState } from '../inventory/shared'

function Receipt({ data }) {
  return <section aria-label="Receipt" className="mt-6 rounded-xl border border-green-200 bg-white p-6">
    <h2 className="text-2xl font-bold text-green-900">Transaction complete</h2>
    <p className="mt-3 break-all">{data.receipt_no}</p>
    <p className="text-sm text-slate-600">Cashier: {data.username} · {new Date(data.sale_date).toLocaleString('en-PH', { timeZone:'Asia/Manila' })}</p>
    <div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Product / batch','Quantity','Unit price','Amount'].map(text => <th key={text} className="p-3">{text}</th>)}</tr></thead><tbody>{data.items.map(item => <tr key={item.sale_item_id} className="border-t border-slate-100"><td className="p-3">{item.product_name}<div className="text-xs text-slate-500">{item.batch_no} · Expiry {item.expiry_date}</div></td><td className="p-3">{item.quantity}</td><td className="p-3">PHP {item.unit_price}</td><td className="p-3">PHP {item.line_total}</td></tr>)}</tbody></table></div>
    <p className="mt-5 text-xl font-bold">Total: PHP {data.total_amount}</p>
    {data.payments.map((payment,index) => <p key={index} className="mt-2">Cash received: PHP {payment.amount_paid} · Change: PHP {payment.change_due}</p>)}
    <p className="mt-4 text-xs text-slate-500">MVP transaction confirmation. Fiscal receipt requirements remain subject to validation.</p>
  </section>
}
export default function Pos() {
  const {user}=useAuth()
  return <CashierPos key={user.user_id} user={user}/>
}
function CashierPos({user}) {
  const [recovery]=useState(()=>{try{return {payload:loadCheckout(user.user_id)}}catch{return {error:'Saved checkout cannot be read. Checkout is blocked; restore browser storage or contact your administrator.'}}})
  const storageError=recovery.error
  const [query,setQuery] = useState({ q:'',page:1 })
  const [revision,setRevision] = useState(0)
  const [cart,setCart] = useState([])
  const [quote,setQuote] = useState(null)
  const [cash,setCash] = useState('')
  const [pending,setPending] = useState(false)
  const [attempt,setAttempt] = useState(recovery.payload||null)
  const [error,setError] = useState('')
  const [receipt,setReceipt] = useState(null)
  const result = useInventory(`/pos/products?${new URLSearchParams({ ...query,limit:20 })}`,revision)
  const locked = pending || Boolean(attempt) || Boolean(storageError)
  async function recover() {
    setPending(true);setError('')
    try {
      const response=await requestJson(`/pos/checkouts/${attempt.request_id}`)
      if(response.data.status==='completed') {
        setReceipt(response.data.receipt);clearCheckout(user.user_id);setAttempt(null);setCart([]);setQuote(null);setCash('');setRevision(value=>value+1)
      } else setError('No committed sale found for this reference. This does not prove failure of a delayed request. Retry only this saved checkout; do not create a replacement transaction.')
    } catch {setError('Status remains uncertain. Sign in as the original cashier if needed, then check again. The saved checkout is retained.')}
    finally {setPending(false)}
  }
  function changeCart(items) { setCart(items); setQuote(null); setError(''); setReceipt(null) }
  async function review() {
    setPending(true); setError('')
    try { setQuote((await requestJson('/pos/quote',{ method:'POST',body:JSON.stringify({ items:cart.map(({ product_id,quantity }) => ({ product_id,quantity:Number(quantity) })) }) })).data) }
    catch (failure) { setQuote(null); setError(failure.status ? failure.message : 'Unable to review the cart. Try again.') }
    finally { setPending(false) }
  }
  async function checkout(event) {
    event.preventDefault(); setPending(true); setError('')
    const payload = attempt || { request_id:crypto.randomUUID(),amount_paid:cash,items:cart.map(({ product_id,quantity }) => ({ product_id,quantity:Number(quantity) })) }
    setAttempt(payload)
    try {
      const saved=loadCheckout(user.user_id)
      if(saved && saved.request_id!==payload.request_id){setAttempt(saved);throw new Error('Another saved checkout requires recovery.')}
      saveCheckout(user.user_id,payload)
      const response = await requestJson('/pos/checkout',{ method:'POST',body:JSON.stringify(payload) })
      clearCheckout(user.user_id)
      setReceipt(response.data.receipt); setCart([]); setQuote(null); setCash(''); setAttempt(null); setRevision(value => value+1)
    } catch (failure) {
      const knownFailure = failure.status && failure.status < 500
      setError(knownFailure ? `${failure.message} No replacement checkout was created. Check the saved reference before retrying.` : 'Checkout outcome is uncertain. The saved reference is retained across refresh and sign-in. Check status or retry this same checkout.')
    } finally { setPending(false) }
  }
  return <Workspace>
    <h1 className="text-3xl font-bold">Point of Sale</h1>
    <p className="mt-3 text-slate-600">Regular-price cash sales. Stock is allocated automatically by earliest eligible expiry.</p>
    <p className="my-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Senior Citizen/PWD discounted checkout is unavailable pending validated legal, VAT and approval requirements. This MVP is not ready for production use.</p>
    {receipt && <Receipt data={receipt} />}
    {error && <p role="alert" className="my-5 rounded-lg bg-red-50 p-4 text-red-800">{error}</p>}
    {storageError&&<p role="alert">{storageError}</p>}
    {attempt&&<section aria-label="Saved checkout" className="my-5 rounded-xl border border-amber-300 bg-amber-50 p-5"><h2 className="font-semibold">Saved checkout requires resolution</h2><p className="my-3 break-all">Reference: {attempt.request_id}</p><p className="mb-3">Cash submitted: PHP {attempt.amount_paid}. Cart and payment are locked to prevent a replacement sale.</p><button disabled={pending} className={secondaryClass} onClick={recover}>Check transaction status</button><button disabled={pending} className={`${buttonClass} ml-3`} onClick={checkout}>Retry saved checkout</button></section>}
    <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <form className="flex gap-3 p-5" onSubmit={event => { event.preventDefault(); setQuery({ q:new FormData(event.currentTarget).get('q'),page:1 }) }}>
          <input className={fieldClass} aria-label="Search POS products" name="q" maxLength={200} placeholder="Product or generic name" /><button className={secondaryClass}>Search</button>
        </form>
        <QueryState result={result} retry={() => setRevision(value => value+1)} empty="No products found" />
        {!result.loading && !result.error && result.data?.data.map(product => <div key={product.product_id} className="flex items-center justify-between gap-4 border-t border-slate-100 p-5"><div><p className="font-semibold">{product.name}</p><p className="text-sm text-slate-500">{product.generic_name}</p><p className="mt-1 text-sm">PHP {product.unit_price} · Eligible stock: {product.available}</p></div>
          <button className={secondaryClass} disabled={locked || product.available === '0'} aria-label={`Add ${product.name}`} onClick={() => {
            const found = cart.find(item => item.product_id === product.product_id)
            changeCart(found ? cart.map(item => item === found ? { ...item,quantity:Math.min(2147483647,Number(item.quantity)+1) } : item) : [...cart,{ product_id:product.product_id,name:product.name,quantity:1 }])
          }}>Add</button></div>)}
        {!result.loading && !result.error && result.data && <Paging data={result.data} onPage={page => setQuery(current => ({ ...current,page }))} />}
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold">Cart</h2>
        {!cart.length ? <p className="py-8 text-slate-500">Add a product to begin.</p> : <>
          <fieldset disabled={locked} className="mt-4 space-y-4">{cart.map(item => <div key={item.product_id} className="flex flex-wrap items-end gap-3"><label className="flex-1 text-sm font-medium">{item.name}<input aria-label={`Quantity for ${item.name}`} className={`${fieldClass} mt-2`} type="number" min="1" max="2147483647" step="1" value={item.quantity} onChange={event => changeCart(cart.map(row => row.product_id === item.product_id ? { ...row,quantity:event.target.value } : row))} /></label><button className={secondaryClass} onClick={() => changeCart(cart.filter(row => row.product_id !== item.product_id))}>Remove {item.name}</button></div>)}
            <button className={buttonClass} onClick={review} disabled={!cart.length}>Review total</button>
          </fieldset>
          {quote && <div className="mt-6 border-t border-slate-100 pt-5"><ul className="space-y-2 text-sm">{quote.items.map(item => <li key={item.product_id}>{item.name}: {item.quantity} × PHP {item.unit_price} = PHP {item.line_total}</li>)}</ul>
            <p className="my-4 text-xl font-bold">Total: PHP {quote.total}</p><p className="mb-4 text-xs text-slate-500">Prices and availability are checked again at checkout. Reviewing does not reserve stock.</p>
            <form onSubmit={checkout}><label className="text-sm font-medium">Cash received (PHP)<input aria-label="Cash received (PHP)" className={`${fieldClass} my-2`} value={cash} onChange={event => setCash(event.target.value)} disabled={locked} required inputMode="decimal" pattern="[0-9]{1,20}(\.[0-9]{1,2})?" /></label>
              <button disabled={pending} className={`${buttonClass} mt-3`}>{pending ? 'Processing...' : attempt ? 'Retry same checkout' : 'Complete cash sale'}</button>
            </form>
          </div>}
        </>}
      </section>
    </div>
  </Workspace>
}
