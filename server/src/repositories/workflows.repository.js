import {readFile} from 'node:fs/promises';
const fail=status=>{throw Object.assign(new Error('Workflow record unavailable'),{status});};
const kinds={adjustments:['stock_adjustments','adjustment_id','adjusted_by','adjustment'],returns:['sale_returns','return_id','processed_by','return'],dispositions:['return_dispositions','disposition_id','requested_by','disposition']};
export function createWorkflowsRepository(poolProvider){
  const management=actor=>['manager','admin'].includes(actor.role);
  async function schemaReady(){
    try{
      const pool=poolProvider();
      const cols=(await pool.query("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name IN ('stock_adjustments','sale_returns','return_dispositions','pharmacist_authorizations')")).rows;
      const required={stock_adjustments:['decision_state','request_key','return_disposition_id','posted_at'],sale_returns:['sale_item_id','decision_state','received_quantity'],return_dispositions:['restock_eligible','restock_assessment','adjustment_id'],pharmacist_authorizations:['authorization_id','evidence_ref','expires_at','revoked_at']};
      if(Object.entries(required).some(([table,fields])=>fields.some(field=>!cols.some(c=>c.table_name===table&&c.column_name===field))))return false;
      const names=['adjustment_two_person_decision_ck','return_two_person_decision_ck','return_physical_receipt_ck','sale_returns_original_item_fk','disposition_posting_pair_fk','adjustment_return_origin_ck','disposition_restock_assessment_ck'];
      const constraints=(await pool.query('SELECT conname FROM pg_constraint WHERE connamespace=current_schema()::regnamespace AND conname=ANY($1::text[])',[names])).rows;
      if(names.some(n=>!constraints.some(c=>c.conname===n)))return false;
      const triggers=['adjustment_lifecycle','return_lifecycle','preserve_return_source','disposition_lifecycle','restock_adjustment_pair','restock_disposition_pair'];
      const installed=(await pool.query("SELECT t.tgname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace=current_schema()::regnamespace AND t.tgenabled='O' AND t.tgname=ANY($1::text[])",[triggers])).rows;
      if(triggers.some(n=>!installed.some(t=>t.tgname===n)))return false;
      // Fail closed on stale lifecycle function bodies, including older drafts.
      const actual=(await pool.query("SELECT proname,prosrc FROM pg_proc WHERE pronamespace=current_schema()::regnamespace AND proname LIKE 'tgp_%'")).rows;
      for(const file of ['007_decision_workflows.sql','008_return_dispositions.sql']){
        const sql=await readFile(new URL('../../database/migrations/proposed/batch1/'+file,import.meta.url),'utf8');
        for(const match of sql.matchAll(/CREATE FUNCTION (tgp_\w+)\(\) RETURNS trigger LANGUAGE plpgsql AS \$\$([\s\S]*?)\$\$;/g)){
          const normalized=s=>s.replace(/--[^\n]*/g,'').trim().replaceAll('\r','');
          if(!actual.some(r=>r.proname===match[1]&&normalized(r.prosrc)===normalized(match[2])))return false;
        }
      }
      return true;
    }catch{return false;}
  }
  async function list(kind,actor,q){
    const [table,pk,initiator]=kinds[kind];
    const where="($1::boolean OR t."+initiator+"=$2) AND ($3='all' OR t.decision_state=$3) AND ($4::uuid IS NULL OR t.request_key=$4)";
    const rows=await poolProvider().query(`WITH filtered AS (SELECT t.* FROM ${table} t WHERE ${where}) SELECT (SELECT count(*)::int FROM filtered) AS total,COALESCE((SELECT json_agg(r) FROM (SELECT * FROM filtered ORDER BY ${pk} DESC LIMIT $5 OFFSET $6) r),'[]'::json) AS data`,[management(actor),actor.user_id,q.status,q.request_key??null,q.limit,(q.page-1)*q.limit]);
    return {...rows.rows[0],page:q.page,limit:q.limit};
  }
  async function detail(kind,id,actor){
    const [table,pk,initiator,module]=kinds[kind];
    const row=(await poolProvider().query(`SELECT * FROM ${table} WHERE ${pk}=$1 AND ($2::boolean OR ${initiator}=$3)`,[id,management(actor),actor.user_id])).rows[0];if(!row)fail(404);
    if(kind==='adjustments')row.batch=(await poolProvider().query('SELECT b.batch_id,b.batch_no,b.expiry_date,p.name AS product_name FROM batches b JOIN products p ON p.product_id=b.product_id WHERE b.batch_id=$1',[row.batch_id])).rows[0];
    else if(kind==='returns'){
      row.original=(await poolProvider().query('SELECT s.receipt_no,i.sale_item_id,i.batch_id,i.quantity AS sold_quantity,b.batch_no,b.expiry_date,p.name AS product_name FROM sale_items i JOIN sales s ON s.sale_id=i.sale_id JOIN batches b ON b.batch_id=i.batch_id JOIN products p ON p.product_id=b.product_id WHERE i.sale_item_id=$1',[row.sale_item_id])).rows[0];
      row.dispositions=(await poolProvider().query('SELECT * FROM return_dispositions WHERE return_id=$1 ORDER BY requested_at,disposition_id',[id])).rows;
      row.quarantined_remaining=String(BigInt(row.received_quantity)-row.dispositions.filter(d=>d.decision_state==='approved').reduce((n,d)=>n+BigInt(d.quantity),0n));
    }
    row.history=(await poolProvider().query("SELECT l.user_id,u.username,l.action,l.logged_at AT TIME ZONE 'UTC' AS logged_at FROM activity_logs l JOIN users u ON u.user_id=l.user_id WHERE l.module='controlled_workflows' AND l.action=ANY($1::text[]) ORDER BY l.logged_at,l.log_id",[[`${module}.requested:${id}`,`${module}.approved:${id}`,`${module}.rejected:${id}`,`${module}.quarantined:${id}`]])).rows;
    return row;
  }
  async function receipt(receipt){
    const sales=(await poolProvider().query("SELECT sale_id,receipt_no,sale_date AT TIME ZONE 'UTC' AS sale_date,total_amount::text,discount_id,senior_pwd_id IS NOT NULL AS discounted_id,vat_exempt,to_jsonb(sales)->>'financial_snapshot_version' AS snapshot_version,to_jsonb(sales)->>'benefit_request_digest' IS NOT NULL AS benefit_reconciled FROM sales WHERE receipt_no=$1",[receipt])).rows;
    if(sales.length!==1)fail(sales.length?409:404);
    const s=sales[0];if((s.discount_id!==null||s.discounted_id||s.vat_exempt===true)&&!(s.snapshot_version==='2'&&s.benefit_reconciled))fail(409);
    // No beneficiary data or customer IDs are exposed by receipt lookup.
    s.items=(await poolProvider().query(`SELECT i.sale_item_id,i.batch_id,i.quantity,i.unit_price::text,b.batch_no,b.expiry_date,p.name AS product_name,
      COALESCE(sum(r.quantity) FILTER(WHERE r.decision_state='approved'),0)::text AS approved_returned,
      COALESCE(sum(r.quantity) FILTER(WHERE r.decision_state='pending'),0)::text AS pending_requested
      FROM sale_items i JOIN batches b ON b.batch_id=i.batch_id JOIN products p ON p.product_id=b.product_id LEFT JOIN sale_returns r ON r.sale_item_id=i.sale_item_id WHERE i.sale_id=$1 GROUP BY i.sale_item_id,b.batch_id,p.product_id ORDER BY i.sale_item_id`,[s.sale_id])).rows;
    delete s.discount_id;delete s.discounted_id;delete s.vat_exempt;delete s.snapshot_version;delete s.benefit_reconciled;return s;
  }
  async function authorizations(actor){
    if(!management(actor))fail(403);
    return (await poolProvider().query('SELECT authorization_id,expires_at FROM pharmacist_authorizations WHERE user_id=$1 AND revoked_at IS NULL AND verified_at<=CURRENT_TIMESTAMP AND expires_at>CURRENT_TIMESTAMP ORDER BY expires_at',[actor.user_id])).rows;
  }
  return {schemaReady,list,detail,receipt,authorizations};
}
