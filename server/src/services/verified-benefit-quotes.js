// Preparation only: deliberately not wired to discounted checkout or posting.
// Policy provider is a server dependency, never request data or an env toggle.
import {beneficiaryDraft,validateBenefitPreparation} from './benefit-preparation.js';
import {cartInput} from './pos-validation.js';
import {quoteFingerprint} from './pos-quotes.js';
const draftInput=beneficiaryDraft.extend({items:cartInput.shape.items}).strict()
  .refine(data=>new Set(data.items.map(item=>item.product_id)).size===data.items.length);
const unavailable=()=>Object.assign(new Error('Statutory checkout is unavailable pending verified pharmacy inputs.'),{status:503});
export function createVerifiedBenefitQuotes({posRepository,policyProvider=async()=>null}){
  return {
    async prepare(client,actor,input){
      const draft=draftInput.parse(input);
      const policy=await policyProvider(client,draft.benefit);
      if(!policy?.verified||!['branchTax','medicineEvidence','documentaryProcedure','invoiceFormat'].every(key=>policy.signoffs?.[key]===true))throw unavailable();
      if(policy.priceBasisByTax?.vatable!=='vat_inclusive'||policy.priceBasisByTax?.vat_exempt!=='vat_exempt')throw unavailable();
      const installed=await client.query("SELECT to_regclass('product_benefit_classifications') IS NOT NULL AS ready");
      if(!installed.rows[0]?.ready)throw unavailable();
      // Same transaction/locks and authoritative prices/FEFO as normal POS.
      const regular=await posRepository.quote(client,{items:draft.items});
      const records=(await client.query(`SELECT p.product_id,p.name,p.generic_name,p.tax_treatment,
        p.classification_source,p.classification_version,p.classification_reviewed_by,p.classification_reviewed_at,
        c.eligibility,c.source,c.version,c.reviewed_by,c.reviewed_at FROM products p
        LEFT JOIN product_benefit_classifications c ON c.product_id=p.product_id AND c.benefit_type=$2
        WHERE p.product_id=ANY($1::int[]) ORDER BY p.product_id FOR SHARE OF p`,[draft.items.map(item=>item.product_id),draft.benefit])).rows;
      const items=regular.items.map(line=>{
        const record=records.find(row=>row.product_id===line.product_id);
        if(!record?.reviewed_by||!record.reviewed_at||!record.classification_reviewed_by||!record.classification_reviewed_at)throw unavailable();
        return {lineKey:String(line.product_id),name:record.name,genericName:record.generic_name,quantity:line.quantity,unitPrice:line.unit_price,
          eligibility:record.eligibility,benefit:draft.benefit,tax:record.tax_treatment,
          priceBasis:policy.priceBasisByTax[record.tax_treatment],
          classificationSource:record.source,classificationVersion:record.version,taxSource:record.classification_source,taxVersion:record.classification_version};
      });
      const quote=validateBenefitPreparation({benefit:draft.benefit,customer:draft.customer},items,policy);
      // Fingerprint includes all evidence, actual calculated amounts, identity and
      // normal quote (prices/date/FEFO). PII is only hashed, never put into a token.
      return {...quote,fingerprint:quoteFingerprint({actor:actor.user_id,regular:regular.fingerprint,records,policy,quote})};
    },
    requireReviewed(previous,current){
      // Future caller must supply a fingerprint from createQuoteProtection.verify
      // bound to the active cashier, never trust a browser-provided bare hash.
      if(typeof previous!=='string'||previous!==current.fingerprint)throw Object.assign(new Error('Review a fresh benefit quote before checkout.'),{status:409});
    },
  };
}
