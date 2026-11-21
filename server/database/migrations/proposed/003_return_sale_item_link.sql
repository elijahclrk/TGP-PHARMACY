-- REVIEW DRAFT: not approved for execution. See ../../README.md.
BEGIN;
SET LOCAL search_path = public;

-- Structural amendment: one return row refers to one original sale line.
-- Only safe for initial setup with an EMPTY sale_returns table.
-- Do not guess or automatically backfill historical return mappings.
DO $migration$
BEGIN
  IF EXISTS (SELECT 1 FROM sale_returns) THEN
    RAISE EXCEPTION 'Return linkage requires an empty returns table or a separately reviewed backfill migration.';
  END IF;
END
$migration$;

ALTER TABLE sale_items
  ADD CONSTRAINT sale_items_sale_item_pair_uq UNIQUE (sale_id, sale_item_id);

ALTER TABLE sale_returns
  ADD COLUMN sale_item_id INTEGER NOT NULL,
  ADD CONSTRAINT sale_returns_original_item_fk
    FOREIGN KEY (sale_id, sale_item_id)
    REFERENCES sale_items (sale_id, sale_item_id);

CREATE INDEX sale_returns_original_item_idx
  ON sale_returns (sale_id, sale_item_id);

-- Existing sale_id FK and all primary keys remain unchanged.
-- 008 adds lifecycle/approved-quantity guards; 003 alone must never activate
-- returns. The composite FK identifies the sold batch through sale_items.
-- Lock/write cutover required: an old return writer cannot supply this linkage.
COMMIT;
