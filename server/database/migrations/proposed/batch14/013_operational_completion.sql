-- Proposed additive operational fields and linked receiving. Local tests only.
-- 001/002/004 required; independent of 010 and protected return/benefit schemas.
BEGIN;
SET LOCAL search_path = public;
ALTER TABLE products ADD COLUMN strength_dosage TEXT CHECK(strength_dosage IS NULL OR length(btrim(strength_dosage)) BETWEEN 1 AND 200);
ALTER TABLE suppliers ADD COLUMN contact_person TEXT, ADD COLUMN email TEXT,
 ADD COLUMN status TEXT CHECK(status IS NULL OR status IN('active','inactive'));
ALTER TABLE purchase_orders ADD COLUMN expected_delivery DATE, ADD COLUMN notes TEXT;
ALTER TABLE stock_ins ADD COLUMN po_id INTEGER REFERENCES purchase_orders(po_id), ADD COLUMN receiving_request_id UUID UNIQUE,
 ADD COLUMN receiving_request_digest TEXT,
 ADD CONSTRAINT linked_receiving_identity CHECK(po_id IS NULL OR (receiving_request_id IS NOT NULL AND receiving_request_digest IS NOT NULL AND length(btrim(delivery_ref))>0));
ALTER TABLE stock_in_items ADD COLUMN po_item_id INTEGER REFERENCES purchase_order_items(po_item_id);
-- Only linked documents use a single delivery-reference identity per PO.
-- Historical independent deliveries retain their original nonunique contract.
CREATE UNIQUE INDEX linked_delivery_identity ON stock_ins(po_id,lower(btrim(delivery_ref))) WHERE po_id IS NOT NULL;
CREATE INDEX linked_receiving_order ON stock_ins(po_id);
CREATE INDEX linked_receiving_item ON stock_in_items(po_item_id);
CREATE FUNCTION tgp_linked_receiving_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE h stock_ins%ROWTYPE; p purchase_orders%ROWTYPE; r RECORD; used BIGINT; total BIGINT; fulfilled BIGINT;
BEGIN
 PERFORM pg_advisory_xact_lock(742901,2);
 IF TG_TABLE_NAME='stock_ins' THEN
  IF TG_OP='DELETE' THEN IF OLD.po_id IS NOT NULL THEN RAISE EXCEPTION 'Linked receiving history is retained'; END IF; RETURN OLD; END IF;
  IF TG_OP='UPDATE' AND OLD.po_id IS DISTINCT FROM NEW.po_id THEN RAISE EXCEPTION 'Immutable PO linkage'; END IF;
  IF NEW.po_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO STRICT p FROM purchase_orders WHERE po_id=NEW.po_id FOR UPDATE;
  IF p.approved_by IS NULL OR p.supplier_id<>NEW.supplier_id THEN RAISE EXCEPTION 'Approved matching PO required'; END IF;
  IF TG_OP='INSERT' AND NEW.approved_by IS NOT NULL THEN RAISE EXCEPTION 'Pending receiving required'; END IF;
  IF TG_OP='UPDATE' THEN
   IF (to_jsonb(NEW)-'approved_by') IS DISTINCT FROM (to_jsonb(OLD)-'approved_by') OR OLD.approved_by IS NOT NULL THEN RAISE EXCEPTION 'Immutable receiving identity/history'; END IF;
   IF NEW.approved_by IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM users WHERE user_id=NEW.approved_by AND role IN('manager','admin') AND status='active') THEN RAISE EXCEPTION 'Authorized receiving reviewer required'; END IF;
    IF NOT EXISTS(SELECT 1 FROM stock_in_items WHERE stock_in_id=NEW.stock_in_id) THEN RAISE EXCEPTION 'Receiving items required'; END IF;
    FOR r IN SELECT po_item_id,sum(quantity) AS quantity FROM stock_in_items WHERE stock_in_id=NEW.stock_in_id GROUP BY po_item_id LOOP
     SELECT coalesce(sum(i.quantity),0) INTO used FROM stock_in_items i JOIN stock_ins s USING(stock_in_id) WHERE i.po_item_id=r.po_item_id AND s.approved_by IS NOT NULL AND s.stock_in_id<>NEW.stock_in_id;
     SELECT quantity INTO total FROM purchase_order_items WHERE po_item_id=r.po_item_id AND po_id=NEW.po_id;
     IF total IS NULL OR used+r.quantity>total THEN RAISE EXCEPTION 'Ordered quantity exceeded'; END IF;
    END LOOP;
   END IF;
  END IF;
  RETURN NEW;
 END IF;
 IF TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM stock_ins WHERE stock_in_id=OLD.stock_in_id AND po_id IS NOT NULL) THEN RAISE EXCEPTION 'Immutable linked receiving items'; END IF;
 IF TG_OP='DELETE' THEN SELECT * INTO STRICT h FROM stock_ins WHERE stock_in_id=OLD.stock_in_id FOR UPDATE;
 ELSE SELECT * INTO STRICT h FROM stock_ins WHERE stock_in_id=NEW.stock_in_id FOR UPDATE; END IF;
 IF h.po_id IS NULL THEN
  IF TG_OP<>'DELETE' AND NEW.po_item_id IS NOT NULL THEN RAISE EXCEPTION 'PO item requires linked header'; END IF;
 ELSE
  IF TG_OP<>'INSERT' OR h.approved_by IS NOT NULL THEN RAISE EXCEPTION 'Immutable linked receiving items'; END IF;
  IF NOT EXISTS(SELECT 1 FROM purchase_order_items ordered JOIN batches b ON b.batch_id=NEW.batch_id WHERE ordered.po_item_id=NEW.po_item_id AND ordered.po_id=h.po_id AND ordered.product_id=b.product_id AND NEW.quantity>0 AND NEW.quantity<=ordered.quantity AND NEW.unit_cost=b.cost_price) THEN RAISE EXCEPTION 'Matching ordered product/batch/quantity required'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END; $$;
CREATE TRIGGER linked_receiving_guard BEFORE INSERT OR UPDATE OR DELETE ON stock_ins FOR EACH ROW EXECUTE FUNCTION tgp_linked_receiving_guard();
CREATE TRIGGER linked_receiving_item_guard BEFORE INSERT OR UPDATE OR DELETE ON stock_in_items FOR EACH ROW EXECUTE FUNCTION tgp_linked_receiving_guard();
CREATE FUNCTION tgp_linked_receiving_status() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE total BIGINT; fulfilled BIGINT;
BEGIN
 IF NEW.po_id IS NULL OR NEW.approved_by IS NULL THEN RETURN NULL; END IF;
 SELECT coalesce(sum(quantity),0) INTO total FROM purchase_order_items WHERE po_id=NEW.po_id;
 SELECT coalesce(sum(i.quantity),0) INTO fulfilled FROM stock_in_items i JOIN stock_ins s USING(stock_in_id) WHERE s.po_id=NEW.po_id AND s.approved_by IS NOT NULL;
 UPDATE purchase_orders SET status=CASE WHEN fulfilled=total THEN 'received' ELSE 'partially_received' END WHERE po_id=NEW.po_id;
 RETURN NULL;
END; $$;
CREATE TRIGGER linked_receiving_status AFTER UPDATE OF approved_by ON stock_ins FOR EACH ROW EXECUTE FUNCTION tgp_linked_receiving_status();
CREATE FUNCTION tgp_linked_order_item_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(742901,2);
 IF TG_OP='INSERT' THEN
  IF EXISTS(SELECT 1 FROM stock_ins WHERE po_id=NEW.po_id) THEN RAISE EXCEPTION 'Ordered items with receiving history are immutable'; END IF;
 ELSE
  IF EXISTS(SELECT 1 FROM stock_ins WHERE po_id=OLD.po_id) THEN RAISE EXCEPTION 'Ordered items with receiving history are immutable'; END IF;
  IF TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM stock_ins WHERE po_id=NEW.po_id) THEN RAISE EXCEPTION 'Ordered items with receiving history are immutable'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END; $$;
CREATE TRIGGER linked_order_item_guard BEFORE INSERT OR UPDATE OR DELETE ON purchase_order_items FOR EACH ROW EXECUTE FUNCTION tgp_linked_order_item_guard();
COMMIT;
