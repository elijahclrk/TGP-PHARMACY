-- DEFERRED: requires approval that operational rows cannot be incomplete drafts.
-- Depends on 002; no authorization to apply to public.
BEGIN;
SET LOCAL search_path = public;

ALTER TABLE batches
  ALTER COLUMN expiry_date SET NOT NULL,
  ALTER COLUMN qty_on_hand SET NOT NULL,
  ALTER COLUMN cost_price SET NOT NULL,
  ALTER COLUMN selling_price SET NOT NULL;

ALTER TABLE products
  ALTER COLUMN reorder_level SET NOT NULL,
  ALTER COLUMN unit_price SET NOT NULL;

ALTER TABLE purchase_order_items
  ALTER COLUMN quantity SET NOT NULL,
  ALTER COLUMN unit_cost SET NOT NULL;

ALTER TABLE stock_in_items
  ALTER COLUMN quantity SET NOT NULL,
  ALTER COLUMN unit_cost SET NOT NULL;

ALTER TABLE sale_items
  ALTER COLUMN quantity SET NOT NULL,
  ALTER COLUMN unit_price SET NOT NULL;

ALTER TABLE sale_returns
  ALTER COLUMN quantity SET NOT NULL;

ALTER TABLE stock_adjustments
  ALTER COLUMN quantity SET NOT NULL;

ALTER TABLE sales
  ALTER COLUMN total_amount SET NOT NULL;

ALTER TABLE payments
  ALTER COLUMN amount_paid SET NOT NULL,
  ALTER COLUMN change_due SET NOT NULL,
  ALTER COLUMN method SET NOT NULL;

COMMIT;
