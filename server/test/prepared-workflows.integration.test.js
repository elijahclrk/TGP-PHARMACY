import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {getPool,closePool} from './support/disposable-database.js';
import {createPreparedWorkflows} from '../src/services/prepared-workflows.js';
import {prepareBenefitQuote} from '../src/services/prepared-benefits.js';
import express from 'express';
import cookieParser from 'cookie-parser';
import {listenForFetch} from '../testing/local-http.mjs';
import {createSessions} from '../src/services/sessions.js';
import {createAuthRepository} from '../src/repositories/auth.repository.js';
import {createWorkflowsRepository} from '../src/repositories/workflows.repository.js';
import {createWorkflowsRouter} from '../src/routes/workflows.routes.js';
import {createReportsRepository} from '../src/repositories/reports.repository.js';
import {errorHandler} from '../src/middleware/error-handler.js';

test('disposable PostgreSQL prepared workflows and real competing transactions',{skip:process.env.RUN_WORKFLOW_DB_TESTS!=='1'},async t=>{
  const pool=getPool(),schema='tgp_prepared_test_'+randomUUID().replaceAll('-','');let owned=false,next=100;
  async function connect(){
    const c=await pool.connect();return {release:()=>c.release(),async query(sql,p){
      if(sql==='BEGIN'){await c.query(sql);return c.query('SET LOCAL search_path TO '+schema);}
      return c.query(sql,p);
    }};
  }
  const provider=()=>({connect,query});
  async function query(sql,p){const c=await connect();try{await c.query('BEGIN');const r=await c.query(sql,p);await c.query('COMMIT');return r;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
  const service=createPreparedWorkflows(provider);
  async function sale(quantity=5){const id=next++;
    await query("INSERT INTO batches(batch_id,product_id,qty_on_hand,expiry_date) VALUES($1,1,20,'2099-01-01')",[id]);
    await query("INSERT INTO sales(sale_id,user_id,receipt_no,sale_date,total_amount) VALUES($1,1,$2,CURRENT_TIMESTAMP,$3)",[id,'Fixture-'+id,quantity*10]);
    await query('INSERT INTO sale_items(sale_item_id,sale_id,batch_id,quantity,unit_price) VALUES($1,$1,$1,$2,10)',[id,quantity]);
    await query("INSERT INTO payments(payment_id,sale_id,method,amount_paid,change_due) VALUES($1,$1,'cash',$2,0)",[id,quantity*10]);
    await query("INSERT INTO activity_logs(log_id,user_id,action,module,logged_at) VALUES($1,1,$2,'POS',CURRENT_TIMESTAMP)",[id,'sale.paid:'+id]);return id;
  }
  const request=(id,quantity=2)=>service.requestReturn(1,{sale_id:id,sale_item_id:id,quantity,reason:'Fixture return',request_key:randomUUID()});
  async function quarantine(){const id=await sale(),r=await request(id);await service.decideReturn(2,r.return_id,'approved');await service.receiveReturn(1,r.return_id);return {id,returnId:r.return_id};}
  async function disposition(returnId,action='restock',quantity=2){return service.requestDisposition(3,{return_id:returnId,action,quantity,reason:'Fixture controlled disposition',request_key:randomUUID()});}
  async function balance(id){return (await query('SELECT qty_on_hand FROM batches WHERE batch_id=$1',[id])).rows[0].qty_on_hand;}
  try {
    await pool.query('CREATE SCHEMA '+schema);owned=true;
    for(const [i,file]of ['001_phase3_baseline.sql','proposed/002_supported_integrity.sql','proposed/004_lookup_indexes.sql','proposed/003_return_sale_item_link.sql','proposed/batch1/007_decision_workflows.sql','proposed/batch1/008_return_dispositions.sql','proposed/batch1/009_discount_financial_snapshots.sql'].entries()){
      let sql=(await readFile(new URL('../database/migrations/'+file,import.meta.url),'utf8')).replace(/--[^\n]*/g,'').trim();
      if(i){assert(sql.startsWith('BEGIN;')&&sql.endsWith('COMMIT;'));sql=sql.slice(6,-7).replace(/^\s*SET LOCAL search_path = public;/,'');}
      await query(sql);
    }
    await query(`INSERT INTO users(user_id,username,password_hash,role,status) VALUES
      (1,'fixture_employee','synthetic','employee','active'),(2,'fixture_admin','synthetic','admin','active'),
      (3,'fixture_manager','synthetic','manager','active'),(4,'fixture_inactive','synthetic','employee','inactive'),
      (5,'fixture_pharmacist','synthetic','manager','active'),(6,'fixture_verifier','synthetic','admin','active');
      INSERT INTO products(product_id,name,unit_price) VALUES(1,'Fixture',10);
      INSERT INTO pharmacist_authorizations(authorization_id,user_id,authorized_by,evidence_ref,verified_at,expires_at)
        VALUES(40,5,6,'synthetic-professional-evidence',CURRENT_TIMESTAMP-interval '1 day',CURRENT_TIMESTAMP+interval '1 day');`);
    await t.test('concurrent adjustment replay/approval posts once and denies self/Employee/inactive review',async()=>{
      const id=await sale(),input={batch_id:id,quantity:-3,reason:'Fixture recount',request_key:randomUUID()};
      const [a,b]=await Promise.all([service.requestAdjustment(1,input),service.requestAdjustment(1,input)]);assert.equal(a.adjustment_id,b.adjustment_id);
      await assert.rejects(()=>service.decideAdjustment(1,a.adjustment_id,'approved'),{status:403});
      await assert.rejects(()=>service.decideAdjustment(4,a.adjustment_id,'approved'),{status:403});
      const outcomes=await Promise.allSettled([service.decideAdjustment(2,a.adjustment_id,'approved'),service.decideAdjustment(3,a.adjustment_id,'approved')]);
      assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);assert.equal(await balance(id),17);
      const self=await service.requestAdjustment(2,{...input,request_key:randomUUID()});await assert.rejects(()=>service.decideAdjustment(2,self.adjustment_id,'approved'),{status:403});
    });
    await t.test('audit failure and rejected/insufficient adjustments leave inventory unchanged',async()=>{
      const id=await sale(),r=await service.requestAdjustment(1,{batch_id:id,quantity:-1,reason:'Fixture rollback',request_key:randomUUID()});
      await query("CREATE FUNCTION fixture_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.module='controlled_workflows' AND NEW.action LIKE 'adjustment.approved:%' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF;RETURN NEW;END;$$; CREATE TRIGGER fixture_audit_failure BEFORE INSERT ON activity_logs FOR EACH ROW EXECUTE FUNCTION fixture_audit_failure()");
      await assert.rejects(()=>service.decideAdjustment(2,r.adjustment_id,'approved'),/synthetic audit failure/);assert.equal(await balance(id),20);
      assert.equal((await query('SELECT decision_state FROM stock_adjustments WHERE adjustment_id=$1',[r.adjustment_id])).rows[0].decision_state,'pending');
      await query('DROP TRIGGER fixture_audit_failure ON activity_logs; DROP FUNCTION fixture_audit_failure()');
      await service.decideAdjustment(2,r.adjustment_id,'rejected','Fixture rejected');await assert.rejects(()=>service.decideAdjustment(3,r.adjustment_id,'approved'),{status:409});
      const bad=await service.requestAdjustment(1,{batch_id:id,quantity:-21,reason:'Fixture excessive',request_key:randomUUID()});await assert.rejects(()=>service.decideAdjustment(2,bad.adjustment_id,'approved'),{status:409});assert.equal(await balance(id),20);
    });
    await t.test('competing returns serialize on sold item; rejected return and repeated receipt do not consume extra units',async()=>{
      const id=await sale(),a=await request(id,3),b=await request(id,3);
      const outcomes=await Promise.allSettled([service.decideReturn(2,a.return_id,'approved'),service.decideReturn(3,b.return_id,'approved')]);assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);
      const rows=(await query('SELECT * FROM sale_returns WHERE sale_id=$1',[id])).rows,approved=rows.find(r=>r.decision_state==='approved'),pending=rows.find(r=>r.decision_state==='pending');
      await service.decideReturn(2,pending.return_id,'rejected','Fixture excess');await assert.rejects(()=>service.receiveReturn(1,pending.return_id),{status:409});
      await Promise.all([service.receiveReturn(1,approved.return_id),service.receiveReturn(2,approved.return_id)]);
      assert.equal((await query('SELECT received_quantity FROM sale_returns WHERE return_id=$1',[approved.return_id])).rows[0].received_quantity,3);assert.equal(await balance(id),20);
      assert.equal((await query('SELECT sum(amount_paid-change_due)::text AS n FROM payments WHERE sale_id=$1',[id])).rows[0].n,'50');
    });
    await t.test('competing dispositions consume quarantine once; acceptance never restocks',async()=>{
      const {id,returnId}=await quarantine(),a=await disposition(returnId,'destroy'),b=await disposition(returnId,'supplier_return');
      const outcomes=await Promise.allSettled([service.decideDisposition(2,a.disposition_id,'approved'),service.decideDisposition(5,b.disposition_id,'approved')]);assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);assert.equal(await balance(id),20);
    });
    await t.test('restock requires current separate pharmacist evidence and original batch; repeated posting is refused',async()=>{
      const {id,returnId}=await quarantine(),d=await disposition(returnId);
      await assert.rejects(()=>service.decideDisposition(3,d.disposition_id,'approved',null,40,'Fixture verified medicine integrity/storage'),{status:403});
      await assert.rejects(()=>service.decideDisposition(2,d.disposition_id,'approved',null,40,'Fixture verified medicine integrity/storage'),{status:404});
      await query('UPDATE pharmacist_authorizations SET revoked_at=CURRENT_TIMESTAMP WHERE authorization_id=40');await assert.rejects(()=>service.decideDisposition(5,d.disposition_id,'approved',null,40,'Fixture verified medicine integrity/storage'),{status:404});
      await query('UPDATE pharmacist_authorizations SET revoked_at=NULL WHERE authorization_id=40');
      await query("UPDATE batches SET expiry_date=(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date WHERE batch_id=$1",[id]);await assert.rejects(()=>service.decideDisposition(5,d.disposition_id,'approved',null,40,'Fixture verified medicine integrity/storage'),{status:404});
      await query("UPDATE batches SET expiry_date='2099-01-01' WHERE batch_id=$1",[id]);
      await service.decideDisposition(5,d.disposition_id,'approved',null,40,'Fixture verified medicine integrity/storage');assert.equal(await balance(id),22);
      const a=(await query('SELECT * FROM stock_adjustments WHERE return_disposition_id=$1',[d.disposition_id])).rows[0];assert.equal(a.batch_id,id);assert.equal(a.quantity,2);assert.equal(a.decision_state,'approved');
      await assert.rejects(()=>service.decideDisposition(5,d.disposition_id,'approved',null,40,'Fixture verified medicine integrity/storage'),{status:409});assert.equal(await balance(id),22);
    });
    await t.test('competing restock decisions post quarantine quantity once across separate requests',async()=>{
      const {id,returnId}=await quarantine(),a=await disposition(returnId),b=await disposition(returnId);
      const outcomes=await Promise.allSettled([service.decideDisposition(5,a.disposition_id,'approved',null,40,'Fixture verified medicine integrity/storage'),service.decideDisposition(5,b.disposition_id,'approved',null,40,'Fixture verified medicine integrity/storage')]);
      assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);assert.equal(await balance(id),22);
      assert.equal((await query("SELECT count(*)::int AS n FROM stock_adjustments WHERE batch_id=$1 AND decision_state='approved'",[id])).rows[0].n,1);
    });
    await t.test('pharmacist authorization revocation waits for the locked restock transaction',async()=>{
      const {id,returnId}=await quarantine(),d=await disposition(returnId);
      let reached,continueApproval;const locked=new Promise(r=>{reached=r;}),resume=new Promise(r=>{continueApproval=r;});
      const paused=createPreparedWorkflows(()=>({async connect(){const c=await connect();return {release:()=>c.release(),async query(sql,p){const result=await c.query(sql,p);if(sql.startsWith('SELECT authorization_id FROM pharmacist_authorizations')){reached();await resume;}return result;}};}}));
      const approval=paused.decideDisposition(5,d.disposition_id,'approved',null,40,'Fixture verified medicine integrity/storage');await locked;
      const revoker=await connect();let revocation;
      try {
        await revoker.query('BEGIN');
        const pid=(await revoker.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        revocation=revoker.query('UPDATE pharmacist_authorizations SET revoked_at=clock_timestamp() WHERE authorization_id=40');
        const until=Date.now()+3000;let waiting=false;
        while(Date.now()<until){waiting=(await query("SELECT wait_event_type='Lock' AS waiting FROM pg_stat_activity WHERE pid=$1",[pid])).rows[0]?.waiting;if(waiting)break;await new Promise(r=>setTimeout(r,10));}
        assert.equal(waiting,true);continueApproval();await approval;await revocation;await revoker.query('COMMIT');
        assert.equal(await balance(id),22);
      }finally{continueApproval();await approval.catch(()=>{});if(revocation)await revocation.catch(()=>{});await revoker.query('ROLLBACK');revoker.release();}
      await query('UPDATE pharmacist_authorizations SET revoked_at=NULL WHERE authorization_id=40');
    });
    await t.test('deferred original-batch posting mismatch aborts the entire restock transaction',async()=>{
      const {id,returnId}=await quarantine(),d=await disposition(returnId),other=await sale();
      // Corrupt the derived batch only in this injected test transaction adapter.
      const faulty=createPreparedWorkflows(()=>({async connect(){const c=await connect();return {release:()=>c.release(),query(sql,p){if(sql==='SELECT batch_id FROM sale_items WHERE sale_item_id=$1')return Promise.resolve({rows:[{batch_id:other}],rowCount:1});return c.query(sql,p);}};}}));
      await assert.rejects(()=>faulty.decideDisposition(5,d.disposition_id,'approved',null,40,'Fixture verified medicine integrity/storage'),/Restock posting must match/);
      assert.equal(await balance(id),20);assert.equal(await balance(other),20);assert.equal((await query('SELECT decision_state FROM return_dispositions WHERE disposition_id=$1',[d.disposition_id])).rows[0].decision_state,'pending');
      assert.equal((await query('SELECT count(*)::int AS n FROM stock_adjustments WHERE return_disposition_id=$1',[d.disposition_id])).rows[0].n,0);
    });
    await t.test('mixed classified benefit calculations persist reconciled immutable snapshots; deferred mismatch rolls back',async()=>{
      const policy={verified:true,benefit:'senior',version:'synthetic-v1',source:'synthetic-not-legal-approval',rounding:'half_up_per_line',discountBps:2000,vatBps:1200,exemptEligibleVatable:true};
      const base={lineKey:'1',name:'Fixture',quantity:1,unitPrice:'112.00',eligibility:'eligible',benefit:'senior',tax:'vatable',priceBasis:'vat_inclusive',classificationSource:'synthetic',classificationVersion:'1',taxSource:'synthetic',taxVersion:'1'};
      const quote=prepareBenefitQuote({benefit:'senior',customer:{name:'Fixture',id:'synthetic-id'},policy,items:[base,{...base,lineKey:'2',eligibility:'ineligible'},{...base,lineKey:'3',tax:'vat_exempt',priceBasis:'vat_exempt',unitPrice:'100.00'}]});
      assert.equal(quote.totals.net,'272.00');
      await query("INSERT INTO discounts(discount_id,type,rate) VALUES(1,'senior',0.2)");
      async function persist(mismatch=false){const c=await connect(),id=next++;try{
        await c.query('BEGIN');const x=quote.totals;
        await c.query(`INSERT INTO sales(sale_id,user_id,receipt_no,sale_date,total_amount,discount_id,senior_pwd_id,vat_exempt,financial_snapshot_version,customer_name,benefit_type,policy_version,policy_source_snapshot,gross_amount,vat_removed_amount,discount_amount,vatable_amount,vat_exempt_amount,vat_amount)
          VALUES($1,1,$2,CURRENT_TIMESTAMP,$3,1,'synthetic-id',true,'1','Fixture','senior',$4,$5,$6,$7,$8,$9,$10,$11)`,[id,'Snapshot-'+id,x.net,policy.version,policy.source,x.gross,x.vatRemoved,x.discount,x.vatable,x.exempt,x.vat]);
        for(const l of (mismatch?quote.lines.slice(0,2):quote.lines))await c.query(`INSERT INTO sale_items(sale_item_id,sale_id,batch_id,quantity,unit_price,financial_snapshot_version,product_name_snapshot,tax_treatment_snapshot,benefit_eligible_snapshot,discount_rate_snapshot,vat_rate_snapshot,price_basis_snapshot,eligibility_source_snapshot,eligibility_version_snapshot,policy_version_snapshot,benefit_type_snapshot,tax_source_snapshot,tax_version_snapshot,gross_line_amount,vat_removed_line_amount,discount_line_amount,net_line_amount,vatable_line_amount,vat_exempt_line_amount,vat_line_amount)
          VALUES($1,$2,100,$3,$4,'1',$5,$6,$7,$8,$9,$10,$11,$12,$13,'senior',$14,$15,$16,$17,$18,$19,$20,$21,$22)`,[next++,id,l.quantity,l.unitPrice,l.productName,l.taxTreatment,l.benefitEligible,l.discountRateBps/10000,l.vatRateBps/10000,l.priceBasis,l.classificationSource,l.classificationVersion,l.policyVersion,l.taxSource,l.taxVersion,l.gross,l.vatRemoved,l.discount,l.net,l.vatable,l.exempt,l.vat]);
        await c.query('COMMIT');return id;
      }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
      const id=await persist();await assert.rejects(()=>query('UPDATE sales SET total_amount=0 WHERE sale_id=$1',[id]),/immutable/);
      await assert.rejects(()=>persist(true),/reconciliation failed/);
    });
    await t.test('reports retain completed cash sales across pending, rejected and approved returns without settlement',async()=>{
      const id=await sale(),repo=createReportsRepository(provider),day=(await query("SELECT to_char(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila','YYYY-MM-DD') AS day")).rows[0].day;
      const range={from:day,to:day,period:'day'},before=await repo.sales(range),products=await repo.products({...range,page:1,limit:100}),profit=await repo.profit(range);
      const a=await request(id);assert.equal((await repo.sales(range)).sales_amount,before.sales_amount);
      await service.decideReturn(2,a.return_id,'rejected','Fixture rejected');assert.equal((await repo.sales(range)).sales_amount,before.sales_amount);
      const b=await request(id);await service.decideReturn(2,b.return_id,'approved');assert.equal((await repo.sales(range)).sales_amount,before.sales_amount);
      assert.deepEqual(await repo.products({...range,page:1,limit:100}),products);assert.deepEqual(await repo.profit(range),profit);
      assert.equal((await query('SELECT amount_paid::text FROM payments WHERE sale_id=$1',[id])).rows[0].amount_paid,'50');
    });
    await t.test('protected HTTP workflows verify schema, receipt lineage, ownership, review and recorded history',async()=>{
      const repo=createWorkflowsRepository(provider);assert.equal(await repo.schemaReady(),true);
      const config={secret:'local-only-workflow-http-integration-secret',ttl:900,secure:false,origin:'http://localhost:5173'},sessions=createSessions(config);
      const app=express();app.use(express.json());app.use(cookieParser());app.use('/workflows',createWorkflowsRouter({config,sessions,authRepository:createAuthRepository(provider),repository:repo,service,enabled:true,restockingEnabled:true}));app.use(errorHandler);
      const server=await listenForFetch(app);
      const http=async(path,actor=1,body)=>{const r=await fetch('http://127.0.0.1:'+server.address().port+'/workflows'+path,{method:body===undefined?'GET':'POST',headers:{Cookie:'tgp_session='+sessions.issue(actor).token,Origin:config.origin,'X-TGP-Request':'1','Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,body:await r.json()};};
      try{
        assert.equal((await http('/capabilities')).body.data.enabled,true);
        const id=await sale();const receipt=await http('/receipt?receipt=Fixture-'+id);assert.equal(receipt.status,200);assert.equal(receipt.body.data.items[0].batch_id,id);assert(!JSON.stringify(receipt.body).includes('senior_pwd_id'));
        const created=await http('/returns',1,{sale_id:id,sale_item_id:id,quantity:2,reason:'HTTP fixture',request_key:randomUUID()});assert.equal(created.status,201);const r=created.body.data;
        assert.equal((await http('/returns/'+r.return_id,5)).status,200); // Management can inspect all.
        assert.equal((await http('/returns/'+r.return_id+'/decision',1,{decision:'approved'})).status,403);
        assert.equal((await http('/returns/'+r.return_id+'/decision',2,{decision:'approved'})).status,200);
        assert.equal((await http('/returns/'+r.return_id+'/receive',1,{})).status,200);
        const detail=(await http('/returns/'+r.return_id)).body.data;assert.equal(detail.received_quantity,2);assert.equal(detail.quarantined_remaining,'2');assert(detail.history.length>=3);
        const event=(await query("SELECT extract(epoch FROM logged_at AT TIME ZONE 'UTC')*1000 AS millis FROM activity_logs WHERE action=$1",['return.requested:'+r.return_id])).rows[0];
        assert.equal(Date.parse(detail.history.find(h=>h.action==='return.requested:'+r.return_id).logged_at),Math.floor(Number(event.millis)));
        const pending=await http('/returns?status=pending',2);assert(!pending.body.data.some(x=>x.return_id===r.return_id));
        const mine=await http('/adjustments',1);assert(mine.body.data.every(x=>x.adjusted_by===1));
        const foreign=await service.requestAdjustment(2,{batch_id:id,quantity:-1,reason:'Other actor fixture',request_key:randomUUID()});assert.equal((await http('/adjustments/'+foreign.adjustment_id,1)).status,404);
        assert.equal(await balance(id),20);
        const own=await http('/returns',2,{sale_id:id,sale_item_id:id,quantity:1,reason:'Management initiated',request_key:randomUUID()});assert.equal(own.status,201);
        assert.equal((await http('/returns/'+own.body.data.return_id+'/decision',2,{decision:'approved'})).status,403);
        const disposition=await http('/dispositions',3,{return_id:r.return_id,quantity:1,action:'restock',reason:'HTTP pharmacist review',request_key:randomUUID()});assert.equal(disposition.status,201);
        const d=disposition.body.data.disposition_id;
        assert.equal((await http('/dispositions/'+d+'/decision',5,{decision:'approved',authorization_id:40,restock_eligible:true})).status,503);
        assert.equal((await http('/dispositions/'+d+'/decision',5,{decision:'approved',authorization_id:40,restock_eligible:true,assessment:'Sealed pack; documented storage and suitability verified'})).status,200);
        const posted=(await http('/dispositions/'+d,5)).body.data;assert.equal(posted.restock_eligible,true);assert.match(posted.restock_assessment,/Sealed pack/);assert.equal(await balance(id),21);
        // Disabled lifecycle trigger closes the capability gate before writes.
        await query('ALTER TABLE stock_adjustments DISABLE TRIGGER adjustment_lifecycle');assert.equal(await repo.schemaReady(),false);await query('ALTER TABLE stock_adjustments ENABLE TRIGGER adjustment_lifecycle');assert.equal(await repo.schemaReady(),true);
      }finally{await new Promise(r=>server.close(r));}
    });
  }finally{
    // Keep the owned schema and successful fixtures for the owner's review.
    // Never DROP the temporary instance or these results automatically.
    if(owned)console.log('Retained local workflow review schema: '+schema);
    await closePool();
  }
});
