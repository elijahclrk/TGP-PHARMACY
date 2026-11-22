import {z} from 'zod';
import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
const id=z.number().int().min(1).max(2147483647),quantity=id;
export const uuid=z.uuid().transform(value=>value.toLowerCase());
export const money=z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/);
export const exchangeDraft=z.object({claims:z.array(z.object({return_id:id,quantity}).strict()).min(1).max(40),items:z.array(z.object({product_id:id,quantity}).strict()).min(1).max(40),reason:z.string().trim().min(1).max(1000),route:z.enum(['voluntary','defective','statutory']).default('voluntary')}).strict().superRefine((v,c)=>{
 for(const [rows,key] of [[v.claims,'return_id'],[v.items,'product_id']])if(new Set(rows.map(r=>r[key])).size!==rows.length)c.addIssue({code:'custom',message:'Duplicate source/product'});
});
export const createInput=z.object({request_id:uuid,draft:exchangeDraft,quote_token:z.string().max(1000)}).strict();
export const decisionInput=z.object({decision:z.enum(['approved','rejected']),reason:z.string().trim().min(1).max(1000).optional()}).strict();
export const postInput=z.object({request_id:uuid,quote_token:z.string().max(1000),tender:money}).strict();
export const cancelInput=z.object({reason:z.string().trim().min(1).max(1000)}).strict();
export function fail(status=409,code='EXCHANGE_CONFLICT') {throw Object.assign(new Error('Exchange request cannot be completed'),{status,code});}
export function cents(value){if(!money.safeParse(value).success)fail(400,'INVALID_MONEY');const[a,b='']=value.split('.');return BigInt(a)*100n+BigInt(b.padEnd(2,'0'));}
export function amount(value){if(value<0n||value>=100000000000000n)fail(400,'INVALID_MONEY');return String(value/100n)+'.'+String(value%100n).padStart(2,'0');}
export function settlement(original,replacement,tender){const c=cents(original),p=cents(replacement);if(p<c)fail(422,'LOWER_VALUE_REVIEW_REQUIRED');const due=p-c;
 if(tender===undefined)return {return_value:amount(c),replacement_value:amount(p),additional_cash:amount(due)};
 const t=cents(tender);if(t<due||(!due&&t))fail(422,'CASH_MISMATCH');return {...settlement(original,replacement),tender:amount(t),change_due:amount(t-due)};
}
export function fingerprint(value){return createHash('sha256').update(JSON.stringify(value)).digest('hex');}
export function quoteTokens(secret){
 if(typeof secret!=='string'||secret.length<32)throw Error('Exchange signing secret required');
 const sign=body=>createHmac('sha256',secret).update(body).digest('hex');
 return {issue(actor,hash){const body=Buffer.from(JSON.stringify({mode:'exchange',v:1,actor,hash,expires:Date.now()+300000})).toString('base64url');return body+'.'+sign(body);},
 verify(token,actor,hash){try{const[body,sig]=token.split('.'),expected=sign(body);if(sig.length!==expected.length||!timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return false;const d=JSON.parse(Buffer.from(body,'base64url'));return d.mode==='exchange'&&d.v===1&&d.actor===actor&&d.hash===hash&&d.expires>Date.now();}catch{return false;}}};
}
