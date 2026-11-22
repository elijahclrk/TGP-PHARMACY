import {fieldClass} from '../inventory/shared'
import {emptyBenefitDraft} from './benefit-draft'
import {useAcademicDemo} from '../components/academic-context'
export default function BenefitCheckout({draft,onChange,disabled}){
 const academic=useAcademicDemo()
 const set=(key,value)=>onChange({...draft,[key]:value})
 const customer=(key,value)=>set('customer',{...draft.customer,[key]:value})
 const doc=(key,value)=>set('documents',{...draft.documents,[key]:value})
 return <fieldset disabled={disabled} className="my-5 space-y-3 rounded-lg border border-amber-300 p-4"><legend>{academic?'Cloud academic synthetic benefit checkout':'Local synthetic benefit checkout'}</legend>
  <p>Disposable database only. Internal transaction confirmation; statutory and fiscal approval remain pending.</p>
  <label>Customer benefit<select aria-label="Customer benefit" className={fieldClass} value={draft.benefit} onChange={e=>onChange({...emptyBenefitDraft(),benefit:e.target.value,customer:{name:'',id:'',idType:e.target.value==='pwd'?'pwd_lgu':'osca'}})}><option value="regular">Regular</option><option value="senior">Senior Citizen</option><option value="pwd">PWD</option></select></label>
  {draft.benefit!=='regular'&&<>
   <label>Beneficiary name<input className={fieldClass} aria-label="Beneficiary name" autoComplete="off" maxLength={200} value={draft.customer.name} onChange={e=>customer('name',e.target.value)}/></label>
   <label>Beneficiary identification number<input className={fieldClass} aria-label="Beneficiary identification number" autoComplete="off" maxLength={100} value={draft.customer.id} onChange={e=>customer('id',e.target.value)}/></label>
   <label>Presented document<select className={fieldClass} aria-label="Presented document" value={draft.customer.idType} onChange={e=>customer('idType',e.target.value)}>{(draft.benefit==='senior'?['osca','passport','government']:['pwd_lgu','pwd_digital','ncda_emergency','passport']).map(k=><option key={k} value={k}>{k.replaceAll('_',' ')}</option>)}</select></label>
   {['identitySeen','entitlementConfirmed','exclusiveUse',...(draft.benefit==='pwd'?['bookletSeen']:[])].map(key=><label className="block" key={key}><input type="checkbox" checked={Boolean(draft.documents[key])} onChange={e=>doc(key,e.target.checked)}/> {{identitySeen:'Presented identity verified',entitlementConfirmed:'Scheme entitlement verified',exclusiveUse:'Items are for beneficiary exclusive use',bookletSeen:'PWD medicine booklet verified'}[key]}</label>)}
   {draft.benefit==='senior'&&<p>Senior medicine purchase booklet is not required.</p>}
   <label>Purchaser<select className={fieldClass} aria-label="Purchaser" value={draft.documents.purchaser} onChange={e=>doc('purchaser',e.target.value)}><option value="self">Beneficiary</option><option value="representative">Authorized representative</option>{draft.benefit==='pwd'&&<option value="guardian">Guardian under verified test SOP</option>}</select></label>
   {draft.documents.purchaser!=='self'&&['representativeName','representativeId','authorizationRef'].map(key=><label className="block" key={key}>{key}<input className={fieldClass} aria-label={key} autoComplete="off" value={draft.documents[key]??''} onChange={e=>doc(key,e.target.value)}/></label>)}
   <details><summary>Prescription-required items (qualified dispensing verifier only)</summary>
    <label>Prescription reference<input className={fieldClass} aria-label="Prescription reference" value={draft.documents.prescriptionRef??''} onChange={e=>doc('prescriptionRef',e.target.value)}/></label>
    <label>Authorized base-unit quantity<input className={fieldClass} aria-label="Authorized base-unit quantity" type="number" min="1" step="1" value={draft.documents.prescribedQuantity??''} onChange={e=>doc('prescribedQuantity',e.target.value?Number(e.target.value):undefined)}/></label>
    <label>Verified pharmacist authorization reference<input className={fieldClass} aria-label="Verified pharmacist authorization reference" type="number" min="1" step="1" value={draft.documents.pharmacistAuthorizationId??''} onChange={e=>doc('pharmacistAuthorizationId',e.target.value?Number(e.target.value):undefined)}/></label>
   </details>
  </>}
 </fieldset>
}
