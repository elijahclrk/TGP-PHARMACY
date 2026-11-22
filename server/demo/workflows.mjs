import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { origin, refuse } from './config.mjs';
import { verifySchema } from './database.mjs';

const completedAction='demo.seed.v1.completed:';
const names=['DEMO ONLY Sample Tablet A','DEMO ONLY Sample Capsule B','DEMO ONLY Empty Stock Sample'];
function ensure(value){if(!value)refuse('DEMO_WORKFLOW_INVARIANT_FAILED');}
export function addDays(day,days){const d=new Date(day+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}

export async function runWorkflows(config,{seed=false}={}) {
  // config must already be activated, before any application modules load.
  const [{getPool,closePool},{createAccount},{createAuthRepository},{verifyPassword},{bootstrapSchema,userSchema}]=await Promise.all([
    import('../src/config/database.js'),import('../src/services/accounts.js'),import('../src/repositories/auth.repository.js'),
    import('../src/services/passwords.js'),import('../src/services/auth-validation.js')]);
  const pool=getPool(),repository=createAuthRepository(()=>pool);let client,server,locked=false;
  const accounts=Object.fromEntries(['admin','manager','employee'].map(role=>[role,{
    username:config.values[`DEMO_${role.toUpperCase()}_USERNAME`],password:config.values[`DEMO_${role.toUpperCase()}_PASSWORD`],
    role,full_name:'DEMO ONLY '+role,
  }]));
  const credentials=Object.values(accounts);
  if(!bootstrapSchema.safeParse(accounts.admin).success || credentials.slice(1).some(a=>!userSchema.safeParse(a).success))refuse('INVALID_DEMO_ACCOUNT_CONFIGURATION');
  try {
    client=await pool.connect();await client.query('BEGIN READ ONLY');locked=true;
    await verifySchema(client,config);
    if(!['UTC','GMT'].includes((await client.query('SHOW TIME ZONE')).rows[0].TimeZone))refuse('DEMO_REQUIRES_UTC_SESSION');
    // Database-local orchestration lock; never overlaps the business write lock.
    // Transaction-local lock also works through Neon transaction pooling.
    await client.query('SELECT pg_advisory_xact_lock(742901,99)');
    const complete=(await client.query("SELECT action FROM activity_logs WHERE module='demo_setup' AND starts_with(action,$1)",[completedAction])).rows;
    if(complete.length>1)refuse('AMBIGUOUS_DEMO_COMPLETION');
    let requestId=complete[0]?.action.slice(completedAction.length);
    if(requestId && !/^[a-f0-9-]{36}$/.test(requestId))refuse('INVALID_DEMO_COMPLETION');
    if(seed && !requestId) {
      const tables=await verifySchema(client,config);
      for(const table of tables)if((await client.query('SELECT count(*)::int AS n FROM public.'+table)).rows[0].n)refuse('NONEMPTY_OR_PARTIAL_DEMO_SETUP_REQUIRES_REVIEW');
      await createAccount(repository,null,accounts.admin,true);
    } else if(!requestId)refuse('DEMO_NOT_SEEDED');
    const {default:app}=await import('../src/app.js');
    server=app.listen(0,'127.0.0.1');await once(server,'listening');
    const base='http://127.0.0.1:'+server.address().port;
    const cookies={};let checks=0;
    async function api(path,{role='admin',method='GET',body,status=200}={}) {
      const response=await fetch(base+'/api'+path,{method,signal:AbortSignal.timeout(30000),
        headers:{Origin:origin,'X-TGP-Request':'1','Content-Type':'application/json',...(cookies[role]?{Cookie:cookies[role]}:{})},
        ...(body===undefined?{}:{body:JSON.stringify(body)})});
      const result=await response.json();
      if(response.status!==status)refuse('DEMO_API_STATUS_MISMATCH');checks++;
      const cookie=response.headers.get('set-cookie');if(cookie)cookies[role]=cookie.split(';')[0];
      return result;
    }
    const post=(path,body,role='manager',status=201)=>api(path,{method:'POST',body,role,status});
    await post('/auth/login',{username:accounts.admin.username,password:accounts.admin.password},'admin',200);
    if(seed && !requestId) {
      for(const role of ['manager','employee'])await post('/auth/users',accounts[role],'admin');
    }
    for(const role of ['manager','employee'])await post('/auth/login',{username:accounts[role].username,password:accounts[role].password},role,200);
    for(const role of ['admin','manager','employee']) {
      const me=(await api('/auth/me',{role})).user;ensure(me.role===role && me.status==='active');
      await api('/auth/dashboard/'+role,{role});
      const stored=await repository.findByUsername(accounts[role].username);
      ensure(stored?.password_hash.startsWith('$argon2id$') && await verifyPassword(stored.password_hash,accounts[role].password));
    }
    await api('/auth/login',{method:'POST',body:{username:accounts.admin.username,password:randomUUID()},status:401});
    let sale;
    if(seed && !requestId) {
      const products=[];
      for(let i=0;i<names.length;i++)products.push((await post('/products',{
        name:names[i],generic_name:'SYNTHETIC ACADEMIC FIXTURE - NOT FOR DISPENSING',category:null,
        unit_price:['10.00','25.00','5.00'][i],reorder_level:[5,3,1][i],
      },'admin')).data);
      const [a,b]=products;
      const supplier=(await post('/suppliers',{name:'DEMO ONLY Academic Supplier',contact_no:null,address:'SYNTHETIC FIXTURE - NOT A REAL SUPPLIER'})).data;
      const po=(await post('/purchase-orders',{supplier_id:supplier.supplier_id,items:[
        {product_id:a.product_id,quantity:10,unit_cost:'6.00'},{product_id:b.product_id,quantity:5,unit_cost:'15.00'},
      ]})).data;
      await post('/purchase-orders/'+po.po_id+'/approve',{},'manager',200);
      const today=(await client.query("SELECT to_char(clock_timestamp() AT TIME ZONE 'Asia/Manila','YYYY-MM-DD') AS day")).rows[0].day;
      const receiving=(await post('/stock-ins',{supplier_id:supplier.supplier_id,delivery_ref:'DEMO-ONLY-INITIAL-RECEIVING',items:[
        {product_id:a.product_id,batch_no:'DEMO-A-EARLY',expiry_date:addDays(today,10),quantity:3,cost_price:'6.00',selling_price:'10.00'},
        {product_id:a.product_id,batch_no:'DEMO-A-LATER',expiry_date:addDays(today,20),quantity:7,cost_price:'6.00',selling_price:'10.00'},
        {product_id:b.product_id,batch_no:'DEMO-B-AVAILABLE',expiry_date:addDays(today,365),quantity:5,cost_price:'15.00',selling_price:'25.00'},
      ]})).data;
      const before=(await api('/stock-ins/'+receiving.stock_in_id,{role:'manager'})).data;
      ensure(before.approved_by===null && before.items.length===3 && before.items.every(i=>i.qty_on_hand===0));
      await post('/stock-ins/'+receiving.stock_in_id+'/approve',{},'manager',200);
      const approved=(await api('/stock-ins/'+receiving.stock_in_id,{role:'manager'})).data;
      ensure(approved.approved_by!==null && approved.items.every(i=>i.qty_on_hand===i.quantity));
      await post('/stock-ins/'+receiving.stock_in_id+'/approve',{},'manager',409);
      const repeated=(await api('/stock-ins/'+receiving.stock_in_id,{role:'manager'})).data;
      ensure(repeated.items.every(i=>i.qty_on_hand===i.quantity));
      await api('/inventory/batches/'+approved.items[0].batch_id,{method:'PATCH',role:'manager',body:{qty_on_hand:999},status:400});
      // A second delivery remains pending for the presenter to approve manually.
      const pending=(await post('/stock-ins',{supplier_id:supplier.supplier_id,delivery_ref:'DEMO-ONLY-PRESENTATION-PENDING',items:[
        {product_id:b.product_id,batch_no:'DEMO-B-PENDING',expiry_date:addDays(today,200),quantity:4,cost_price:'15.00',selling_price:'25.00'},
      ]})).data;
      ensure((await api('/stock-ins/'+pending.stock_in_id,{role:'manager'})).data.items.every(i=>i.qty_on_hand===0));
      const zero=(await post('/products/'+b.product_id+'/batches',{batch_no:'DEMO-ZERO-METADATA',expiry_date:addDays(today,150),cost_price:'15.00',selling_price:'25.00'})).data;
      ensure(zero.qty_on_hand===0);
      ensure((await api('/purchase-orders/'+po.po_id,{role:'manager'})).data.status==='approved');
      const cart={items:[{product_id:a.product_id,quantity:5}]};
      const quote=(await post('/pos/quote',cart,'employee',200)).data;
      ensure(quote.total==='50.00');
      requestId=randomUUID();
      const checkout={...cart,request_id:requestId,amount_paid:'100.00',quote_token:quote.quote_token};
      const first=(await post('/pos/checkout',checkout,'employee')).data;
      ensure(first.replayed===false);sale=first.receipt;
      // Identical retry must replay, not deduct again.
      const replay=(await post('/pos/checkout',checkout,'employee',200)).data;
      ensure(replay.replayed===true && replay.receipt.sale_id===sale.sale_id);
      const status=(await api('/pos/checkouts/'+requestId,{role:'employee'})).data;
      ensure(status.status==='completed' && status.receipt.sale_id===sale.sale_id);
      ensure((await api('/pos/checkouts/'+requestId,{role:'manager'})).data.status==='not_found');
      ensure(sale.items.length===2 && sale.items[0].batch_no==='DEMO-A-EARLY' && sale.items[0].quantity===3 &&
        sale.items[1].batch_no==='DEMO-A-LATER' && sale.items[1].quantity===2);
      ensure(sale.total_amount==='50.00' && sale.payments.length===1 && sale.payments[0].amount_paid==='100.00' && sale.payments[0].change_due==='50.00');
    }
    // Repeated runs never create new business records. Verify the stored sale.
    const stored=(await api('/pos/checkouts/'+requestId,{role:'employee'})).data;
    ensure(stored.status==='completed');sale=stored.receipt;
    await api('/pos/sales/'+sale.sale_id,{role:'employee'});
    await api('/products',{role:'employee'});await api('/inventory/batches',{role:'employee'});
    const batches=(await api('/inventory/batches',{role:'employee'})).data;
    ensure(batches.every(row=>!Object.hasOwn(row,'cost_price')));
    for(const path of ['/suppliers','/purchase-orders','/stock-ins']) {
      await api(path,{role:'manager'});await api(path,{role:'employee',status:403});
    }
    await post('/products',{name:'DENIED'},'employee',403);
    ensure((await api('/products/1/image',{role:'employee'})).data.enabled===false);
    const day=(await client.query("SELECT to_char(sale_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila','YYYY-MM-DD') AS day FROM sales WHERE sale_id=$1",[sale.sale_id])).rows[0].day;
    const range='from='+day+'&to='+day;
    const reports=await api('/reports/sales?'+range+'&period=day',{role:'manager'});
    ensure(reports.transactions>=1 && reports.unreviewed>=1);
    for(const period of ['week','month'])await api('/reports/sales?'+range+'&period='+period);
    await api('/reports/sales?'+range+'&period=month',{role:'manager',status:403});
    await api('/reports/sales?'+range,{role:'employee',status:403});
    for(const path of ['/reports/products?'+range,'/reports/profit?'+range,'/reports/valuation','/reports/low-stock','/reports/near-expiry'])await api(path);
    // All quantities must reconcile to approved receipts minus persisted sales.
    const mismatch=(await client.query(`SELECT count(*)::int AS n FROM batches b WHERE b.qty_on_hand IS DISTINCT FROM
      (coalesce((SELECT sum(i.quantity) FROM stock_in_items i JOIN stock_ins s ON s.stock_in_id=i.stock_in_id WHERE i.batch_id=b.batch_id AND s.approved_by IS NOT NULL),0)
       -coalesce((SELECT sum(i.quantity) FROM sale_items i WHERE i.batch_id=b.batch_id),0))`)).rows[0].n;
    ensure(mismatch===0);
    const payment=(await client.query(`SELECT s.approved_by IS NULL AND s.total_amount=50 AND
      (SELECT sum(i.quantity*i.unit_price) FROM sale_items i WHERE i.sale_id=s.sale_id)=s.total_amount AND
      (SELECT count(*)=1 AND sum(p.amount_paid-p.change_due)=s.total_amount FROM payments p WHERE p.sale_id=s.sale_id) AS valid
      FROM sales s WHERE s.sale_id=$1`,[sale.sale_id])).rows[0].valid;
    ensure(payment);
    if(seed && !complete.length) {
      const admin=await repository.findByUsername(accounts.admin.username);
      await repository.transaction(db=>repository.audit(db,admin.user_id,completedAction+requestId,'demo_setup'));
    }
    for(const role of ['admin','manager','employee'])await post('/auth/logout',{},role,200);
    await verifySchema(client,config);
    return {checks,seedAlreadyComplete:Boolean(complete.length),inventoryReconciles:true,imagesDisabled:true};
  } finally {
    if(server)await new Promise(resolve=>server.close(resolve));
    if(client){if(locked)await client.query('ROLLBACK').catch(()=>{});client.release();}
    await closePool();
  }
}
