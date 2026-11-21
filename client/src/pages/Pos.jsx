import { useState } from 'react'
import { useAuth } from '../auth/auth-context'
import { loadCheckout,saveCheckout,clearCheckout } from '../checkout-recovery'
import Workspace from '../components/Workspace'
import BenefitPreparation from '../workflows/BenefitPreparation'
import BenefitCheckout from '../workflows/BenefitCheckout'
import {emptyBenefitDraft} from '../workflows/benefit-draft'
import { formatPHP } from '../utils/money'
import PageHeading from '../components/PageHeading'
import Modal from '../components/Modal'
import { requestJson } from '../auth/api'
import { useInventory } from '../inventory/useInventory'
import { buttonClass, secondaryClass, fieldClass, Paging, QueryState } from '../inventory/shared'

function Receipt({ data, onClose }) {
  return <Modal title="Transaction complete" wide onClose={onClose}><section aria-label="Receipt">
    <p className="receipt-brand">The Generics Pharmacy</p><p className="text-sm text-slate-500">Lawang Bato Branch · Transaction confirmation</p>
    <p className="mt-3 break-all">{data.receipt_no}</p>
    <p className="text-sm text-slate-600">Cashier: {data.username} · {new Date(data.sale_date).toLocaleString('en-PH', { timeZone:'Asia/Manila' })}</p>
    <div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Product / batch','Quantity','Unit price','Amount'].map(text => <th key={text} className="p-3">{text}</th>)}</tr></thead><tbody>{data.items.map(item => <tr key={item.sale_item_id} className="border-t border-slate-100"><td className="p-3">{item.product_name}<div className="text-xs text-slate-500">{item.batch_no} · Expiry {item.expiry_date}</div></td><td className="p-3">{item.quantity}</td><td className="p-3">{formatPHP(item.unit_price)}</td><td className="p-3">{formatPHP(item.line_total)}{data.financial&&<div className="text-xs text-slate-600">Discount {formatPHP(item.discount)} · VAT removed {formatPHP(item.vat_removed)} · VAT charged {formatPHP(item.vat)}</div>}</td></tr>)}</tbody></table></div>
    <p className="mt-5 text-xl font-bold">Total: {formatPHP(data.total_amount)}</p>
    {data.financial&&<section aria-label="Historical benefit breakdown"><p>Benefit: {data.financial.benefit}</p><p>Original gross: {formatPHP(data.financial.gross)} · VAT removed: {formatPHP(data.financial.vatRemoved)} · Discount: {formatPHP(data.financial.discount)} · VAT charged: {formatPHP(data.financial.vat)}</p><p>VATable base: {formatPHP(data.financial.vatable)} · Exempt base: {formatPHP(data.financial.exempt)} · Non-VAT base: {formatPHP(data.financial.nonVat??'0.00')}</p></section>}
    {data.payments.map((payment,index) => <p key={index} className="mt-2">Cash received: {formatPHP(payment.amount_paid)} · Change: {formatPHP(payment.change_due)}</p>)}
    <p className="mt-4 text-xs text-slate-500">MVP transaction confirmation. Fiscal receipt requirements remain subject to validation.</p>
    <button type="button" className={`${secondaryClass} mt-5`} onClick={onClose}>Back to POS</button>
  </section></Modal>
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
  const [receiptOpen,setReceiptOpen] = useState(false)
  const [benefitDraft,setBenefitDraft]=useState(emptyBenefitDraft)
  const availability=useInventory('/pos/benefits/availability',revision)
  const localBenefits=availability.data?.data?.available===true&&availability.data?.data?.local_only===true
  const result = useInventory(`/pos/products?${new URLSearchParams({ ...query,limit:20 })}`,revision)
  const locked = pending || Boolean(attempt) || Boolean(storageError)
  function showCompleted(data, payload) {
    clearCheckout(user.user_id,payload.request_id)
    setReceipt(data);setReceiptOpen(true);setAttempt(null);setCart([]);setQuote(null);setCash('');setRevision(value=>value+1)
    setBenefitDraft(emptyBenefitDraft())
  }
  function correctClosed(payload) {
    clearCheckout(user.user_id,payload.request_id)
    setCart(payload.items.map(item=>({ ...item,name:cart.find(row=>row.product_id===item.product_id)?.name || result.data?.data?.find(row=>row.product_id===item.product_id)?.name || `Product #${item.product_id}` })))
    setCash(payload.amount_paid);setQuote(null);setAttempt(null);setReceipt(null);setRevision(value=>value+1)
    if(payload.benefit)setBenefitDraft({...emptyBenefitDraft(),benefit:payload.benefit,customer:{name:'',id:'',idType:payload.benefit==='pwd'?'pwd_lgu':'osca'}})
    setError('The saved reference is closed without a sale. Correct the cart or cash, then review the total again.')
  }
  async function recover() {
    setPending(true);setError('')
    try {
      const response=await requestJson(`/pos/checkouts/${attempt.request_id}`)
      if(response.data.status==='completed') {
        showCompleted(response.data.receipt,attempt)
      } else if(response.data.status==='closed') correctClosed(attempt)
      else setError('No committed sale found. This alone does not prove failure. Retry the saved checkout, or use Resolve for editing to safely close its reference first.')
    } catch {setError('Status remains uncertain. Sign in as the original cashier if needed, then check again. The saved checkout is retained.')}
    finally {setPending(false)}
  }
  async function resolveForEditing() {
    setPending(true);setError('')
    try {
      const response=await requestJson(`/pos/checkouts/${attempt.request_id}/resolve`,{method:'POST',body:'{}'})
      if(response.data.status==='completed') showCompleted(response.data.receipt,attempt)
      else if(response.data.status==='closed') correctClosed(attempt)
      else throw new Error('Unknown checkout resolution')
    } catch {setError('Resolution remains uncertain. The saved checkout is retained. Check status or sign in again as the original cashier.')}
    finally {setPending(false)}
  }
  function changeCart(items) { setCart(items); setQuote(null); setError(''); setReceipt(null) }
  async function review() {
    setPending(true); setError('')
    try {
      const items=cart.map(({product_id,quantity})=>({product_id,quantity:Number(quantity)}))
      if(benefitDraft.benefit==='regular')setQuote((await requestJson('/pos/quote',{method:'POST',body:JSON.stringify({items})})).data)
      else{
        const verified=(await requestJson('/pos/benefits/verify',{method:'POST',body:JSON.stringify({items,draft:benefitDraft})})).data
        const data=(await requestJson('/pos/benefits/quote',{method:'POST',body:JSON.stringify({items,benefit:benefitDraft.benefit,verification_id:verified.verification_id})})).data
        setQuote({...data,benefit:benefitDraft.benefit,verification_id:verified.verification_id})
      }
    }
    catch (failure) { setQuote(null); setError(failure.status ? failure.message : 'Unable to review the cart. Try again.') }
    finally { setPending(false) }
  }
  async function checkout(event) {
    event.preventDefault(); setPending(true); setError('')
    const payload = attempt || { request_id:crypto.randomUUID(),amount_paid:cash,quote_token:quote?.quote_token,items:cart.map(({ product_id,quantity }) => ({ product_id,quantity:Number(quantity) })),...(quote?.benefit?{benefit:quote.benefit,verification_id:quote.verification_id}:{}) }
    setAttempt(payload)
    try {
      const saved=loadCheckout(user.user_id)
      if(saved && saved.request_id!==payload.request_id){setAttempt(saved);throw new Error('Another saved checkout requires recovery.')}
      saveCheckout(user.user_id,payload)
      const response = await requestJson('/pos/checkout',{ method:'POST',body:JSON.stringify(payload) })
      showCompleted(response.data.receipt,payload)
    } catch (failure) {
      if(failure.checkoutState==='closed') {
        try {correctClosed(payload)} catch {setError('The reference is closed, but saved checkout storage needs recovery. Reload without clearing browser storage.')}
        return
      }
      const knownFailure = failure.status && failure.status < 500
      setError(knownFailure ? `${failure.message} No replacement checkout was created. Check the saved reference before retrying.` : 'Checkout outcome is uncertain. The saved reference is retained across refresh and sign-in. Check status or retry this same checkout.')
    } finally { setPending(false) }
  }
  return <Workspace>
    <PageHeading title="Point of Sale" action={receipt && <button className={secondaryClass} onClick={()=>setReceiptOpen(true)}>Last receipt</button>} />
    <p className="my-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{localBenefits?'Synthetic local Senior/PWD checkout is enabled only in this verified disposable database. Production activation and fiscal invoice approval remain blocked.':'Senior Citizen/PWD discounted checkout is unavailable pending validated branch VAT status, eligible-medicine evidence, documentary procedures and invoice format. Valid statutory sales will not require routine approval.'}</p>
    {localBenefits?<BenefitCheckout draft={benefitDraft} disabled={locked} onChange={draft=>{setBenefitDraft(draft);setQuote(null);setError('')}}/>:<BenefitPreparation />}
    {receipt && receiptOpen && <Receipt data={receipt} onClose={()=>setReceiptOpen(false)} />}
    {error && <p role="alert" className="my-5 rounded-lg bg-red-50 p-4 text-red-800">{error}</p>}
    {storageError&&<p role="alert">{storageError}</p>}
    {attempt&&<section aria-label="Saved checkout" className="my-5 rounded-sm border border-amber-300 bg-amber-50 p-5"><h2 className="font-semibold">Saved checkout requires resolution</h2><p className="my-3 break-all">Reference: {attempt.request_id}</p><p className="mb-3">Cash submitted: {formatPHP(attempt.amount_paid)}. Cart and payment are locked to prevent a replacement sale.</p><button disabled={pending} className={secondaryClass} onClick={recover}>Check transaction status</button><button disabled={pending} className={`${buttonClass} ml-3`} onClick={checkout}>Retry saved checkout</button><button disabled={pending} className={`${secondaryClass} mt-3`} onClick={resolveForEditing}>Resolve for editing</button></section>}
    <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
      <section className="table-frame">
        <h2 className="px-5 pt-5 text-lg font-semibold">Search products &amp; cart</h2>
        <form className="flex gap-3 p-5" onSubmit={event => { event.preventDefault(); setQuery({ q:new FormData(event.currentTarget).get('q'),page:1 }) }}>
          <input className={fieldClass} aria-label="Search POS products" name="q" maxLength={200} placeholder="Product or generic name" /><button className={secondaryClass}>Search</button>
        </form>
        <QueryState result={result} retry={() => setRevision(value => value+1)} empty="No products found" />
        <div className="max-h-48 overflow-y-auto" role="region" aria-label="Product search results" tabIndex={0}>
        {!result.loading && !result.error && result.data?.data.map(product => <div key={product.product_id} className="flex items-center justify-between gap-4 border-t border-slate-100 px-5 py-3"><div><p className="font-semibold">{product.name}</p><p className="text-sm text-slate-500">{product.generic_name}</p><p className="mt-1 text-sm">{formatPHP(product.unit_price)} · Eligible stock: {product.available}</p></div>
          <button className={secondaryClass} disabled={locked || product.available === '0'} aria-label={`Add ${product.name}`} onClick={() => {
            const found = cart.find(item => item.product_id === product.product_id)
            changeCart(found ? cart.map(item => item === found ? { ...item,quantity:Math.min(2147483647,Number(item.quantity)+1) } : item) : [...cart,{ product_id:product.product_id,name:product.name,quantity:1 }])
          }}>Add</button></div>)}
        </div>
        {!result.loading && !result.error && result.data && <Paging data={result.data} onPage={page => setQuery(current => ({ ...current,page }))} />}
        <div className="border-t border-slate-200 p-5">
        <p className="mb-5 rounded border border-green-200 bg-green-50 p-3 text-xs text-green-900">FEFO applies at checkout. Batches expiring today or earlier are excluded. Batch allocations appear on the completed receipt.</p>
        <h2 className="text-lg font-semibold">Cart</h2>
        {!cart.length ? <p className="py-8 text-slate-500">Add a product to begin.</p> : <>
          <fieldset disabled={locked} className="mt-4 space-y-4">
            <legend className="sr-only">Cart quantities</legend>
            <div className="overflow-x-auto"><table>
              <thead><tr><th>Product</th><th>Quantity</th><th>Unit price</th><th>Amount</th><th>Action</th></tr></thead>
              <tbody>{cart.map(item => {
                const line = quote?.items.find(row => row.product_id === item.product_id)
                return <tr key={item.product_id}>
                  <td className="font-medium">{item.name}</td>
                  <td><input aria-label={`Quantity for ${item.name}`} className={`${fieldClass} min-w-20 max-w-28`} type="number" min="1" max="2147483647" step="1" value={item.quantity} onChange={event => changeCart(cart.map(row => row.product_id === item.product_id ? { ...row,quantity:event.target.value } : row))} /></td>
                  <td className="whitespace-nowrap">{line ? formatPHP(line.unit_price) : 'Not reviewed'}</td>
                  <td className="whitespace-nowrap">{line ? formatPHP(line.line_total) : 'Not reviewed'}</td>
                  <td><button className={secondaryClass} onClick={() => changeCart(cart.filter(row => row.product_id !== item.product_id))}>Remove {item.name}</button></td>
                </tr>
              })}</tbody>
            </table></div>
            <button className={`${buttonClass} mt-4`} onClick={review} disabled={!cart.length}>Review total</button>
          </fieldset>
        </>}
        </div>
      </section>
      <section className="surface xl:sticky xl:top-6" aria-label="Order summary">
        <h2 className="text-lg font-semibold">Payment summary</h2>
        <p className="mt-3 text-xs text-slate-500">{localBenefits?'Cash only. Synthetic local benefit policy; no fiscal invoice.':'Cash payment only. Discounts are unavailable.'}</p>
        {!quote && <p className="py-8 text-sm text-slate-500">Add products and review the total to continue to payment.</p>}
          {quote && <div className="mt-6 border-t border-slate-100 pt-5"><ul className="space-y-2 text-sm">{quote.items.map(item => <li key={item.product_id}>{item.name}: {item.quantity} × {formatPHP(item.unit_price)} = {formatPHP(item.line_total)}{quote.financial&&<span className="block">{item.eligible?'Eligible':'Ineligible'} · Discount {formatPHP(item.discount)} · VAT removed {formatPHP(item.vat_removed)} · VAT {formatPHP(item.vat)} · {item.price_basis}</span>}</li>)}</ul>
            {quote.financial&&<p>Gross {formatPHP(quote.financial.gross)} · VAT removed {formatPHP(quote.financial.vatRemoved)} · Discount {formatPHP(quote.financial.discount)} · VAT charged {formatPHP(quote.financial.vat)}</p>}
            <p className="my-4 text-xl font-bold">Total: {formatPHP(quote.total)}</p><p className="mb-4 text-xs text-slate-500">Prices, product identity, business date and FEFO allocation must still match this review at checkout. Changes require a fresh review. Reviewing does not reserve stock.</p>
            <form onSubmit={checkout}><label className="text-sm font-medium">Cash received (PHP)<input aria-label="Cash received (PHP)" className={`${fieldClass} my-2`} value={cash} onChange={event => setCash(event.target.value)} disabled={locked} required inputMode="decimal" pattern="[0-9]{1,20}(\.[0-9]{1,2})?" /></label>
              <button disabled={pending} className={`${buttonClass} mt-3`}>{pending ? 'Processing...' : attempt ? 'Retry same checkout' : 'Complete cash sale'}</button>
            </form>
          </div>}
      </section>
    </div>
  </Workspace>
}
