import { insertWithId } from './auth.repository.js';
import { quoteFingerprint } from '../services/pos-quotes.js';
const today = "(clock_timestamp() AT TIME ZONE 'Asia/Manila')::date";
const fail = (status, details = {}) => { throw Object.assign(new Error('Checkout cannot be completed'), { status, ...details }); };
const closureAction = id => 'checkout.closed:' + id.toLowerCase();

export function createPosRepository(poolProvider) {
  const closures = async (client, requestId) => (await client.query(
    "SELECT user_id FROM activity_logs WHERE module='POS_checkout' AND action=$1", [closureAction(requestId)])).rows;
  async function receipt(id, actor, client = poolProvider()) {
    // Phase 3 stores a UTC timestamp without a zone. Return an explicit instant;
    // otherwise pg interprets it in the Node host's local timezone (e.g. Manila).
    const sale = (await client.query(`SELECT s.sale_id,s.user_id,u.username,s.receipt_no,s.sale_date AT TIME ZONE 'UTC' AS sale_date,s.total_amount::text,s.approved_by,
      CASE WHEN to_jsonb(s)->>'financial_snapshot_version' IN ('1','2') THEN jsonb_build_object(
       'version',to_jsonb(s)->>'financial_snapshot_version','benefit',to_jsonb(s)->>'benefit_type',
       'gross',to_jsonb(s)->>'gross_amount','vatRemoved',to_jsonb(s)->>'vat_removed_amount','discount',to_jsonb(s)->>'discount_amount',
       'vatable',to_jsonb(s)->>'vatable_amount','exempt',to_jsonb(s)->>'vat_exempt_amount','vat',to_jsonb(s)->>'vat_amount','nonVat',to_jsonb(s)->>'non_vat_amount') END AS financial
      FROM sales s JOIN users u ON u.user_id=s.user_id WHERE s.sale_id=$1 AND ($2::boolean OR s.user_id=$3)`,
    [id, actor.role !== 'employee', actor.user_id])).rows[0];
    if (!sale) fail(404);
    sale.items = (await client.query(`SELECT i.sale_item_id,b.product_id,coalesce(to_jsonb(i)->>'product_name_snapshot',p.name) AS product_name,b.batch_id,coalesce(to_jsonb(i)->>'batch_no_snapshot',b.batch_no) AS batch_no,
      coalesce(to_jsonb(i)->>'expiry_date_snapshot',to_char(b.expiry_date,'YYYY-MM-DD')) AS expiry_date,i.quantity,i.unit_price::text,
      coalesce(to_jsonb(i)->>'net_line_amount',(i.unit_price*i.quantity)::text) AS line_total,
      to_jsonb(i)->>'discount_line_amount' AS discount,to_jsonb(i)->>'vat_removed_line_amount' AS vat_removed,to_jsonb(i)->>'vat_line_amount' AS vat
      FROM sale_items i JOIN batches b ON b.batch_id=i.batch_id JOIN products p ON p.product_id=b.product_id
      WHERE i.sale_id=$1 ORDER BY b.product_id,b.expiry_date,b.batch_id`, [id])).rows;
    sale.payments = (await client.query('SELECT method,amount_paid::text,change_due::text FROM payments WHERE sale_id=$1 ORDER BY payment_id', [id])).rows;
    return sale;
  }
  async function price(client, items) {
    const ids = items.map(item => item.product_id).sort((a,b) => a-b);
    // Lock the official prices before reading allocation. All app stock writers
    // share the existing account transaction lock; batch locks protect balances.
    const products = (await client.query(`SELECT product_id,name,round(unit_price,2)::text AS unit_price
      FROM products WHERE product_id=ANY($1::int[]) AND unit_price>=0 AND unit_price<'Infinity'::numeric
      ORDER BY product_id FOR UPDATE`, [ids])).rows;
    if (products.length !== items.length) fail(409, { correctable: true });
    const lines = (await client.query(`SELECT p.product_id,p.name,round(p.unit_price,2)::text AS unit_price,i.quantity,
      (round(p.unit_price,2)*i.quantity)::text AS line_total
      FROM jsonb_to_recordset($1::jsonb) AS i(product_id integer,quantity integer)
      JOIN products p ON p.product_id=i.product_id ORDER BY p.product_id`, [JSON.stringify(items)])).rows;
    const total = (await client.query(`SELECT sum(round(p.unit_price,2)*i.quantity)::text AS total
      FROM jsonb_to_recordset($1::jsonb) AS i(product_id integer,quantity integer)
      JOIN products p ON p.product_id=i.product_id`, [JSON.stringify(items)])).rows[0].total;
    return { items: lines, total };
  }
  async function allocate(client, lines) {
    const allocations = [];
    for (const line of lines) {
      const batches = (await client.query(`SELECT batch_id,qty_on_hand,batch_no,to_char(expiry_date,'YYYY-MM-DD') AS expiry_date FROM batches
        WHERE product_id=$1 AND qty_on_hand>0 AND expiry_date>${today}
        ORDER BY expiry_date,batch_id FOR UPDATE`, [line.product_id])).rows;
      let remaining = line.quantity;
      for (const batch of batches) {
        if (!remaining) break;
        const quantity = Math.min(remaining, batch.qty_on_hand);
        allocations.push({ product_id: line.product_id, batch_id: batch.batch_id, batch_no: batch.batch_no,
          expiry_date: batch.expiry_date, quantity, unit_price: line.unit_price });
        remaining -= quantity;
      }
      if (remaining) fail(409, { correctable: true });
    }
    return allocations;
  }
  async function reviewedSnapshot(client, data) {
    const priced = await price(client, data.items);
    const allocations = await allocate(client, priced.items);
    const { business_date } = (await client.query(`SELECT to_char(clock_timestamp() AT TIME ZONE 'Asia/Manila','YYYY-MM-DD') AS business_date`)).rows[0];
    return { priced, allocations, business_date, fingerprint: quoteFingerprint({ business_date, ...priced, allocations }) };
  }
  return {
    snapshot: reviewedSnapshot, // Internal transaction helper shared by protected replacement checkout.
    receipt,
    async status(client, actor, requestId) {
      const rows = (await client.query('SELECT sale_id,user_id FROM sales WHERE receipt_no=$1', ['POS-'+requestId.toLowerCase()])).rows;
      if (!rows.length) {
        const closed = await closures(client, requestId);
        return { status: closed.some(row => row.user_id === actor.user_id) ? 'closed' : 'not_found' };
      }
      if (rows[0].user_id !== actor.user_id) return { status:'not_found' };
      if (rows.length !== 1) fail(409);
      return { status:'completed',receipt:await receipt(rows[0].sale_id,actor,client) };
    },
    // Caller holds the same transaction advisory lock used by ALL checkouts.
    // This retires only an unused request reference; it never voids a sale.
    async resolve(client, actor, requestId, audit) {
      const rows = (await client.query('SELECT sale_id,user_id FROM sales WHERE receipt_no=$1 FOR UPDATE', ['POS-'+requestId.toLowerCase()])).rows;
      if (rows.length) {
        if (rows.length !== 1 || rows[0].user_id !== actor.user_id) fail(404);
        return { status:'completed',receipt:await receipt(rows[0].sale_id,actor,client) };
      }
      const closed = await closures(client, requestId);
      if (closed.some(row => row.user_id !== actor.user_id)) fail(404);
      if (!closed.length) await audit(client, actor.user_id, closureAction(requestId), 'POS_checkout');
      return { status:'closed' };
    },
    async products(query) {
      const result = await poolProvider().query(`WITH found AS (
        SELECT p.product_id,p.name,p.generic_name,round(p.unit_price,2)::text AS unit_price,
          coalesce((SELECT sum(b.qty_on_hand) FROM batches b WHERE b.product_id=p.product_id AND b.qty_on_hand>0 AND b.expiry_date>${today}),0)::text AS available
        FROM products p WHERE p.unit_price>=0 AND p.unit_price<'Infinity'::numeric
        AND (strpos(lower(coalesce(p.name,'')),lower($1))>0 OR strpos(lower(coalesce(p.generic_name,'')),lower($1))>0))
        SELECT (SELECT count(*)::int FROM found) AS total,
        coalesce((SELECT json_agg(r) FROM (SELECT * FROM found ORDER BY name,product_id LIMIT $2 OFFSET $3) r),'[]'::json) AS data`,
      [query.q, query.limit, (query.page-1)*query.limit]);
      return { ...result.rows[0], page: query.page, limit: query.limit };
    },
    async quote(client, data) {
      const snapshot = await reviewedSnapshot(client, data);
      return { ...snapshot.priced, business_date: snapshot.business_date, fingerprint: snapshot.fingerprint };
    },
    async checkout(client, actor, data, audit, expectedQuote) {
      const reference = 'POS-' + data.request_id.toLowerCase();
      // Existing transaction advisory lock serializes lookup/insert even though
      // the approved schema has no unique receipt_no constraint.
      const existing = (await client.query('SELECT sale_id,user_id FROM sales WHERE receipt_no=$1 FOR UPDATE', [reference])).rows;
      if (existing.length) {
        if (existing.length !== 1 || existing[0].user_id !== actor.user_id) fail(409);
        const stored = await receipt(existing[0].sale_id, actor, client);
        if(stored.financial?.version==='2')fail(409);
        const quantities = (await client.query(`SELECT b.product_id,sum(i.quantity)::text AS quantity FROM sale_items i
          JOIN batches b ON b.batch_id=i.batch_id WHERE sale_id=$1 GROUP BY b.product_id ORDER BY b.product_id`, [stored.sale_id])).rows;
        const expected = [...data.items].sort((a,b) => a.product_id-b.product_id).map(item => ({ product_id: item.product_id, quantity: String(item.quantity) }));
        const samePayment = (await client.query('SELECT count(*)=1 AND bool_and(amount_paid=$2::numeric) AS same FROM payments WHERE sale_id=$1', [stored.sale_id, data.amount_paid])).rows[0].same;
        if (!samePayment || JSON.stringify(quantities) !== JSON.stringify(expected)) fail(409);
        return { receipt: stored, replayed: true };
      }
      const closed = await closures(client, data.request_id);
      if (closed.length) fail(409, { checkoutClosed: closed.every(row => row.user_id === actor.user_id) });
      // Replay above deliberately precedes quote checks: an already committed
      // receipt remains recoverable after repricing, midnight, or an upgrade.
      if (!expectedQuote) fail(409, { correctable: true });
      const { priced, allocations, fingerprint } = await reviewedSnapshot(client, data);
      if (fingerprint !== expectedQuote) fail(409, { correctable: true });
      const cash = (await client.query('SELECT $1::numeric >= $2::numeric AS enough, round($1::numeric,2)::text AS paid, ($1::numeric-$2::numeric)::text AS change', [data.amount_paid, priced.total])).rows[0];
      if (!cash.enough) fail(422, { correctable: true });
      const sale = await insertWithId(client, `INSERT INTO sales(sale_id,user_id,receipt_no,sale_date,total_amount,approved_by,discount_id,senior_pwd_id,vat_exempt)
        VALUES($1,$2,$3,CURRENT_TIMESTAMP,$4,NULL,NULL,NULL,NULL) ON CONFLICT(sale_id) DO NOTHING RETURNING sale_id`,
      [actor.user_id, reference, priced.total]);
      for (const allocation of allocations) {
        const updated = await client.query(`UPDATE batches SET qty_on_hand=qty_on_hand-$2
          WHERE batch_id=$1 AND qty_on_hand>=$2 AND expiry_date>${today} RETURNING batch_id`, [allocation.batch_id, allocation.quantity]);
        if (!updated.rowCount) fail(409, { correctable: true });
        await insertWithId(client, 'INSERT INTO sale_items(sale_item_id,sale_id,batch_id,quantity,unit_price) VALUES($1,$2,$3,$4,$5) ON CONFLICT(sale_item_id) DO NOTHING RETURNING sale_item_id',
          [sale.sale_id, allocation.batch_id, allocation.quantity, allocation.unit_price]);
      }
      await insertWithId(client, "INSERT INTO payments(payment_id,sale_id,method,amount_paid,change_due) VALUES($1,$2,'cash',$3,$4) ON CONFLICT(payment_id) DO NOTHING RETURNING payment_id",
        [sale.sale_id, cash.paid, cash.change]);
      await audit(client, actor.user_id, `sale.paid:${sale.sale_id}`, 'POS');
      return { receipt: await receipt(sale.sale_id, actor, client), replayed: false };
    },
  };
}
