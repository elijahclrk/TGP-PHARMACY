import { insertWithId } from './auth.repository.js';
import { businessTodaySql, nearExpiryThroughSql } from '../services/expiry-policy.js';

const today = businessTodaySql;
const aggregates = `SELECT p.product_id,p.name,p.generic_name,p.category,p.unit_price::text AS unit_price,p.reorder_level,to_jsonb(p)->>'strength_dosage' AS strength_dosage,
  count(b.batch_id)::int AS batch_count,
  CASE WHEN count(b.batch_id) FILTER(WHERE b.qty_on_hand IS NULL)>0 THEN NULL
    ELSE coalesce(sum(b.qty_on_hand),0)::text END AS qty_on_hand,
  CASE WHEN count(b.batch_id) FILTER(WHERE b.qty_on_hand IS NULL OR (b.qty_on_hand>0 AND b.expiry_date IS NULL))>0 THEN NULL
    ELSE coalesce(sum(b.qty_on_hand) FILTER(WHERE b.expiry_date>${today}),0)::text END AS within_date_qty,
  CASE WHEN count(b.batch_id) FILTER(WHERE b.qty_on_hand IS NULL)>0 THEN NULL
    ELSE coalesce(sum(b.qty_on_hand) FILTER(WHERE b.expiry_date<=${today}),0)::text END AS expired_or_today_qty,
  CASE WHEN count(b.batch_id) FILTER(WHERE b.qty_on_hand IS NULL)>0 OR p.reorder_level IS NULL THEN NULL
    ELSE coalesce(sum(b.qty_on_hand),0)<=p.reorder_level END AS low_stock
  FROM products p LEFT JOIN batches b ON b.product_id=p.product_id GROUP BY p.product_id`;
const missing = () => Object.assign(new Error('Record not found'), { status: 404 });

export function createInventoryRepository(poolProvider) {
  const pagination = (query, values, cte, order) => poolProvider().query(
    `WITH filtered AS (${cte}) SELECT (SELECT count(*)::int FROM filtered) AS total,
      to_char(${today},'YYYY-MM-DD') AS business_date,
      to_char(${nearExpiryThroughSql},'YYYY-MM-DD') AS near_expiry_through,
      coalesce((SELECT json_agg(page_rows) FROM (SELECT * FROM filtered ORDER BY ${order}
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}) page_rows),'[]'::json) AS data`,
    [...values, query.limit, (query.page - 1) * query.limit]).then(result => ({ ...result.rows[0], page: query.page, limit: query.limit }));
  return {
    products(query) {
      return pagination(query, [query.q, query.category, query.stock],
        `SELECT * FROM (${aggregates}) inventory WHERE
        ($1='' OR strpos(lower(coalesce(name,'')),lower($1))>0 OR strpos(lower(coalesce(generic_name,'')),lower($1))>0)
        AND ($2='' OR category=$2) AND ($3='all' OR low_stock IS TRUE)`, 'lower(name) NULLS LAST, product_id');
    },
    async product(id) {
      return (await poolProvider().query(`SELECT * FROM (${aggregates}) inventory WHERE product_id=$1`, [id])).rows[0];
    },
    batches(query, includeCost) {
      // Cost projection is chosen by the authenticated server-side role only.
      return pagination(query, [query.q, query.product_id ?? null, query.status],
        `SELECT b.batch_id,b.product_id,p.name AS product_name,p.generic_name,p.category,b.batch_no,
          to_char(b.expiry_date,'YYYY-MM-DD') AS expiry_date,b.qty_on_hand,b.selling_price::text AS selling_price,
          b.expiry_date-${today} AS days_to_expiry,
          CASE WHEN b.expiry_date IS NULL THEN 'unknown' WHEN b.expiry_date<${today} THEN 'expired'
            WHEN b.expiry_date=${today} THEN 'expiring_today'
            WHEN b.expiry_date<=${nearExpiryThroughSql} THEN 'near_expiry' ELSE 'within_date' END AS expiry_status${includeCost ? ',b.cost_price::text AS cost_price' : ''}
        FROM batches b JOIN products p ON p.product_id=b.product_id
        WHERE ($1='' OR strpos(lower(coalesce(p.name,'')),lower($1))>0
          OR strpos(lower(coalesce(p.generic_name,'')),lower($1))>0 OR strpos(lower(coalesce(b.batch_no,'')),lower($1))>0)
          AND ($2::integer IS NULL OR b.product_id=$2)
          AND ($3='all' OR ($3='near_expiry' AND b.qty_on_hand>0 AND b.expiry_date>${today} AND b.expiry_date<=${nearExpiryThroughSql})
            OR ($3='expiring_today' AND b.qty_on_hand>0 AND b.expiry_date=${today})
            OR ($3='expired' AND b.qty_on_hand>0 AND b.expiry_date<${today}))`, 'expiry_date NULLS LAST, batch_id');
    },
    insertProduct: (client, data) => insertWithId(client,
      `INSERT INTO products(product_id,name,generic_name,category,unit_price,reorder_level${Object.hasOwn(data,'strength_dosage')?',strength_dosage':''}) VALUES($1,$2,$3,$4,$5,$6${Object.hasOwn(data,'strength_dosage')?',$7':''}) ON CONFLICT(product_id) DO NOTHING RETURNING product_id,name,generic_name,category,unit_price::text,reorder_level`,
      [data.name, data.generic_name ?? null, data.category ?? null, data.unit_price, data.reorder_level ?? null,...(Object.hasOwn(data,'strength_dosage')?[data.strength_dosage]:[])]),
    async editProduct(client, id, data) {
      const allowed = ['name', 'generic_name', 'category', 'unit_price', 'reorder_level','strength_dosage'];
      const fields = allowed.filter(key => Object.hasOwn(data, key));
      const result = await client.query(`UPDATE products SET ${fields.map((key, i) => key + '=$' + (i + 2)).join(',')}
        WHERE product_id=$1 RETURNING product_id,name,generic_name,category,unit_price::text,reorder_level`, [id, ...fields.map(key => data[key])]);
      if (!result.rows[0]) throw missing();
      return result.rows[0];
    },
    async insertBatch(client, productId, data) {
      if (!(await client.query('SELECT product_id FROM products WHERE product_id=$1 FOR UPDATE', [productId])).rowCount) throw missing();
      return insertWithId(client,
        `INSERT INTO batches(batch_id,product_id,batch_no,expiry_date,qty_on_hand,cost_price,selling_price)
         VALUES($1,$2,$3,$4,0,$5,$6) ON CONFLICT(batch_id) DO NOTHING
         RETURNING batch_id,product_id,batch_no,to_char(expiry_date,'YYYY-MM-DD') AS expiry_date,qty_on_hand,cost_price::text,selling_price::text`,
        [productId, data.batch_no, data.expiry_date, data.cost_price, data.selling_price]);
    },
    async editBatch(client, id, data) {
      const current = (await client.query('SELECT batch_id,product_id,cost_price FROM batches WHERE batch_id=$1 FOR UPDATE', [id])).rows[0];
      if (!current) throw missing();
      // Receiving history stores batch identity through this foreign key.
      // Preserve that identity once referenced; selling price remains editable.
      if (Object.hasOwn(data, 'batch_no') || Object.hasOwn(data, 'expiry_date')) {
        const locked = (await client.query(`SELECT EXISTS(SELECT 1 FROM stock_in_items WHERE batch_id=$1)
          AND (($2::boolean AND batch_no IS DISTINCT FROM $3::varchar)
          OR ($4::boolean AND expiry_date IS DISTINCT FROM $5::date)) AS locked
          FROM batches WHERE batch_id=$1`, [id, Object.hasOwn(data, 'batch_no'), data.batch_no ?? null,
          Object.hasOwn(data, 'expiry_date'), data.expiry_date ?? null])).rows[0].locked;
        if (locked) throw Object.assign(new Error('Receiving batch identity is locked'), { status: 409 });
      }
      // Existing profit calculations use batch cost. A used batch cost cannot
      // be rewritten through this metadata endpoint.
      if (Object.hasOwn(data, 'cost_price')) {
        const referenced = (await client.query(`SELECT
          EXISTS(SELECT 1 FROM sale_items WHERE batch_id=$1) OR
          EXISTS(SELECT 1 FROM stock_in_items WHERE batch_id=$1) AS used`, [id])).rows[0].used;
        const changed = (await client.query('SELECT $1::numeric IS DISTINCT FROM $2::numeric AS changed', [current.cost_price, data.cost_price])).rows[0].changed;
        if (referenced && changed) throw Object.assign(new Error('Recorded batch cost is locked'), { status: 409 });
      }
      const fields = ['batch_no', 'expiry_date', 'cost_price', 'selling_price'].filter(key => Object.hasOwn(data, key));
      return (await client.query(`UPDATE batches SET ${fields.map((key, i) => key + '=$' + (i + 2)).join(',')}
        WHERE batch_id=$1 RETURNING batch_id,product_id,batch_no,to_char(expiry_date,'YYYY-MM-DD') AS expiry_date,qty_on_hand,cost_price::text,selling_price::text`,
      [id, ...fields.map(key => data[key])])).rows[0];
    },
  };
}
