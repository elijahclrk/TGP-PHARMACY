-- Project-owner-approved feature; LIVE EXECUTION REQUIRES SEPARATE CONFIRMATION.
-- New additive migration only. Do not edit 001/002/004 or enable 003/005.
-- Execute and record this file's SHA-256 in migration history in the same
-- reviewed transaction. Existing initialization runners do NOT support 006.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL search_path = public;
ALTER TABLE products ADD COLUMN image_public_id VARCHAR(255);
ALTER TABLE products ADD CONSTRAINT products_image_public_id_format CHECK (
    image_public_id IS NULL OR
    image_public_id ~ '^tgp/product-images/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
);
CREATE UNIQUE INDEX products_image_public_id_uidx ON products(image_public_id)
    WHERE image_public_id IS NOT NULL;
COMMIT;
