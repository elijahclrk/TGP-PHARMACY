import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createAuthRepository} from './auth.repository.js';
import {createPosRepository} from './pos.repository.js';
import {createPreparedWorkflows} from '../services/prepared-workflows.js';
import {createWorkflowsRepository} from './workflows.repository.js';
import {isAcademic} from '../academic/capabilities.js';
import {exchangeDraft,createInput,postInput,decisionInput,cancelInput,cents,amount,settlement,fingerprint,quoteTokens,fail} from '../services/exchange-validation.js';
const canonical=new URL('../../database/migrations/proposed/batch13/012_local_product_exchanges.sql',import.meta.url);
const tables=['product_exchanges','exchange_claims','exchange_pricing_lines','exchange_items','exchange_settlements','exchange_events'];
export function createExchangesRepository({poolProvider,secret,policy,isolatedCapability}){
 const cloud=isAcademic(isolatedCapability,poolProvider);
 if((!cloud&&(!isolatedCapability?.localOnly||!isolatedCapability?.tlsVerified))||policy?.testOnly!==true||!policy.version)throw Error('Verified isolated exchange capability required');
 const auth=createAuthRepository(poolProvider),pos=createPosRepository(poolProvider),workflows=createPreparedWorkflows(poolProvider),tokens=quoteTokens(secret);
 const one=async(c,sql,args=[])=>{const row=(await c.query(sql,args)).rows[0];if(!row)fail(404);return row;};
 async function ready(c){
  if(!await createWorkflowsRepository(()=>c).schemaReady())return false;
  const sql=await readFile(canonical,'utf8'),normalize=s=>s.replace(/\s+/g,' ').trim();
  for(const name of ['tgp_exchange_guard','tgp_exchange_reconcile','tgp_exchange_audit_guard']){
   const body=sql.match(new RegExp('CREATE FUNCTION '+name+'\\(\\)[\\s\\S]*?AS \\$\\$([\\s\\S]*?)\\$\\$;'))?.[1];
   const actual=(await c.query('SELECT prosrc FROM pg_proc WHERE pronamespace=current_schema()::regnamespace AND proname=$1',[name])).rows;
   if(!body||actual.length!==1||normalize(actual[0].prosrc)!==normalize(body))return false;
  }
  const rows=(await c.query("SELECT c.relname,t.tgname,t.tgenabled FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace=current_schema()::regnamespace AND c.relname=ANY($1::text[]) AND t.tgname IN('exchange_guard','exchange_reconcile')",[tables])).rows;
  const audit=(await c.query("SELECT 1 FROM pg_trigger WHERE tgrelid='activity_logs'::regclass AND tgname='exchange_audit_guard' AND tgenabled='O'")).rowCount;
  const constraints=(await c.query("SELECT count(*)::int AS n,bool_and(convalidated) AS valid FROM pg_constraint WHERE conrelid IN(SELECT oid FROM pg_class WHERE relnamespace=current_schema()::regnamespace AND relname=ANY($1::text[]))",[tables])).rows[0];
  const domain=(await c.query("SELECT 1 FROM pg_constraint c JOIN pg_type t ON t.oid=c.contypid WHERE t.typnamespace=current_schema()::regnamespace AND t.typname='tgp_exchange_money' AND c.convalidated AND pg_get_constraintdef(c.oid) LIKE '%scale%'")).rowCount;
  // Includes six deferred constraint-trigger entries in pg_constraint.
  return rows.length===12&&rows.every(r=>r.tgenabled==='O')&&audit===1&&constraints.n===48&&constraints.valid&&domain===1;
 }
 async function tx(actorId,work,{newWork=true}={}){return auth.transaction(async c=>{
  const actor=await auth.findById(actorId,c);if(!actor||actor.status!=='active')fail(403);
  if(!await ready(c))fail(503,'EXCHANGES_UNAVAILABLE');
  if(newWork&&Date.parse(policy.validUntil)<=Date.now())fail(503,'EXCHANGE_POLICY_UNAVAILABLE');
  return work(c,actor);
 });}
 async function event(c,actor,id,kind,operation=randomUUID(),payload={}){
  await c.query('INSERT INTO exchange_events(event_id,exchange_id,actor_id,event_kind,operation_id,payload) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),id,actor.user_id,kind,operation,payload]);
  await auth.audit(c,actor.user_id,'exchange.'+kind+':'+id,'exchanges');
 }
 async function record(c,actor,id){const e=await one(c,'SELECT * FROM product_exchanges WHERE exchange_id=$1 FOR UPDATE',[id]);if(actor.role==='employee'&&e.initiated_by!==actor.user_id)fail(404);return e;}
 async function detail(c,actor,id){const e=await record(c,actor,id);return {...e,
  items:(await c.query('SELECT i.*,p.product_name FROM exchange_items i JOIN exchange_pricing_lines p USING(line_id,exchange_id,product_id) WHERE i.exchange_id=$1 ORDER BY i.product_id,i.expiry_date,i.batch_id',[id])).rows,
  claims:(await c.query('SELECT * FROM exchange_claims WHERE exchange_id=$1 ORDER BY return_id',[id])).rows,
  settlement:(await c.query('SELECT cash_due::text,tender::text,change_due::text FROM exchange_settlements WHERE exchange_id=$1',[id])).rows[0]??null,
  events:(await c.query('SELECT event_kind,actor_id,occurred_at FROM exchange_events WHERE exchange_id=$1 ORDER BY occurred_at,event_id',[id])).rows,
  confirmation_label:'Internal exchange transaction confirmation — not a registered fiscal invoice',local_only:!cloud,academic_demo:cloud};}
 async function snapshot(c,actor,input,exclude=null){
  const draft=exchangeDraft.parse(input);if(draft.route!=='voluntary')fail(422,'AUTHORIZED_REMEDY_REVIEW_REQUIRED');
  const claims=[];let root=null,credit=0n;
  for(const line of [...draft.claims].sort((a,b)=>a.return_id-b.return_id)){
   const r=await one(c,`SELECT r.*,i.unit_price::text,i.quantity AS sold,b.product_id,s.discount_id,s.senior_pwd_id,s.vat_exempt,to_jsonb(s)->>'financial_snapshot_version' AS financial_version FROM sale_returns r JOIN sale_items i USING(sale_item_id) JOIN batches b ON b.batch_id=i.batch_id JOIN sales s ON s.sale_id=r.sale_id WHERE r.return_id=$1`,[line.return_id]);
   await c.query('SELECT sale_item_id FROM sale_items WHERE sale_item_id=$1 FOR UPDATE',[r.sale_item_id]);
   await c.query('SELECT return_id FROM sale_returns WHERE return_id=$1 FOR UPDATE',[r.return_id]);
   if(r.discount_id!==null||r.senior_pwd_id!==null||r.vat_exempt===true||r.financial_version!==null)fail(422,'DISCOUNTED_EXCHANGE_REVIEW_REQUIRED');
   if(root!==null&&root!==r.sale_id)fail(400,'ONE_RECEIPT_REQUIRED');root=r.sale_id;
   await workflows.requirePaidSale(c,root);
   if(r.decision_state!=='approved'||r.received_quantity!==r.quantity)fail(422,'PHYSICAL_RECEIPT_REQUIRED');
   const used=await one(c,"SELECT coalesce(sum(c.quantity),0)::text AS quantity FROM exchange_claims c JOIN product_exchanges e USING(exchange_id) WHERE c.return_id=$1 AND e.state IN('approved','posted') AND ($2::uuid IS NULL OR e.exchange_id<>$2)",[r.return_id,exclude]);
   if(BigInt(used.quantity)+BigInt(line.quantity)>BigInt(r.received_quantity))fail(409,'RETURN_QUANTITY_EXHAUSTED');
   const value=cents(r.unit_price)*BigInt(line.quantity);credit+=value;
   claims.push({return_id:r.return_id,sale_id:r.sale_id,sale_item_id:r.sale_item_id,product_id:r.product_id,quantity:line.quantity,unit_price:amount(cents(r.unit_price)),applied_value:amount(value)});
  }
  const clinical=[];
  const rules=policy.pairs.filter(r=>draft.items.some(i=>i.product_id===r.replacementProductId)&&claims.some(x=>x.product_id===r.sourceProductId));
  if(draft.items.some(i=>!rules.some(r=>r.replacementProductId===i.product_id))||claims.some(x=>!rules.some(r=>r.sourceProductId===x.product_id)))fail(422,'CLINICAL_REVIEW_REQUIRED');
  for(const rule of rules){
   if(rule.prescriptionRequired!==false||!rule.evidence||Date.parse(rule.validUntil)<=Date.now())fail(422,'CLINICAL_REVIEW_REQUIRED');
   const authorization=await one(c,"SELECT authorization_id,user_id FROM pharmacist_authorizations WHERE authorization_id=$1 AND revoked_at IS NULL AND verified_at<=clock_timestamp() AND (expires_at IS NULL OR expires_at>clock_timestamp()) FOR SHARE",[rule.authorizationId]);
   const pharmacist=await auth.findById(authorization.user_id,c);if(!pharmacist||pharmacist.status!=='active')fail(403,'CLINICAL_REVIEW_REQUIRED');
   clinical.push({...rule,authorizationUser:authorization.user_id});
  }
  const stock=await pos.snapshot(c,{items:[...draft.items].sort((a,b)=>a.product_id-b.product_id)}),financial=settlement(amount(credit),amount(cents(stock.priced.total)));
  const ids=[...new Set([...draft.items.map(i=>i.product_id),...claims.map(i=>i.product_id)])].sort((a,b)=>a-b);
  const product_metadata=(await c.query("SELECT product_id,name,generic_name,category,to_jsonb(products)->>'strength_dosage' AS strength_dosage FROM products WHERE product_id=ANY($1::int[]) ORDER BY product_id FOR SHARE",[ids])).rows;
  const quote={root_sale_id:root,claims,items:stock.priced.items,allocations:stock.allocations,product_metadata,business_date:stock.business_date,financial,clinical,policy_version:policy.version,policy_valid_until:policy.validUntil,reason:draft.reason,route:draft.route};
  return {quote,fingerprint:fingerprint(quote)};
 }
 return {
  async availability(actor){try{return await tx(actor,async c=>({available:await ready(c),local_only:!cloud,academic_demo:cloud,modes:['voluntary_equal','voluntary_higher'],unavailable:['lower_value','statutory','discounted','prescription','replacement_return_posting']}));}catch{return {available:false,local_only:!cloud,modes:[]};}},
  async sources(actor,receipt){return tx(actor,async c=>{
   const rows=(await c.query(`SELECT s.sale_id,s.receipt_no,i.sale_item_id,b.product_id,p.name AS product_name,b.batch_no,i.quantity AS sold,i.unit_price::text,r.return_id,r.quantity AS accepted,r.received_quantity,r.decision_state,
    coalesce((SELECT sum(cl.quantity) FROM exchange_claims cl JOIN product_exchanges e USING(exchange_id) WHERE cl.return_id=r.return_id AND e.state IN('approved','posted')),0)::text AS allocated
    FROM sales s JOIN sale_items i USING(sale_id) JOIN batches b USING(batch_id) JOIN products p USING(product_id) LEFT JOIN sale_returns r ON r.sale_item_id=i.sale_item_id WHERE s.receipt_no=$1 ORDER BY i.sale_item_id,r.return_id`,[receipt])).rows;
   return rows;});},
  async products(actor,q){return tx(actor,()=>pos.products({q,page:1,limit:30}));},
  async quote(actor,draft){return tx(actor,async(c,a)=>{const s=await snapshot(c,a,draft);return {...s.quote,fingerprint:s.fingerprint,quote_token:tokens.issue(actor,s.fingerprint)};});},
  async create(actor,raw){const input=createInput.parse(raw),digest=fingerprint({actor,draft:input.draft});return tx(actor,async(c,a)=>{
   const old=(await c.query('SELECT * FROM product_exchanges WHERE exchange_id=$1 FOR UPDATE',[input.request_id])).rows[0];if(old){if(old.initiated_by!==actor||old.request_digest!==digest)fail();return detail(c,a,old.exchange_id);}
   if((await c.query("SELECT 1 FROM activity_logs WHERE module='exchanges' AND action=$1",['exchange.create_closed:'+input.request_id])).rowCount)fail(409,'ATTEMPT_CLOSED');
   const s=await snapshot(c,a,input.draft);if(!tokens.verify(input.quote_token,actor,s.fingerprint))fail(409,'QUOTE_STALE');
   const e=s.quote,f=e.financial,id=input.request_id;
   await c.query('INSERT INTO product_exchanges(exchange_id,request_digest,root_sale_id,initiated_by,reason,request,quote,fingerprint,policy_version,return_value,replacement_value,additional_cash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',[id,digest,e.root_sale_id,actor,e.reason,input.draft,e,s.fingerprint,e.policy_version,f.return_value,f.replacement_value,f.additional_cash]);
   for(const line of e.claims)await c.query('INSERT INTO exchange_claims(claim_id,exchange_id,return_id,sale_id,sale_item_id,quantity,unit_price,applied_value) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[randomUUID(),id,line.return_id,line.sale_id,line.sale_item_id,line.quantity,line.unit_price,line.applied_value]);
   for(const line of e.items){const lineId=randomUUID();await c.query("INSERT INTO exchange_pricing_lines(line_id,exchange_id,product_id,quantity,product_name,unit_price,payable,evidence,tax_status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'unassessed_internal')",[lineId,id,line.product_id,line.quantity,line.name,line.unit_price,line.line_total,JSON.stringify(e.clinical.filter(r=>r.replacementProductId===line.product_id))]);
    for(const b of e.allocations.filter(b=>b.product_id===line.product_id))await c.query('INSERT INTO exchange_items(exchange_item_id,line_id,exchange_id,product_id,batch_id,batch_no,expiry_date,quantity,unit_price,payable) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[randomUUID(),lineId,id,line.product_id,b.batch_id,b.batch_no,b.expiry_date,b.quantity,b.unit_price,amount(cents(b.unit_price)*BigInt(b.quantity))]);
   }
   await event(c,a,id,'requested');return detail(c,a,id);
  });},
  async resolveRequest(actor,id){return tx(actor,async(c,a)=>{const old=(await c.query('SELECT exchange_id FROM product_exchanges WHERE exchange_id=$1',[id])).rows[0];if(old)return {status:'recorded',receipt:await detail(c,a,id)};const closed=(await c.query("SELECT user_id FROM activity_logs WHERE module='exchanges' AND action=$1",['exchange.create_closed:'+id])).rows;if(closed.some(r=>r.user_id!==actor))fail(404);if(!closed.length)await auth.audit(c,actor,'exchange.create_closed:'+id,'exchanges');return {status:'closed'};},{newWork:false});},
  async list(actor,status='all'){return tx(actor,async(c,a)=>({data:(await c.query("SELECT exchange_id,initiated_by,state,reason,return_value::text,replacement_value::text,additional_cash::text,created_at FROM product_exchanges WHERE ($1='all' OR state=$1) AND ($2 OR initiated_by=$3) ORDER BY created_at DESC,exchange_id LIMIT 200",[status,a.role!=='employee',actor])).rows}));},
  async detail(actor,id){return tx(actor,(c,a)=>detail(c,a,id),{newWork:false});},
  async decision(actor,id,raw){const d=decisionInput.parse(raw);if(d.decision==='rejected'&&!d.reason)fail(400);return tx(actor,async(c,a)=>{
   const e=await record(c,a,id);if(!['manager','admin'].includes(a.role)||e.initiated_by===actor)fail(403);if(e.state!=='pending')fail();
   if(d.decision==='approved'){const s=await snapshot(c,a,e.request,id);if(s.fingerprint!==e.fingerprint)fail(409,'QUOTE_STALE');}
   await c.query('UPDATE product_exchanges SET state=$2,reviewed_by=$3,reviewed_at=clock_timestamp(),decision_reason=$4 WHERE exchange_id=$1',[id,d.decision,actor,d.reason??null]);await event(c,a,id,d.decision);return detail(c,a,id);
  });},
  async cancel(actor,id,raw){const d=cancelInput.parse(raw);return tx(actor,async(c,a)=>{const e=await record(c,a,id);if(!['pending','approved'].includes(e.state))fail();await c.query("UPDATE product_exchanges SET state='cancelled',decision_reason=$2 WHERE exchange_id=$1",[id,d.reason]);await event(c,a,id,'cancelled');return detail(c,a,id);});},
  async reviewedQuote(actor,id){return tx(actor,async(c,a)=>{const e=await record(c,a,id);if(e.initiated_by!==actor||e.state!=='approved')fail(403);const s=await snapshot(c,a,e.request,id);if(s.fingerprint!==e.fingerprint)fail(409,'QUOTE_STALE');return {...s.quote,quote_token:tokens.issue(actor,e.fingerprint)};});},
  async post(actor,id,raw){const input=postInput.parse(raw),digest=fingerprint({actor,id,request_id:input.request_id,tender:amount(cents(input.tender))});return tx(actor,async(c,a)=>{
   const e=await record(c,a,id);if(e.initiated_by!==actor)fail(403);
   if(e.state==='posted'){if(e.posting_request_id!==input.request_id||e.posting_digest!==digest)fail();return {receipt:await detail(c,a,id),replayed:true};}
   if(Date.parse(policy.validUntil)<=Date.now())fail(503,'EXCHANGE_POLICY_UNAVAILABLE');
   if((await c.query("SELECT 1 FROM exchange_events WHERE operation_id=$1",[input.request_id])).rowCount)fail(409,'ATTEMPT_CLOSED');
   if(e.state!=='approved')fail();const s=await snapshot(c,a,e.request,id);if(s.fingerprint!==e.fingerprint||!tokens.verify(input.quote_token,actor,e.fingerprint))fail(409,'QUOTE_STALE');
   const cash=settlement(e.return_value,e.replacement_value,input.tender);
   await c.query('INSERT INTO exchange_settlements(exchange_id,cash_due,tender,change_due) VALUES($1,$2,$3,$4)',[id,cash.additional_cash,cash.tender,cash.change_due]);
   await event(c,a,id,'posted',input.request_id);
   await c.query("UPDATE product_exchanges SET state='posted',posted_at=clock_timestamp(),business_date=$4::date,posting_request_id=$2,posting_digest=$3 WHERE exchange_id=$1",[id,input.request_id,digest,s.quote.business_date]);
   return {receipt:await detail(c,a,id),replayed:false};
  },{newWork:false});},
  async resolve(actor,id,requestId){return tx(actor,async(c,a)=>{const e=await record(c,a,id);if(e.initiated_by!==actor)fail(403);if(e.state==='posted'){if(e.posting_request_id!==requestId)fail();return {status:'posted',receipt:await detail(c,a,id)};}
   if(['rejected','cancelled'].includes(e.state))return {status:'closed'};
   const old=(await c.query('SELECT * FROM exchange_events WHERE operation_id=$1',[requestId])).rows[0];if(old&&(old.exchange_id!==id||old.event_kind!=='attempt_closed'))fail();if(!old)await event(c,a,id,'attempt_closed',requestId);return {status:'closed'};
  },{newWork:false});},
  async report(actor,from,to){return tx(actor,async(c,a)=>{if(a.role!=='admin')fail(403);const data=(await c.query(`SELECT e.exchange_id,s.receipt_no,to_char(e.posted_at AT TIME ZONE 'Asia/Manila','YYYY-MM-DD HH24:MI:SS') AS business_time,e.return_value::text,e.replacement_value::text,e.additional_cash::text,x.tender::text,x.change_due::text,(SELECT sum(quantity)::text FROM exchange_items WHERE exchange_id=e.exchange_id) AS replacement_units FROM product_exchanges e JOIN sales s ON s.sale_id=e.root_sale_id JOIN exchange_settlements x USING(exchange_id) WHERE e.state='posted' AND e.business_date BETWEEN $1::date AND $2::date ORDER BY e.posted_at,e.exchange_id LIMIT 10001`,[from,to])).rows;if(data.length>10000)fail(422,'EXPORT_LIMIT');const sum=k=>amount(data.reduce((n,r)=>n+cents(r[k]),0n));return {data,transactions:data.length,return_value:sum('return_value'),replacement_value:sum('replacement_value'),additional_cash:sum('additional_cash')};},{newWork:false});},
 };
}
