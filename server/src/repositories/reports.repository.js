// Existing sale_date is TIMESTAMP WITHOUT TIME ZONE, written under the verified
// UTC/GMT database session. Interpret explicitly; never depend on process TZ.
const manila = "s.sale_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila'";
const cohort = `WITH ranged AS (
  SELECT s.*,(${manila}) AS local_time FROM sales s
  WHERE s.sale_date >= ($1::date::timestamp AT TIME ZONE 'Asia/Manila' AT TIME ZONE 'UTC')
    AND s.sale_date < (($2::date+1)::timestamp AT TIME ZONE 'Asia/Manila' AT TIME ZONE 'UTC')
), checked AS (
  SELECT s.*,coalesce(s.total_amount>=0 AND s.total_amount<'Infinity'::numeric
    AND s.discount_id IS NULL AND s.senior_pwd_id IS NULL AND s.vat_exempt IS NOT TRUE
    AND p.n=1 AND p.valid AND p.net=s.total_amount
    AND l.n>0 AND l.valid AND l.amount=s.total_amount
    AND EXISTS(SELECT 1 FROM activity_logs a WHERE a.module='POS' AND a.action='sale.paid:'||s.sale_id AND a.user_id=s.user_id)
    AND NOT EXISTS(SELECT 1 FROM sale_returns r WHERE r.sale_id=s.sale_id),false) AS qualifies
  FROM ranged s
  CROSS JOIN LATERAL (SELECT count(*) AS n,
    bool_and(method='cash' AND amount_paid IS NOT NULL AND change_due IS NOT NULL
      AND amount_paid>=0 AND amount_paid<'Infinity'::numeric AND change_due>=0 AND change_due<=amount_paid) AS valid,
    sum(amount_paid-change_due) AS net FROM payments WHERE sale_id=s.sale_id) p
  CROSS JOIN LATERAL (SELECT count(*) AS n,
    bool_and(quantity IS NOT NULL AND quantity>0 AND unit_price IS NOT NULL AND unit_price>=0 AND unit_price<'Infinity'::numeric) AS valid,
    sum(quantity*unit_price) AS amount FROM sale_items WHERE sale_id=s.sale_id) l
), eligible AS (SELECT * FROM checked WHERE qualifies)`;
const verifiedCost = `b.cost_price IS NOT NULL AND b.cost_price>=0 AND b.cost_price<'Infinity'::numeric
  AND EXISTS(SELECT 1 FROM stock_in_items ri JOIN stock_ins r ON r.stock_in_id=ri.stock_in_id
    WHERE ri.batch_id=b.batch_id AND r.approved_by IS NOT NULL AND ri.quantity>0 AND ri.unit_cost=b.cost_price)
  AND NOT EXISTS(SELECT 1 FROM stock_in_items ri JOIN stock_ins r ON r.stock_in_id=ri.stock_in_id
    WHERE ri.batch_id=b.batch_id AND r.approved_by IS NOT NULL AND ri.unit_cost IS DISTINCT FROM b.cost_price)`;
const coverage = `(SELECT count(*)::int FROM checked WHERE NOT qualifies)`;
export function createReportsRepository(poolProvider) {
  return {
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
          round(sum(i.quantity*i.unit_price),2)::text AS sales_amount,
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
        SELECT i.quantity*i.unit_price AS revenue,i.quantity*b.cost_price AS cost,(${verifiedCost}) AS verified
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
