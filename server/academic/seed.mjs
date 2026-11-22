// Operator-only synthetic fixtures. Never copied into the hosted image.
import {randomUUID} from 'node:crypto';
import {createAuthRepository} from '../src/repositories/auth.repository.js';
import {createPurchasingRepository} from '../src/repositories/purchasing.repository.js';
import {createPosRepository} from '../src/repositories/pos.repository.js';
import {createPreparedWorkflows} from '../src/services/prepared-workflows.js';
import {createLocalBenefitsRepository} from '../src/repositories/local-benefits.repository.js';
import {createExchangesRepository} from '../src/repositories/exchanges.repository.js';
import {createOperationsRepository} from '../src/repositories/operations.repository.js';
import {hashPassword} from '../src/services/passwords.js';

export const fixtureUsers=[['employee',101,'employee'],['manager',102,'manager'],['admin',103,'admin'],['pharmacist',104,'manager'],['verifier',105,'admin']];
export async function seedFoundation(c,passwords,expiresAt){
 if(new Set(fixtureUsers.map(([label])=>passwords[label])).size!==fixtureUsers.length)throw Error('Distinct fixture credentials required');
 if((await c.query('SELECT count(*)::int AS n FROM users')).rows[0].n!==0)throw Error('Nonempty seed refused');
 for(const[label,id,role]of fixtureUsers){if(typeof passwords[label]!=='string'||passwords[label].length<24)throw Error('Distinct private fixture passwords required');await c.query("INSERT INTO users(user_id,username,password_hash,full_name,role,status) VALUES($1,$2,$3,$4,$5,'active')",[id,'demo_'+label,await hashPassword(passwords[label]),'SYNTHETIC ACADEMIC '+label,role]);}
 const auth=createAuthRepository(()=>c);
 for(const[,id]of fixtureUsers)await auth.audit(c,105,'synthetic.account_provisioned:'+id,'academic_setup');
 await c.query("INSERT INTO products(product_id,name,generic_name,category,unit_price,reorder_level) VALUES(201,'SYNTHETIC FEFO medicine','SYNTHETIC generic','Synthetic only',112,10),(202,'SYNTHETIC threshold unset','SYNTHETIC generic','Synthetic only',100,NULL),(221,'SYNTHETIC replacement medicine','SYNTHETIC generic','Synthetic only',140,NULL)");
 await c.query("INSERT INTO pharmacist_authorizations(authorization_id,user_id,authorized_by,evidence_ref,verified_at,expires_at) VALUES(901,104,105,'SYNTHETIC TEST ONLY — not professional evidence',CURRENT_TIMESTAMP,$1)",[expiresAt]);
 for(const[scheme,id]of [['senior',1],['pwd',2]]){
  await c.query('INSERT INTO discounts(discount_id,type,rate) VALUES($1,$2,0.2)',[id,scheme]);
  await c.query('INSERT INTO benefit_policies(policy_id,benefit_type,version,payload,reviewed_by,reviewed_at,active,test_only) VALUES($1,$2,$3,$4,103,CURRENT_TIMESTAMP,true,true)',[id,scheme,'synthetic-cloud-'+scheme+'-v1',{
   testOnly:true,vatStatus:'vat_registered',rounding:'half_up_product_line_v1',discountBps:2000,vatBps:1200,source:'SYNTHETIC TEST ONLY — not branch evidence',validUntil:expiresAt,documentaryVersion:'synthetic-cloud-sop-v1',priceProvenanceVerified:true,fiscalInvoice:false}]);
 }
 for(let index=0;index<6;index++){
  const id=211+index,price=index===1?'100.00':index===4?'0.01':'112.00';
  await c.query("INSERT INTO products(product_id,name,generic_name,category,unit_price) VALUES($1,$2,'SYNTHETIC generic','Synthetic only',$3)",[id,'SYNTHETIC benefit '+(index+1),price]);
  if(index===3)continue;
  for(const scheme of ['senior','pwd'])await c.query("INSERT INTO benefit_product_versions(version_id,product_id,benefit_type,version,eligibility,tax,price_basis,prescription_required,promotion_state,source,reviewed_by,reviewed_at,valid_from,valid_until,active) VALUES($1,$2,$3,'synthetic-cloud-v1',$4,$5,$6,$7,'none','SYNTHETIC TEST ONLY — not eligibility evidence',103,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,$8,true)",[randomUUID(),id,scheme,index===2?'ineligible':'eligible',index===1?'vat_exempt':'vatable',index===1?'vat_exempt':'vat_inclusive',index===5,expiresAt]);
 }
}
export async function seedScenarios(context){
 const {provider,capability}=context,auth=createAuthRepository(provider),ops=createOperationsRepository(provider,capability),purchasing=createPurchasingRepository(provider,{linkedReady:ops.schemaReady}),pos=createPosRepository(provider),work=createPreparedWorkflows(provider);
 const {requireAcademic}=await import('../src/academic/capabilities.js');const {config}=requireAcademic(capability,provider);
 const secret=config.secret;
 const benefits=createLocalBenefitsRepository({poolProvider:provider,posRepository:pos,secret,isolatedCapability:capability});
 const exchanges=createExchangesRepository({poolProvider:provider,secret,policy:config.document.payload.exchangePolicy,isolatedCapability:capability});
 const supplier=await auth.transaction(async c=>{const r=await purchasing.createSupplier(c,{name:'SYNTHETIC ACADEMIC supplier',address:'SYNTHETIC ONLY'});await auth.audit(c,102,'suppliers.created:'+r.supplier_id,'suppliers');return r;});
 const today=(await provider().query("SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date::text AS day")).rows[0].day;
 const day=n=>{const d=new Date(today+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
 const line=(product_id,quantity,tag,offset=20)=>({product_id,quantity,batch_no:'SYNTHETIC-'+tag,expiry_date:day(offset),cost_price:'1',selling_price:product_id===221?'140':product_id===212?'100':product_id===215?'0.01':'112'});
 async function document(type,items,approve=true){const row=await auth.transaction(async c=>{const r=await purchasing.createDocument(c,type,102,{supplier_id:supplier.supplier_id,delivery_ref:'SYNTHETIC-'+randomUUID(),items});await auth.audit(c,102,type+'.created:'+r[type==='orders'?'po_id':'stock_in_id'],type==='orders'?'purchase_orders':'stock_in');return r;});if(approve)await auth.transaction(async c=>{const key=type==='orders'?'po_id':'stock_in_id';await purchasing.approve(c,type,row[key],103);await auth.audit(c,103,type+'.approved:'+row[key],type==='orders'?'purchase_orders':'stock_in');});return row;}
 const receiving=await document('receiving',[line(201,5,'EARLY',10),line(201,55,'LATER'),line(201,3,'EXPIRED',-1),line(201,3,'TODAY',0),line(221,30,'REPLACEMENT'),...Array.from({length:6},(_,i)=>line(211+i,30,'BENEFIT-'+i))]);
 await document('receiving',[line(201,4,'PENDING')],false);
 const order=await document('orders',[{product_id:201,quantity:4,unit_cost:'1'}]);const detail=await ops.order(102,order.po_id);
 for(const tag of ['PARTIAL','FINAL']){const r=await ops.receive(102,{po_id:order.po_id,request_id:randomUUID(),delivery_ref:'SYNTHETIC-'+tag,items:[{po_item_id:detail.items[0].po_item_id,quantity:2,batch_no:'SYNTHETIC-LINKED-'+tag,expiry_date:day(30),cost_price:'1',selling_price:'112'}]});await auth.transaction(async c=>{await purchasing.approve(c,'receiving',r.stock_in_id,103);await auth.audit(c,103,'receiving.approved:'+r.stock_in_id,'stock_in');});}
 const actor=await auth.findById(101);
 async function cash(quantity){return auth.transaction(async c=>{const data={items:[{product_id:201,quantity}],request_id:randomUUID(),amount_paid:'1000'};const q=await pos.quote(c,data);return (await pos.checkout(c,actor,data,auth.audit,q.fingerprint)).receipt;});}
 for(const scheme of ['senior','pwd'])await auth.transaction(async c=>{const items=[{product_id:211,quantity:1},{product_id:212,quantity:1},{product_id:213,quantity:1}],draft={benefit:scheme,customer:{name:'SYNTHETIC ACADEMIC BENEFICIARY',id:'SYNTHETIC-ACADEMIC-ID',idType:scheme==='senior'?'osca':'pwd_digital'},documents:{identitySeen:true,entitlementConfirmed:true,exclusiveUse:true,purchaser:'self',...(scheme==='pwd'?{bookletSeen:true}:{})}};const v=await benefits.verification(c,actor,{items,draft});const q=await benefits.quote(c,actor,{items,benefit:scheme,...v});await benefits.checkout(c,actor,{items,benefit:scheme,...v,request_id:randomUUID(),amount_paid:'1000',quote_token:q.quote_token},auth.audit);});
 const source=await cash(3);const ret=await work.requestReturn(101,{sale_id:source.sale_id,sale_item_id:source.items[0].sale_item_id,quantity:source.items[0].quantity,reason:'SYNTHETIC academic return',request_key:randomUUID()});await work.decideReturn(102,ret.return_id,'approved');await work.receiveReturn(101,ret.return_id);
 async function exchange(product){const draft={claims:[{return_id:ret.return_id,quantity:1}],items:[{product_id:product,quantity:1}],reason:'SYNTHETIC academic exchange',route:'voluntary'},q=await exchanges.quote(101,draft);const r=await exchanges.create(101,{request_id:randomUUID(),draft,quote_token:q.quote_token});return r;}
 const higher=await exchange(221);await exchanges.decision(102,higher.exchange_id,{decision:'approved'});const reviewed=await exchanges.reviewedQuote(101,higher.exchange_id);await exchanges.post(101,higher.exchange_id,{request_id:randomUUID(),quote_token:reviewed.quote_token,tender:'50'});await exchange(201);
 const another=await cash(1),r=await work.requestReturn(101,{sale_id:another.sale_id,sale_item_id:another.items[0].sale_item_id,quantity:1,reason:'SYNTHETIC restock assessment',request_key:randomUUID()});await work.decideReturn(102,r.return_id,'approved');await work.receiveReturn(101,r.return_id);
 const disp=await work.requestDisposition(102,{return_id:r.return_id,action:'restock',quantity:1,reason:'SYNTHETIC original batch assessment',request_key:randomUUID()});await work.decideDisposition(104,disp.disposition_id,'approved',undefined,901,'SYNTHETIC TEST ONLY original batch suitable');
 const batch=(await purchasing.detail('receiving',receiving.stock_in_id)).items.find(i=>i.product_id===201&&i.batch_no==='SYNTHETIC-LATER').batch_id;
 for(const decision of ['approved','rejected',null]){const a=await work.requestAdjustment(101,{batch_id:batch,quantity:-1,reason:'SYNTHETIC counting request',request_key:randomUUID()});if(decision)await work.decideAdjustment(102,a.adjustment_id,decision,decision==='rejected'?'SYNTHETIC rejection':undefined);}
 const last=await cash(1);await work.requestReturn(101,{sale_id:last.sale_id,sale_item_id:last.items[0].sale_item_id,quantity:1,reason:'SYNTHETIC pending review',request_key:randomUUID()});
 await ops.savePreferences(103,{expected_revision:0,low_stock_dashboard:true,upcoming_expiry_dashboard:true});
 return {sourceReceipt:source.receipt_no,postedExchange:higher.exchange_id};
}
export async function reconcileAcademicData(c){
 const financial=(await c.query(`SELECT count(*)::int AS n FROM sales s WHERE
  s.total_amount IS DISTINCT FROM (SELECT sum(amount_paid-change_due) FROM payments p WHERE p.sale_id=s.sale_id)
  OR s.total_amount IS DISTINCT FROM (SELECT sum(CASE WHEN to_jsonb(i)->>'financial_snapshot_version'='2' THEN (to_jsonb(i)->>'net_line_amount')::numeric ELSE quantity*unit_price END) FROM sale_items i WHERE i.sale_id=s.sale_id)
  OR NOT EXISTS(SELECT 1 FROM activity_logs a WHERE a.module='POS' AND a.action='sale.paid:'||s.sale_id AND a.user_id=s.user_id)`)).rows[0].n;
 const stock=(await c.query(`SELECT count(*)::int AS n FROM batches b WHERE b.qty_on_hand<0 OR b.qty_on_hand IS DISTINCT FROM
  (coalesce((SELECT sum(i.quantity) FROM stock_in_items i JOIN stock_ins h USING(stock_in_id) WHERE i.batch_id=b.batch_id AND h.approved_by IS NOT NULL),0)
  -coalesce((SELECT sum(i.quantity) FROM sale_items i WHERE i.batch_id=b.batch_id),0)
  +coalesce((SELECT sum(a.quantity) FROM stock_adjustments a WHERE a.batch_id=b.batch_id AND a.decision_state='approved' AND a.posted_at IS NOT NULL),0)
  -coalesce((SELECT sum(i.quantity) FROM exchange_items i JOIN product_exchanges e USING(exchange_id) WHERE i.batch_id=b.batch_id AND e.state='posted'),0))`)).rows[0].n;
 const returns=(await c.query("SELECT count(*)::int AS n FROM sale_items i WHERE i.quantity<(SELECT coalesce(sum(quantity),0) FROM sale_returns r WHERE r.sale_item_id=i.sale_item_id AND r.decision_state='approved')")).rows[0].n;
 const settlement=(await c.query("SELECT count(*)::int AS n FROM exchange_settlements s JOIN product_exchanges e USING(exchange_id) WHERE e.state<>'posted' OR s.cash_due<>e.additional_cash OR s.tender-s.change_due<>s.cash_due")).rows[0].n;
 if(financial||stock||returns||settlement)throw Error('Synthetic reconciliation refused');
 return {financial,stock,returns,settlement};
}
