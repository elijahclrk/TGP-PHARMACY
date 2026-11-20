-- REVIEW DRAFT: not approved for execution. See ../../README.md.
BEGIN;
SET LOCAL search_path = public;

-- Independent of 003 for correctness; covers 23 baseline FK columns.
-- sale_returns.sale_id lookup is supplied by the composite index in 003.
-- If 003 is deferred, that lookup has no dedicated index; correctness is unchanged.
-- Regular CREATE INDEX is intentional for initial empty-table setup.

CREATE INDEX activity_logs_user_id_idx ON activity_logs (user_id);
CREATE INDEX batches_product_id_idx ON batches (product_id);
CREATE INDEX purchase_orders_supplier_id_idx ON purchase_orders (supplier_id);
CREATE INDEX purchase_orders_created_by_idx ON purchase_orders (created_by);
CREATE INDEX purchase_orders_approved_by_idx ON purchase_orders (approved_by);
CREATE INDEX purchase_order_items_po_id_idx ON purchase_order_items (po_id);
CREATE INDEX purchase_order_items_product_id_idx ON purchase_order_items (product_id);
CREATE INDEX stock_ins_supplier_id_idx ON stock_ins (supplier_id);
CREATE INDEX stock_ins_received_by_idx ON stock_ins (received_by);
CREATE INDEX stock_ins_approved_by_idx ON stock_ins (approved_by);
CREATE INDEX stock_in_items_stock_in_id_idx ON stock_in_items (stock_in_id);
CREATE INDEX stock_in_items_batch_id_idx ON stock_in_items (batch_id);
CREATE INDEX sales_user_id_idx ON sales (user_id);
CREATE INDEX sales_discount_id_idx ON sales (discount_id);
CREATE INDEX sales_approved_by_idx ON sales (approved_by);
CREATE INDEX sale_items_sale_id_idx ON sale_items (sale_id);
CREATE INDEX sale_items_batch_id_idx ON sale_items (batch_id);
CREATE INDEX payments_sale_id_idx ON payments (sale_id);
CREATE INDEX stock_adjustments_batch_id_idx ON stock_adjustments (batch_id);
CREATE INDEX stock_adjustments_adjusted_by_idx ON stock_adjustments (adjusted_by);
CREATE INDEX stock_adjustments_approved_by_idx ON stock_adjustments (approved_by);
CREATE INDEX sale_returns_processed_by_idx ON sale_returns (processed_by);
CREATE INDEX sale_returns_approved_by_idx ON sale_returns (approved_by);

CREATE INDEX batches_fefo_available_idx
  ON batches (product_id, expiry_date, batch_id)
  WHERE qty_on_hand > 0;

-- The separate batches.product_id index also covers zero-stock rows.
-- FEFO index does not enforce approval eligibility, expiry policy or locking.
COMMIT;
