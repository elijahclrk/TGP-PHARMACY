import { insertWithId } from './auth.repository.js';

const fail = status => { throw Object.assign(new Error('Purchasing request cannot be completed'), { status }); };
// Identifiers below are fixed application constants, never request data.
const types = {
  suppliers: { table: 'suppliers', key: 'supplier_id', search: 'name', projection: 't.*' },
  orders: { table: 'purchase_orders', key: 'po_id', search: 's.name', projection: 't.*,s.name AS supplier_name' },
  receiving: { table: 'stock_ins', key: 'stock_in_id', search: "s.name || ' ' || coalesce(t.delivery_ref,'')", projection: 't.*,s.name AS supplier_name' },
};
export function createPurchasingRepository(poolProvider) {
  async function detail(type, id, client = poolProvider()) {
    const { table, key, projection } = types[type];
    const join = type === 'suppliers' ? '' : 'JOIN suppliers s ON s.supplier_id=t.supplier_id';
    const record = (await client.query(`SELECT ${projection} FROM ${table} t ${join} WHERE t.${key}=$1`, [id])).rows[0];
    if (!record) fail(404);
    if (type === 'orders') record.items = (await client.query(`SELECT i.po_item_id,i.product_id,p.name AS product_name,i.quantity,i.unit_cost::text
      FROM purchase_order_items i JOIN products p ON p.product_id=i.product_id WHERE i.po_id=$1 ORDER BY i.po_item_id`, [id])).rows;
    if (type === 'receiving') record.items = (await client.query(`SELECT i.item_id,i.batch_id,i.quantity,i.unit_cost::text,b.product_id,p.name AS product_name,
      b.batch_no,to_char(b.expiry_date,'YYYY-MM-DD') AS expiry_date,b.selling_price::text,b.qty_on_hand
      FROM stock_in_items i JOIN batches b ON b.batch_id=i.batch_id JOIN products p ON p.product_id=b.product_id
      WHERE i.stock_in_id=$1 ORDER BY i.item_id`, [id])).rows;
    if (type !== 'suppliers') record.history = (await client.query(`SELECT l.user_id,u.username,l.action,l.logged_at FROM activity_logs l
      JOIN users u ON u.user_id=l.user_id WHERE l.module=$1 AND l.action IN ($2,$3) ORDER BY l.logged_at,l.log_id`,
    [type === 'orders' ? 'purchase_orders' : 'stock_in', `${type}.created:${id}`, `${type}.approved:${id}`])).rows;
    return record;
  }
  return {
    detail,
    async list(type, query) {
      const { table, key, search, projection } = types[type];
      const join = type === 'suppliers' ? '' : 'JOIN suppliers s ON s.supplier_id=t.supplier_id';
      const result = await poolProvider().query(`WITH filtered AS (SELECT ${projection} FROM ${table} t ${join}
        WHERE strpos(lower(${search}),lower($1))>0)
        SELECT (SELECT count(*)::int FROM filtered) AS total,
        coalesce((SELECT json_agg(r) FROM (SELECT * FROM filtered ORDER BY ${key} DESC LIMIT $2 OFFSET $3) r),'[]'::json) AS data`,
      [query.q, query.limit, (query.page - 1) * query.limit]);
      return { ...result.rows[0], page: query.page, limit: query.limit };
    },
    createSupplier: (client, data) => insertWithId(client,
      'INSERT INTO suppliers(supplier_id,name,contact_no,address) VALUES($1,$2,$3,$4) ON CONFLICT(supplier_id) DO NOTHING RETURNING *',
      [data.name, data.contact_no ?? null, data.address ?? null]),
    async editSupplier(client, id, data) {
      const fields = ['name', 'contact_no', 'address'].filter(field => Object.hasOwn(data, field));
      const row = (await client.query(`UPDATE suppliers SET ${fields.map((field, i) => `${field}=$${i + 2}`).join(',')}
        WHERE supplier_id=$1 RETURNING *`, [id, ...fields.map(field => data[field])])).rows[0];
      if (!row) fail(404);
      return row;
    },
    async createDocument(client, type, actor, data) {
      if (!(await client.query('SELECT supplier_id FROM suppliers WHERE supplier_id=$1 FOR KEY SHARE', [data.supplier_id])).rowCount) fail(404);
      const productIds = [...new Set(data.items.map(item => item.product_id))].sort((a,b) => a-b);
      const products = await client.query('SELECT product_id FROM products WHERE product_id=ANY($1::int[]) ORDER BY product_id FOR KEY SHARE', [productIds]);
      if (products.rowCount !== productIds.length) fail(404);
      const order = type === 'orders';
      const record = order ? await insertWithId(client,
        "INSERT INTO purchase_orders(po_id,supplier_id,created_by,order_date,status) VALUES($1,$2,$3,CURRENT_TIMESTAMP,'pending') ON CONFLICT(po_id) DO NOTHING RETURNING *", [data.supplier_id, actor])
        : await insertWithId(client,
          'INSERT INTO stock_ins(stock_in_id,supplier_id,received_by,delivery_ref,date_received) VALUES($1,$2,$3,$4,CURRENT_TIMESTAMP) ON CONFLICT(stock_in_id) DO NOTHING RETURNING *', [data.supplier_id, actor, data.delivery_ref]);
      for (const item of data.items) {
        if (order) await insertWithId(client,
          'INSERT INTO purchase_order_items(po_item_id,po_id,product_id,quantity,unit_cost) VALUES($1,$2,$3,$4,$5) ON CONFLICT(po_item_id) DO NOTHING RETURNING po_item_id',
          [record.po_id, item.product_id, item.quantity, item.unit_cost]);
        else {
          const batch = await insertWithId(client,
            `INSERT INTO batches(batch_id,product_id,batch_no,expiry_date,qty_on_hand,cost_price,selling_price)
            VALUES($1,$2,$3,$4,0,$5,$6) ON CONFLICT(batch_id) DO NOTHING RETURNING batch_id`,
            [item.product_id, item.batch_no, item.expiry_date, item.cost_price, item.selling_price]);
          await insertWithId(client,
            'INSERT INTO stock_in_items(item_id,stock_in_id,batch_id,quantity,unit_cost) VALUES($1,$2,$3,$4,$5) ON CONFLICT(item_id) DO NOTHING RETURNING item_id',
            [record.stock_in_id, batch.batch_id, item.quantity, item.cost_price]);
        }
      }
      return record;
    },
    async approve(client, type, id, actor) {
      const { table, key } = types[type];
      const current = (await client.query(`SELECT * FROM ${table} WHERE ${key}=$1 FOR UPDATE`, [id])).rows[0];
      if (!current) fail(404);
      if (current.approved_by !== null || (type === 'orders' && current.status !== 'pending')) fail(409);
      if (type === 'receiving') {
        const items = (await client.query('SELECT * FROM stock_in_items WHERE stock_in_id=$1 ORDER BY batch_id,item_id FOR UPDATE', [id])).rows;
        if (!items.length || items.some(item => !Number.isInteger(item.quantity) || item.quantity <= 0)) fail(409);
        const ids = [...new Set(items.map(item => item.batch_id))];
        await client.query('SELECT batch_id FROM batches WHERE batch_id=ANY($1::int[]) ORDER BY batch_id FOR UPDATE', [ids]);
        for (const item of items) {
          const result = await client.query(`UPDATE batches SET qty_on_hand=qty_on_hand+$2
            WHERE batch_id=$1 AND qty_on_hand IS NOT NULL AND qty_on_hand>=0 AND qty_on_hand<=2147483647-$2
            AND cost_price=$3::numeric RETURNING batch_id`, [item.batch_id, item.quantity, item.unit_cost]);
          if (!result.rowCount) fail(409);
        }
      }
      const result = await client.query(`UPDATE ${table} SET approved_by=$2${type === 'orders' ? ",status='approved'" : ''}
        WHERE ${key}=$1 AND approved_by IS NULL RETURNING *`, [id, actor]);
      if (!result.rowCount) fail(409);
      return result.rows[0];
    },
  };
}
