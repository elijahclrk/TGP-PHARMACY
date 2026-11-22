// Existing sale_date is TIMESTAMP WITHOUT TIME ZONE, written under the verified
// UTC/GMT database session. Interpret explicitly; never depend on process TZ.
const manila = "s.sale_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila'";
// Owner-confirmed: completed normal cash sales need no manual approval.
// approved_by is optional historical review metadata, never recognition state.
// Returns do not constitute a cash refund, credit or revenue reversal. Recognize
// reconciled completed sales regardless of return request/acceptance state.
// Only supported immutable v2 benefit snapshots join the regular cash cohort.
const cohort = `WITH ranged AS (
  SELECT s.*,(${manila}) AS local_time FROM sales s
  WHERE s.sale_date >= ($1::date::timestamp AT TIME ZONE 'Asia/Manila' AT TIME ZONE 'UTC')
    AND s.sale_date < (($2::date+1)::timestamp AT TIME ZONE 'Asia/Manila' AT TIME ZONE 'UTC')
), checked AS (
  SELECT s.*,coalesce(s.total_amount>=0 AND s.total_amount<'Infinity'::numeric
    AND ((s.discount_id IS NULL AND s.senior_pwd_id IS NULL AND s.vat_exempt IS NOT TRUE AND coalesce(to_jsonb(s)->>'financial_snapshot_version','')='')
     OR (to_jsonb(s)->>'financial_snapshot_version'='2' AND to_jsonb(s)->>'benefit_type' IN ('senior','pwd')
      AND s.discount_id IS NOT NULL AND length(btrim(s.senior_pwd_id))>0 AND to_jsonb(s)->>'benefit_request_digest' IS NOT NULL))
    AND p.n=1 AND p.valid AND p.net=s.total_amount
    AND l.n>0 AND l.valid AND l.amount=s.total_amount
    AND EXISTS(SELECT 1 FROM activity_logs a WHERE a.module='POS' AND a.action='sale.paid:'||s.sale_id AND a.user_id=s.user_id),false) AS qualifies
  FROM ranged s
  CROSS JOIN LATERAL (SELECT count(*) AS n,
    bool_and(method='cash' AND amount_paid IS NOT NULL AND change_due IS NOT NULL
      AND amount_paid>=0 AND amount_paid<'Infinity'::numeric AND change_due>=0 AND change_due<=amount_paid) AS valid,
    sum(amount_paid-change_due) AS net FROM payments WHERE sale_id=s.sale_id) p
  CROSS JOIN LATERAL (SELECT count(*) AS n,
    bool_and(quantity IS NOT NULL AND quantity>0 AND unit_price IS NOT NULL AND unit_price>=0 AND unit_price<'Infinity'::numeric) AS valid,
    sum(CASE WHEN to_jsonb(sale_items)->>'financial_snapshot_version'='2' THEN (to_jsonb(sale_items)->>'net_line_amount')::numeric ELSE quantity*unit_price END) AS amount FROM sale_items WHERE sale_id=s.sale_id) l
), eligible AS (SELECT * FROM checked WHERE qualifies)`;
const lineRevenue = `(CASE WHEN to_jsonb(i)->>'financial_snapshot_version'='2' THEN (to_jsonb(i)->>'net_line_amount')::numeric ELSE i.quantity*i.unit_price END)`;
const verifiedCost = `b.cost_price IS NOT NULL AND b.cost_price>=0 AND b.cost_price<'Infinity'::numeric
  AND EXISTS(SELECT 1 FROM stock_in_items ri JOIN stock_ins r ON r.stock_in_id=ri.stock_in_id
    WHERE ri.batch_id=b.batch_id AND r.approved_by IS NOT NULL AND ri.quantity>0 AND ri.unit_cost=b.cost_price)
  AND NOT EXISTS(SELECT 1 FROM stock_in_items ri JOIN stock_ins r ON r.stock_in_id=ri.stock_in_id
    WHERE ri.batch_id=b.batch_id AND r.approved_by IS NOT NULL AND ri.unit_cost IS DISTINCT FROM b.cost_price)`;
const coverage = `(SELECT count(*)::int FROM checked WHERE NOT qualifies)`;
export function createReportsRepository(poolProvider) {
  return {
    async detail(kind,query) {
      const ranking=['best-selling','slow-moving'].includes(kind);
      const performance=ranking?`, product_units AS (
        SELECT p.product_id,p.name,p.category AS current_category,coalesce(x.units,0) AS units,
          round(coalesce(x.amount,0),2)::text AS sales_amount FROM products p LEFT JOIN (
          SELECT b.product_id,sum(i.quantity) AS units,sum(${lineRevenue}) AS amount FROM eligible s
          JOIN sale_items i ON i.sale_id=s.sale_id JOIN batches b ON b.batch_id=i.batch_id GROUP BY b.product_id)x USING(product_id)
      ), ranked_products AS (
        SELECT *,dense_rank() OVER(PARTITION BY current_category ORDER BY units DESC)::int AS best_rank,
          dense_rank() OVER(PARTITION BY current_category ORDER BY units ASC)::int AS slow_rank FROM product_units
      )`:'';
      const statements={
        transactions:`SELECT s.sale_id,s.receipt_no,to_char(s.local_time,'YYYY-MM-DD HH24:MI:SS') AS business_time,u.username AS cashier,
          (SELECT count(DISTINCT b.product_id)::int FROM sale_items i JOIN batches b USING(batch_id) WHERE i.sale_id=s.sale_id) AS item_count,
          round(s.total_amount,2)::text AS sales_amount,round(p.amount_paid,2)::text AS cash_tendered,round(p.change_due,2)::text AS change_due,
          (SELECT count(*)::int FROM sale_returns r WHERE r.sale_id=s.sale_id) AS return_requests,
          to_jsonb(s)->>'benefit_type' AS benefit_type,to_jsonb(s)->>'gross_amount' AS gross_amount,
          to_jsonb(s)->>'discount_amount' AS discount_amount,to_jsonb(s)->>'vat_removed_amount' AS vat_removed_amount,
          to_jsonb(s)->>'vat_amount' AS vat_amount
          FROM eligible s JOIN users u ON u.user_id=s.user_id JOIN payments p ON p.sale_id=s.sale_id
          WHERE ($3='' OR strpos(lower(s.receipt_no),lower($3))>0) ORDER BY s.local_time,s.sale_id`,
        categories:`SELECT p.category AS current_category,sum(i.quantity)::text AS units,count(DISTINCT s.sale_id)::int AS transactions,
          round(sum(${lineRevenue}),2)::text AS sales_amount FROM eligible s JOIN sale_items i ON i.sale_id=s.sale_id
          JOIN batches b ON b.batch_id=i.batch_id JOIN products p ON p.product_id=b.product_id GROUP BY p.category ORDER BY p.category NULLS LAST`,
        'best-selling':`SELECT product_id,name,current_category,units::text,sales_amount,best_rank AS category_rank FROM ranked_products
          WHERE units>0 AND ($3='' OR current_category=$3) ORDER BY current_category NULLS LAST,best_rank,name,product_id`,
        'slow-moving':`SELECT product_id,name,current_category,units::text,sales_amount,slow_rank AS category_rank FROM ranked_products
          WHERE units<=$3 AND ($4='' OR current_category=$4) ORDER BY current_category NULLS LAST,slow_rank,name,product_id`,
        returns:`SELECT r.return_id,s.receipt_no,r.quantity,
          coalesce(to_jsonb(r)->>'received_quantity','unknown') AS received_quantity,
          coalesce(to_jsonb(r)->>'decision_state','legacy_unclassified') AS decision_state,
          to_char(r.return_date,'YYYY-MM-DD') AS recorded_time
          FROM sale_returns r JOIN sales s ON s.sale_id=r.sale_id
          WHERE r.return_date>=$1::date AND r.return_date<=$2::date ORDER BY r.return_id`,
      };
      if(!Object.hasOwn(statements,kind))throw new Error('Unsupported report');
      const values=[query.from,query.to,...(kind==='transactions'?[query.receipt??'']:kind==='slow-moving'?[query.max_units,query.category??'']:kind==='best-selling'?[query.category??'']:[])];
      // One statement gives rows and reconciliation coverage a consistent snapshot.
      const result=await poolProvider().query(`${cohort}${performance}, details AS (${statements[kind]})
        SELECT coalesce((SELECT json_agg(d) FROM (SELECT * FROM details LIMIT 10001)d),'[]'::json) AS data,
        (SELECT count(*)::int FROM details) AS total,${coverage} AS excluded_records`,values);
      if(result.rows[0].total>10000){const error=new Error('Report exceeds 10,000 rows. Narrow the date range.');error.status=422;throw error;}
      return result.rows[0];
    },
    async sales(query) {
      const result = await poolProvider().query(`${cohort}, periods AS (
        SELECT to_char(date_trunc($3::text,local_time),'YYYY-MM-DD') AS period_start,
          count(*)::int AS transactions,count(*) FILTER(WHERE approved_by IS NOT NULL)::int AS reviewed,
          count(*) FILTER(WHERE approved_by IS NULL)::int AS unreviewed,
          round(sum(total_amount),2)::text AS sales_amount
        FROM eligible GROUP BY date_trunc($3::text,local_time)
      ) SELECT coalesce((SELECT json_agg(p ORDER BY period_start) FROM periods p),'[]'::json) AS data,
        (SELECT count(*)::int FROM eligible) AS transactions,
        (SELECT count(*)::int FROM eligible WHERE approved_by IS NOT NULL) AS reviewed,
        (SELECT count(*)::int FROM eligible WHERE approved_by IS NULL) AS unreviewed,
        (SELECT round(coalesce(sum(total_amount),0),2)::text FROM eligible) AS sales_amount,
        ${coverage} AS excluded_records`, [query.from,query.to,query.period]);
      return result.rows[0];
    },
    async products(query) {
      const result = await poolProvider().query(`${cohort}, totals AS (
        SELECT p.product_id,p.name,p.category,sum(i.quantity)::text AS units,
          round(sum(${lineRevenue}),2)::text AS sales_amount,
          count(DISTINCT s.sale_id)::int AS transactions
        FROM eligible s JOIN sale_items i ON i.sale_id=s.sale_id JOIN batches b ON b.batch_id=i.batch_id
        JOIN products p ON p.product_id=b.product_id GROUP BY p.product_id
      ) SELECT (SELECT count(*)::int FROM totals) AS total,${coverage} AS excluded_records,
        coalesce((SELECT json_agg(r) FROM (SELECT * FROM totals ORDER BY units::numeric DESC,product_id LIMIT $3 OFFSET $4) r),'[]'::json) AS data`,
      [query.from,query.to,query.limit,(query.page-1)*query.limit]);
      return {...result.rows[0],page:query.page,limit:query.limit};
    },
    async profit(query) {
      const result=await poolProvider().query(`${cohort}, lines AS (
        SELECT ${lineRevenue} AS revenue,i.quantity*b.cost_price AS cost,(${verifiedCost} AND coalesce(to_jsonb(s)->>'financial_snapshot_version','')<>'2') AS verified
        FROM eligible s JOIN sale_items i ON i.sale_id=s.sale_id JOIN batches b ON b.batch_id=i.batch_id
      ), sums AS (SELECT coalesce(sum(revenue),0) AS revenue,coalesce(sum(cost) FILTER(WHERE verified),0) AS cost,
        count(*) FILTER(WHERE NOT verified)::int AS unverified_lines,count(*)::int AS lines FROM lines)
      SELECT round(revenue,2)::text AS sales_amount,
        CASE WHEN unverified_lines=0 THEN round(cost,2)::text END AS cost_amount,
        CASE WHEN unverified_lines=0 THEN round(revenue-cost,2)::text END AS gross_profit,
        CASE WHEN unverified_lines=0 AND revenue<>0 THEN round((revenue-cost)/revenue*100,2)::text END AS gross_margin_percent,
        unverified_lines,lines,${coverage} AS excluded_records FROM sums`,[query.from,query.to]);
      return result.rows[0];
    },
    async valuation() {
      const result=await poolProvider().query(`WITH classified AS (
        SELECT b.*,CASE WHEN expiry_date IS NULL THEN 'unknown_expiry'
          WHEN expiry_date<=(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date THEN 'expired_or_today'
          ELSE 'future_expiry' END AS expiry_group,
          coalesce(qty_on_hand>=0 AND (qty_on_hand=0 OR (${verifiedCost})),false) AS verified
        FROM batches b
      ), groups AS (
        SELECT expiry_group,count(*)::int AS batches,
          count(*) FILTER(WHERE NOT verified)::int AS unverified_batches,
          CASE WHEN bool_and(verified) THEN round(sum(CASE WHEN qty_on_hand=0 THEN 0 ELSE qty_on_hand*cost_price END),2)::text END AS cost_value
        FROM classified GROUP BY expiry_group
      ) SELECT coalesce((SELECT json_agg(g ORDER BY expiry_group) FROM groups g),'[]'::json) AS data,
        count(*)::int AS batches,count(*) FILTER(WHERE NOT verified)::int AS unverified_batches,
        CASE WHEN count(*) FILTER(WHERE NOT verified)=0 THEN round(coalesce(sum(CASE WHEN qty_on_hand=0 THEN 0 ELSE qty_on_hand*cost_price END),0),2)::text END AS cost_value
        FROM classified`);
      return result.rows[0];
    },
  };
}
