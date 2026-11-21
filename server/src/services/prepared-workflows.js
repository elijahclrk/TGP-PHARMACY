// Transaction services: only exposed through explicit feature/schema gates.
// Requires reviewed 003/007/008; never supplies a default production pool.
import { insertWithId } from '../repositories/auth.repository.js';
const fail = (status = 409) => { throw Object.assign(new Error('Workflow request cannot be completed'), { status }); };
const integer = value => { if (!Number.isInteger(value) || value < 1 || value > 2147483647) fail(400); return value; };
const text = value => { if (typeof value !== 'string' || !value.trim() || value.length > 1000) fail(400); return value.trim(); };
const key = value => { if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) fail(400); return value.toLowerCase(); };
const one = async (c, sql, args) => { const row = (await c.query(sql, args)).rows[0]; if (!row) fail(404); return row; };
const types = Object.freeze({ adjustment: ['stock_adjustments','adjustment_id','adjusted_by'], return: ['sale_returns','return_id','processed_by'], disposition: ['return_dispositions','disposition_id','requested_by'] });

export function createPreparedWorkflows(poolProvider) {
  if (typeof poolProvider !== 'function') throw new TypeError('Explicit transaction provider required');
  async function transaction(actorId, management, work) {
    integer(actorId);
    const c = await poolProvider().connect();
    try {
      await c.query('BEGIN');
      // Same namespace as account changes. Prevent role/status revocation races.
      await c.query('SELECT pg_advisory_xact_lock_shared(742901,2)');
      const actor = await one(c, 'SELECT user_id,role,status FROM users WHERE user_id=$1 FOR SHARE', [actorId]);
      if (actor.status !== 'active' || (management && !['manager','admin'].includes(actor.role))) fail(403);
      const result = await work(c, actor);
      await c.query('COMMIT');
      return result;
    } catch (error) { await c.query('ROLLBACK').catch(() => {}); throw error; }
    finally { c.release(); }
  }
  async function audit(c, actor, action) {
    await insertWithId(c, 'INSERT INTO activity_logs(log_id,user_id,action,module,logged_at) VALUES($1,$2,$3,\'controlled_workflows\',CURRENT_TIMESTAMP) ON CONFLICT(log_id) DO NOTHING RETURNING log_id', [actor, action]);
  }
  async function replay(c, kind, requestKey, expected) {
    await c.query('SELECT pg_advisory_xact_lock(742902,hashtext($1))', [requestKey]);
    const [table] = types[kind];
    const row = (await c.query(`SELECT * FROM ${table} WHERE request_key=$1`, [requestKey])).rows[0];
    if (row && Object.entries(expected).some(([field, value]) => row[field] !== value)) fail();
    return row;
  }
  async function lock(c, kind, id) {
    const [table, pk] = types[kind];
    return one(c, `SELECT * FROM ${table} WHERE ${pk}=$1 FOR UPDATE`, [id]);
  }
  async function requirePaidSale(c, saleId) {
    // Does not use reports' NOT EXISTS(any return) cohort exclusion. A second
    // legitimate partial return must still reference the same completed sale.
    const row = await one(c, `SELECT s.sale_id FROM sales s
      WHERE s.sale_id=$1 AND s.receipt_no IS NOT NULL AND length(btrim(s.receipt_no))>0 AND s.sale_date IS NOT NULL
      AND s.total_amount IS NOT NULL AND s.total_amount>=0 AND s.total_amount<'Infinity'::numeric
      AND (SELECT count(*) FROM sales x WHERE x.receipt_no=s.receipt_no)=1
      AND EXISTS(SELECT 1 FROM activity_logs a WHERE a.module='POS' AND a.action='sale.paid:'||s.sale_id AND a.user_id=s.user_id)
      AND (SELECT count(*)=1 AND bool_and(method='cash' AND amount_paid IS NOT NULL AND change_due IS NOT NULL
        AND amount_paid>=0 AND amount_paid<'Infinity'::numeric AND change_due>=0 AND change_due<=amount_paid)
        AND sum(amount_paid-change_due)=s.total_amount FROM payments WHERE sale_id=s.sale_id)
      AND (SELECT count(*)>0 AND bool_and(quantity IS NOT NULL AND quantity>0 AND unit_price IS NOT NULL
        AND unit_price>=0 AND unit_price<'Infinity'::numeric) AND sum(CASE WHEN to_jsonb(s)->>'financial_snapshot_version'='2'
          THEN (to_jsonb(sale_items)->>'net_line_amount')::numeric ELSE quantity*unit_price END)=s.total_amount
        FROM sale_items WHERE sale_id=s.sale_id)
      AND ((s.discount_id IS NULL AND s.senior_pwd_id IS NULL AND s.vat_exempt IS NOT TRUE AND to_jsonb(s)->>'financial_snapshot_version' IS NULL)
       OR (to_jsonb(s)->>'financial_snapshot_version'='2' AND to_jsonb(s)->>'benefit_type' IN ('senior','pwd')
        AND s.discount_id IS NOT NULL AND s.senior_pwd_id IS NOT NULL AND to_jsonb(s)->>'benefit_request_digest' IS NOT NULL))`, [saleId]);
    return row; // Acceptance/quarantine still creates no cash refund or reversal.
  }
  function reviewer(row, actor, initiator) {
    if (row[initiator] === actor.user_id) fail(403);
    if (row.decision_state !== 'pending') fail();
  }
  async function decide(c, kind, row, actor, decision, reason, posting = {}) {
    const [table, pk] = types[kind];
    const approval = kind === 'disposition' ? '' : ',approved_by=CASE WHEN $2=\'approved\' THEN $3::integer ELSE NULL END';
    const fields = Object.keys(posting);
    const result = await c.query(`UPDATE ${table} SET decision_state=$2,reviewed_by=$3,reviewed_at=CURRENT_TIMESTAMP,decision_reason=$4${approval}${fields.map((f,i) => `,${f}=$${i+5}`).join('')}
      WHERE ${pk}=$1 AND decision_state='pending' RETURNING *`, [row[pk], decision, actor.user_id, decision === 'rejected' ? reason : null, ...Object.values(posting)]);
    if (result.rowCount !== 1) fail();
    await audit(c, actor.user_id, `${kind}.${decision}:${row[pk]}`);
    return result.rows[0];
  }
  async function post(c, adjustment, actor, timestamp) {
    const batch = await one(c, 'SELECT * FROM batches WHERE batch_id=$1 FOR UPDATE', [adjustment.batch_id]);
    const after = batch.qty_on_hand + adjustment.quantity;
    if (!Number.isInteger(batch.qty_on_hand) || batch.qty_on_hand < 0 || !Number.isInteger(after) || after < 0 || after > 2147483647) fail();
    const changed = await c.query('UPDATE batches SET qty_on_hand=$2 WHERE batch_id=$1 AND qty_on_hand=$3 RETURNING batch_id', [batch.batch_id, after, batch.qty_on_hand]);
    if (changed.rowCount !== 1) fail();
    return decide(c, 'adjustment', adjustment, actor, 'approved', null, { posted_at: timestamp, balance_before: batch.qty_on_hand, balance_after: after });
  }
  return {
    async requestAdjustment(actorId, input) {
      const batchId = integer(input.batch_id), reason = text(input.reason), requestKey = key(input.request_key);
      if (!Number.isInteger(input.quantity) || input.quantity === 0 || Math.abs(input.quantity) > 2147483647) fail(400);
      return transaction(actorId, false, async c => {
        const expected = { batch_id: batchId, adjusted_by: actorId, quantity: input.quantity, reason, origin_kind: 'manual' };
        const existing = await replay(c, 'adjustment', requestKey, expected); if (existing) return existing;
        await one(c, 'SELECT batch_id FROM batches WHERE batch_id=$1 FOR KEY SHARE', [batchId]);
        const row = await insertWithId(c, "INSERT INTO stock_adjustments(adjustment_id,batch_id,adjusted_by,quantity,reason,adjustment_date,decision_state,request_key) VALUES($1,$2,$3,$4,$5,CURRENT_TIMESTAMP,'pending',$6) ON CONFLICT(adjustment_id) DO NOTHING RETURNING *", [batchId, actorId, input.quantity, reason, requestKey]);
        await audit(c, actorId, `adjustment.requested:${row.adjustment_id}`); return row;
      });
    },
    async decideAdjustment(actorId, id, decision, reason) {
      integer(id); if (!['approved','rejected'].includes(decision)) fail(400); if (decision === 'rejected') reason = text(reason);
      return transaction(actorId, true, async (c, actor) => {
        const row = await lock(c, 'adjustment', id); reviewer(row, actor, 'adjusted_by');
        if (row.origin_kind !== 'manual') fail(); // Restock can only post with its disposition.
        if (decision === 'rejected') return decide(c, 'adjustment', row, actor, decision, reason);
        const { now } = await one(c, 'SELECT CURRENT_TIMESTAMP AS now');
        return post(c, row, actor, now);
      });
    },
    async requestReturn(actorId, input) {
      const saleId = integer(input.sale_id), itemId = integer(input.sale_item_id), quantity = integer(input.quantity), reason = text(input.reason), requestKey = key(input.request_key);
      return transaction(actorId, false, async c => {
        const existing = await replay(c, 'return', requestKey, { sale_id: saleId, sale_item_id: itemId, processed_by: actorId, quantity, reason }); if (existing) return existing;
        await requirePaidSale(c, saleId);
        const item = await one(c, 'SELECT * FROM sale_items WHERE sale_item_id=$1 AND sale_id=$2 FOR UPDATE', [itemId, saleId]);
        if (!Number.isInteger(item.quantity) || quantity > item.quantity) fail();
        const {used}=await one(c,"SELECT COALESCE(sum(quantity),0)::text AS used FROM sale_returns WHERE sale_item_id=$1 AND decision_state='approved'",[itemId]);
        if(BigInt(used)+BigInt(quantity)>BigInt(item.quantity))fail();
        // No receipt guessing or independent batch input is accepted.
        const row = await insertWithId(c, "INSERT INTO sale_returns(return_id,sale_id,sale_item_id,processed_by,quantity,reason,return_date,decision_state,request_key) VALUES($1,$2,$3,$4,$5,$6,(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date,'pending',$7) ON CONFLICT(return_id) DO NOTHING RETURNING *", [saleId, itemId, actorId, quantity, reason, requestKey]);
        await audit(c, actorId, `return.requested:${row.return_id}`); return row;
      });
    },
    async decideReturn(actorId, id, decision, reason) {
      integer(id); if (!['approved','rejected'].includes(decision)) fail(400); if (decision === 'rejected') reason = text(reason);
      return transaction(actorId, true, async (c, actor) => {
        // Lock original item first, then request. Same order for every approval.
        const initial = await one(c, 'SELECT sale_item_id FROM sale_returns WHERE return_id=$1', [id]);
        const item = await one(c, 'SELECT * FROM sale_items WHERE sale_item_id=$1 FOR UPDATE', [initial.sale_item_id]);
        const row = await lock(c, 'return', id); reviewer(row, actor, 'processed_by');
        if (row.sale_item_id !== item.sale_item_id || row.sale_id !== item.sale_id) fail();
        await requirePaidSale(c, row.sale_id);
        if (decision === 'approved') {
          const { used } = await one(c, "SELECT COALESCE(sum(quantity),0)::text AS used FROM sale_returns WHERE sale_item_id=$1 AND decision_state='approved'", [item.sale_item_id]);
          if (!Number.isInteger(item.quantity) || BigInt(used) + BigInt(row.quantity) > BigInt(item.quantity)) fail();
        }
        return decide(c, 'return', row, actor, decision, reason); // No batch/payment changes.
      });
    },
    async receiveReturn(actorId, id) {
      integer(id);
      return transaction(actorId, false, async (c,actor) => {
        const initial = await one(c, 'SELECT sale_item_id FROM sale_returns WHERE return_id=$1', [id]);
        await one(c, 'SELECT * FROM sale_items WHERE sale_item_id=$1 FOR UPDATE', [initial.sale_item_id]);
        const row = await lock(c, 'return', id);
        if(actor.role==='employee'&&row.processed_by!==actorId)fail(403);
        if (row.decision_state !== 'approved') fail();
        if (row.received_quantity === row.quantity) return row; // Lost-ack recovery: full receipt once.
        if (row.received_quantity !== 0) fail();
        const updated = await one(c, 'UPDATE sale_returns SET received_quantity=quantity,received_at=CURRENT_TIMESTAMP,received_by=$2 WHERE return_id=$1 AND received_quantity=0 RETURNING *', [id, actorId]);
        await audit(c, actorId, `return.quarantined:${id}`); return updated;
      });
    },
    async requestDisposition(actorId, input) {
      const returnId = integer(input.return_id), quantity = integer(input.quantity), reason = text(input.reason), requestKey = key(input.request_key);
      if (!['destroy','supplier_return','restock'].includes(input.action)) fail(400);
      return transaction(actorId, true, async c => {
        const existing = await replay(c, 'disposition', requestKey, { return_id: returnId, requested_by: actorId, quantity, reason, action: input.action }); if (existing) return existing;
        const row = await lock(c, 'return', returnId);
        if (row.decision_state !== 'approved' || row.received_quantity !== row.quantity || quantity > row.received_quantity) fail();
        const disposition = await insertWithId(c, "INSERT INTO return_dispositions(disposition_id,return_id,request_key,action,quantity,requested_by,requested_at,reason,decision_state) VALUES($1,$2,$3,$4,$5,$6,CURRENT_TIMESTAMP,$7,'pending') ON CONFLICT(disposition_id) DO NOTHING RETURNING *", [returnId, requestKey, input.action, quantity, actorId, reason]);
        await audit(c, actorId, `disposition.requested:${disposition.disposition_id}`); return disposition;
      });
    },
    async decideDisposition(actorId, id, decision, reason, authorizationId, assessment) {
      integer(id); if (!['approved','rejected'].includes(decision)) fail(400); if (decision === 'rejected') reason = text(reason);
      return transaction(actorId, true, async (c, actor) => {
        const initial = await one(c, 'SELECT return_id FROM return_dispositions WHERE disposition_id=$1', [id]);
        const returned = await lock(c, 'return', initial.return_id);
        const row = await lock(c, 'disposition', id); reviewer(row, actor, 'requested_by');
        if (row.return_id !== returned.return_id) fail();
        if (decision === 'rejected') return decide(c, 'disposition', row, actor, decision, reason);
        if (returned.decision_state !== 'approved' || returned.received_quantity !== returned.quantity) fail();
        const { used } = await one(c, "SELECT COALESCE(sum(quantity),0)::text AS used FROM return_dispositions WHERE return_id=$1 AND decision_state='approved'", [returned.return_id]);
        if (BigInt(used) + BigInt(row.quantity) > BigInt(returned.received_quantity)) fail();
        if (row.action !== 'restock') return decide(c, 'disposition', row, actor, decision, null);
        if (returned.processed_by === actorId) fail(403);
        integer(authorizationId);
        await one(c, 'SELECT authorization_id FROM pharmacist_authorizations WHERE authorization_id=$1 AND user_id=$2 AND revoked_at IS NULL AND verified_at<=CURRENT_TIMESTAMP AND expires_at>CURRENT_TIMESTAMP FOR SHARE', [authorizationId, actorId]);
        const item = await one(c, 'SELECT batch_id FROM sale_items WHERE sale_item_id=$1', [returned.sale_item_id]);
        await one(c, "SELECT batch_id FROM batches WHERE batch_id=$1 AND expiry_date>(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date FOR UPDATE", [item.batch_id]);
        assessment=text(assessment);
        const { now } = await one(c, 'SELECT CURRENT_TIMESTAMP AS now');
        const adjustment = await insertWithId(c, "INSERT INTO stock_adjustments(adjustment_id,batch_id,adjusted_by,quantity,reason,adjustment_date,decision_state,request_key,origin_kind,return_disposition_id) VALUES($1,$2,$3,$4,$5,CURRENT_TIMESTAMP,'pending',$6,'return_restock',$7) ON CONFLICT(adjustment_id) DO NOTHING RETURNING *", [item.batch_id, row.requested_by, row.quantity, `Controlled restock disposition:${id}`, row.request_key, id]);
        await post(c, adjustment, actor, now);
        return decide(c, 'disposition', row, actor, decision, null, { pharmacist_authorization_id: authorizationId, adjustment_id: adjustment.adjustment_id, posted_at: now,restock_eligible:true,restock_assessment:assessment });
      });
    },
  };
}
