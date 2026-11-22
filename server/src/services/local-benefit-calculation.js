// Explicit synthetic policy only. Not a statutory default or production switch.
import {z} from 'zod';
import {cents,amount,prepareBenefitQuote} from './prepared-benefits.js';
export const localBenefitPolicy=z.object({testOnly:z.literal(true),vatStatus:z.enum(['vat_registered','non_vat']),
 rounding:z.literal('half_up_product_line_v1'),discountBps:z.literal(2000),vatBps:z.literal(1200),
 source:z.string().trim().min(1),validUntil:z.string().datetime(),documentaryVersion:z.string().min(1),
 priceProvenanceVerified:z.literal(true),fiscalInvoice:z.literal(false)}).strict();
const yes=z.literal(true),text=z.string().trim().min(1).max(200);
export const localBenefitDraft=z.object({benefit:z.enum(['senior','pwd']),customer:z.object({name:text,id:text.max(100),
 idType:z.enum(['osca','passport','government','pwd_lgu','pwd_digital','ncda_emergency'])}).strict(),
 documents:z.object({identitySeen:yes,entitlementConfirmed:yes,exclusiveUse:yes,
 bookletSeen:z.boolean().optional(),purchaser:z.enum(['self','representative','guardian']),
 representativeName:text.optional(),representativeId:text.max(100).optional(),authorizationRef:text.optional(),
 prescriptionRef:text.optional(),prescribedQuantity:z.number().int().positive().max(2147483647).optional(),
 pharmacistAuthorizationId:z.number().int().positive().optional()}).strict()}).strict().superRefine((value,ctx)=>{
 const d=value.documents;
 if(value.benefit==='pwd'&&d.bookletSeen!==true)ctx.addIssue({code:'custom',message:'PWD booklet verification required'});
 if(value.benefit==='senior'&&!['osca','passport','government'].includes(value.customer.idType))ctx.addIssue({code:'custom',message:'Wrong scheme document'});
 if(value.benefit==='pwd'&&!['pwd_lgu','pwd_digital','ncda_emergency','passport'].includes(value.customer.idType))ctx.addIssue({code:'custom',message:'Wrong scheme document'});
 if(d.purchaser!=='self'&&(!d.representativeName||!d.representativeId||!d.authorizationRef))ctx.addIssue({code:'custom',message:'Representative evidence required'});
 if(d.purchaser==='guardian'&&value.benefit!=='pwd')ctx.addIssue({code:'custom',message:'Unsupported guardian procedure'});
});
export function calculateLocalBenefits({benefit,customer,items,policy,version}){
 localBenefitPolicy.parse(policy);
 if(Date.parse(policy.validUntil)<=Date.now())throw new Error('Synthetic policy expired');
 const nonVat=policy.vatStatus==='non_vat';
 for(const item of items){
  if(item.promotion!=='none'||(nonVat?item.priceBasis!=='non_vat':item.priceBasis!==(item.tax==='vatable'?'vat_inclusive':'vat_exempt')))throw new Error('Unverified selling price basis');
 }
 const quote=prepareBenefitQuote({benefit,customer,items:items.map(item=>nonVat?{...item,tax:'vat_exempt',priceBasis:'vat_exempt'}:item),
  policy:{verified:true,benefit,version,source:policy.source,rounding:'half_up_per_line',discountBps:policy.discountBps,vatBps:policy.vatBps,exemptEligibleVatable:true}});
 quote.lines=quote.lines.map((line,index)=>({...line,financialSnapshotVersion:'2',productId:items[index].productId,
  taxTreatment:items[index].tax,priceBasis:items[index].priceBasis,nonVat:nonVat?line.net:'0.00',exempt:nonVat?'0.00':line.exempt}));
 quote.totals={...quote.totals,nonVat:nonVat?quote.totals.net:'0.00',exempt:nonVat?'0.00':quote.totals.exempt};
 // Enforce parser bounds for sums as well as unit prices.
 for(const value of Object.values(quote.totals))cents(value);
 return quote;
}
function split(total,weights){
 const sum=weights.reduce((a,b)=>a+b,0n);if(!sum){if(total)throw Error('Invalid zero allocation');return weights.map(()=>0n);}
 const rows=weights.map((w,index)=>({index,value:total*w/sum,remainder:total*w%sum}));
 let remaining=total-rows.reduce((a,b)=>a+b.value,0n);
 for(const row of [...rows].sort((a,b)=>a.remainder===b.remainder?a.index-b.index:a.remainder>b.remainder?-1:1)){if(remaining<=0n)break;row.value++;remaining--;}
 return rows.map(row=>row.value);
}
export function allocateBenefitLine(line,allocations){
 const gross=allocations.map(a=>cents(a.unit_price)*BigInt(a.quantity));
 if(gross.reduce((a,b)=>a+b,0n)!==cents(line.gross)||allocations.reduce((a,b)=>a+b.quantity,0)!==line.quantity)throw Error('Allocation quantity mismatch');
 const removed=split(cents(line.vatRemoved),gross),bases=gross.map((g,i)=>g-removed[i]);
 const discounts=split(cents(line.discount),bases),nets=bases.map((b,i)=>b-discounts[i]);
 const vats=split(cents(line.vat),nets),taxable=split(cents(line.vatable),nets.map((n,i)=>n-vats[i]));
 const exempt=split(cents(line.exempt),nets.map((n,i)=>n-vats[i]-taxable[i]));
 return allocations.map((a,i)=>({...line,...a,gross:amount(gross[i]),vatRemoved:amount(removed[i]),discount:amount(discounts[i]),net:amount(nets[i]),
  vat:amount(vats[i]),vatable:amount(taxable[i]),exempt:amount(exempt[i]),nonVat:amount(nets[i]-vats[i]-taxable[i]-exempt[i])}));
}
