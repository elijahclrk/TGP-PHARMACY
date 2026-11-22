import {createHash} from 'node:crypto';
import {seedScenarios,reconcileAcademicData} from './seed.mjs';
import {verifiedAcademicContext} from '../src/academic/capabilities.js';
import {createAuthRepository} from '../src/repositories/auth.repository.js';

export function recoveryRequestId(seedId,label){
 const hex=createHash('sha256').update(JSON.stringify([seedId,label])).digest('hex');
 return hex.slice(0,8)+'-'+hex.slice(8,12)+'-4'+hex.slice(13,16)+'-8'+hex.slice(17,20)+'-'+hex.slice(20,32);
}

// Repository transaction boundaries become savepoints on a single runtime
// connection. A failure leaves no committed continuation rows.
export function recoveryPool(client){
 let serial=0;
 return {async connect(){
  const name='academic_recovery_'+ ++serial;
  return {
   connection:client.connection,
   release(){},
   query(sql,...args){
    if(sql==='BEGIN'||sql==='BEGIN READ ONLY')return client.query('SAVEPOINT '+name);
    if(sql==='COMMIT')return client.query('RELEASE SAVEPOINT '+name);
    if(sql==='ROLLBACK')return client.query('ROLLBACK TO SAVEPOINT '+name+'; RELEASE SAVEPOINT '+name);
    return client.query(sql,...args);
   },
  };
 }};
}

export async function recoverSeedScenarios(config,pool){
 // Check real TLS, catalog and attestation before opening the outer transaction.
 const context=await verifiedAcademicContext(config,pool);
 const client=await context.provider().connect();
 try{
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(742901,94)');
  const {seedId}=config.document.payload;
  const marker='seed.continuation:'+seedId;
  const state=(await client.query(`SELECT
   (SELECT count(*)::int FROM users) AS users,
   (SELECT count(*)::int FROM sales) AS sales,
   (SELECT count(*)::int FROM sale_returns) AS returns,
   (SELECT count(*)::int FROM product_exchanges) AS exchanges,
   (SELECT count(*)::int FROM activity_logs WHERE module='academic_setup' AND user_id=105 AND action=$1) AS completed`,[marker])).rows[0];
  if(state.users!==5)throw Error('RECOVERY_ACCOUNTS_MISMATCH');
  if(state.completed===0){
   if(state.sales!==3||state.returns!==1||state.exchanges!==0)throw Error('RECOVERY_CHECKPOINT_MISMATCH');
   const rows=(await client.query(`SELECT r.return_id,s.receipt_no,h.stock_in_id
    FROM sale_returns r JOIN sales s USING(sale_id) JOIN sale_items i ON i.sale_item_id=r.sale_item_id AND i.sale_id=s.sale_id
    JOIN batches b USING(batch_id) JOIN stock_in_items d USING(batch_id) JOIN stock_ins h USING(stock_in_id)
    WHERE r.reason='SYNTHETIC academic return' AND r.decision_state='approved' AND r.received_quantity=3
      AND r.quantity=3 AND r.reviewed_by=102 AND s.user_id=101 AND s.total_amount=336
      AND i.quantity=3 AND i.unit_price=112 AND b.batch_no='SYNTHETIC-EARLY' AND h.approved_by=103
      AND EXISTS(SELECT FROM activity_logs a WHERE a.module='controlled_workflows'
       AND a.user_id=101 AND a.action='return.quarantined:'||r.return_id)`)).rows;
   if(rows.length!==1)throw Error('RECOVERY_RETURN_MISMATCH');
   const row=rows[0];
   const nested=await verifiedAcademicContext(config,recoveryPool(client));
   await seedScenarios(nested,{receiving:row,source:row,ret:row,requestId:label=>recoveryRequestId(seedId,label)});
   await createAuthRepository(()=>client).audit(client,105,marker,'academic_setup');
  }else if(state.completed!==1)throw Error('RECOVERY_MARKER_MISMATCH');
  const final=(await client.query(`SELECT (SELECT count(*)::int FROM sales) AS sales,
   (SELECT count(*)::int FROM sale_returns) AS returns,(SELECT count(*)::int FROM product_exchanges) AS exchanges,
   (SELECT count(*)::int FROM payments) AS payments,(SELECT count(*)::int FROM return_dispositions) AS dispositions,
   (SELECT count(*)::int FROM stock_adjustments) AS adjustments`)).rows[0];
  if(final.sales!==5||final.returns!==3||final.exchanges!==2||final.payments!==5||final.dispositions!==1||final.adjustments!==4)throw Error('RECOVERY_FINAL_COUNTS_MISMATCH');
  await reconcileAcademicData(client);
  await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}
 finally{client.release();}
}
