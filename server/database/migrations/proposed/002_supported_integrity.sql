-- REVIEW DRAFT: not approved for execution. See ../../README.md.
BEGIN;
SET LOCAL search_path = public;

-- Finite nonnegative NUMERIC checks also exclude NaN and infinities.
-- No precision, scale, price defaults, or discount rates are introduced.
-- Lifecycle-dependent NOT NULL rules are deferred to deferred/005_complete_records.sql.
-- NULL values remain allowed for those fields; supplied values must pass checks.

ALTER TABLE stock_adjustments
  ALTER COLUMN reason SET NOT NULL;

ALTER TABLE activity_logs
  ALTER COLUMN action SET NOT NULL,
  ALTER COLUMN module SET NOT NULL,
  ALTER COLUMN logged_at SET NOT NULL;

ALTER TABLE purchase_order_items ADD CONSTRAINT purchase_order_items_quantity_positive_ck
  CHECK (quantity > 0);

ALTER TABLE stock_in_items ADD CONSTRAINT stock_in_items_quantity_positive_ck
  CHECK (quantity > 0);

ALTER TABLE sale_items ADD CONSTRAINT sale_items_quantity_positive_ck
  CHECK (quantity > 0);

ALTER TABLE sale_returns ADD CONSTRAINT sale_returns_quantity_positive_ck
  CHECK (quantity > 0);

ALTER TABLE batches ADD CONSTRAINT batches_stock_nonnegative_ck
  CHECK (qty_on_hand >= 0);

ALTER TABLE products ADD CONSTRAINT products_reorder_nonnegative_ck
  CHECK (reorder_level >= 0);

ALTER TABLE stock_adjustments ADD CONSTRAINT stock_adjustments_quantity_nonzero_ck
  CHECK (quantity <> 0);

ALTER TABLE stock_adjustments ADD CONSTRAINT stock_adjustments_reason_nonblank_ck
  CHECK (length(btrim(reason)) > 0);

ALTER TABLE activity_logs ADD CONSTRAINT activity_logs_action_nonblank_ck
  CHECK (length(btrim(action)) > 0);

ALTER TABLE activity_logs ADD CONSTRAINT activity_logs_module_nonblank_ck
  CHECK (length(btrim(module)) > 0);

ALTER TABLE products ADD CONSTRAINT products_unit_price_valid_ck
  CHECK (unit_price >= 0 AND unit_price < 'Infinity'::numeric);

ALTER TABLE batches ADD CONSTRAINT batches_cost_price_valid_ck
  CHECK (cost_price >= 0 AND cost_price < 'Infinity'::numeric);

ALTER TABLE batches ADD CONSTRAINT batches_selling_price_valid_ck
  CHECK (selling_price >= 0 AND selling_price < 'Infinity'::numeric);

ALTER TABLE purchase_order_items ADD CONSTRAINT purchase_order_items_unit_cost_valid_ck
  CHECK (unit_cost >= 0 AND unit_cost < 'Infinity'::numeric);

ALTER TABLE stock_in_items ADD CONSTRAINT stock_in_items_unit_cost_valid_ck
  CHECK (unit_cost >= 0 AND unit_cost < 'Infinity'::numeric);

ALTER TABLE sale_items ADD CONSTRAINT sale_items_unit_price_valid_ck
  CHECK (unit_price >= 0 AND unit_price < 'Infinity'::numeric);

ALTER TABLE sales ADD CONSTRAINT sales_total_amount_valid_ck
  CHECK (total_amount >= 0 AND total_amount < 'Infinity'::numeric);

ALTER TABLE payments ADD CONSTRAINT payments_amount_paid_valid_ck
  CHECK (amount_paid >= 0 AND amount_paid < 'Infinity'::numeric);

ALTER TABLE payments ADD CONSTRAINT payments_change_due_valid_ck
  CHECK (change_due >= 0 AND change_due < 'Infinity'::numeric);

ALTER TABLE payments ADD CONSTRAINT payments_cash_method_ck
  CHECK (method = 'cash');

ALTER TABLE payments ADD CONSTRAINT payments_change_within_tender_ck
  CHECK (change_due <= amount_paid);

COMMIT;
