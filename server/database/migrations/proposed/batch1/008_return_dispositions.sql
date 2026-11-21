-- DESIGN ONLY. NOT APPLIED, NOT IN ANY RUNNER/ALLOWLIST.
-- Prerequisites: 007 and separately approved/executed 003_return_sale_item_link.
-- 003 refuses nonempty unlinked return history. Never guess a backfill.
BEGIN;
SET LOCAL search_path = public;
DO $prerequisite$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema=current_schema() AND table_name='sale_returns' AND column_name='sale_item_id') THEN
    RAISE EXCEPTION 'Approved sale-item linkage migration 003 is required';
  END IF;
END;
$prerequisite$;

ALTER TABLE sale_returns
  ADD COLUMN decision_state TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN request_key UUID UNIQUE,
  ADD COLUMN reviewed_by INTEGER REFERENCES users(user_id),
  ADD COLUMN reviewed_at TIMESTAMPTZ,
  ADD COLUMN decision_reason TEXT,
  ADD COLUMN received_quantity INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN received_at TIMESTAMPTZ,
  ADD COLUMN received_by INTEGER REFERENCES users(user_id),
  ADD CONSTRAINT return_decision_state_ck CHECK (decision_state IN ('legacy','pending','approved','rejected')),
  ADD CONSTRAINT return_physical_receipt_ck CHECK (received_quantity>=0 AND (decision_state='legacy' OR (
    quantity IS NOT NULL AND quantity>0 AND (
      (received_quantity=0 AND received_at IS NULL AND received_by IS NULL) OR
      (decision_state='approved' AND received_quantity=quantity AND received_at IS NOT NULL AND received_by IS NOT NULL))))) NOT VALID,
  ADD CONSTRAINT return_two_person_decision_ck CHECK (decision_state='legacy' OR (
    request_key IS NOT NULL AND return_date IS NOT NULL AND quantity IS NOT NULL AND quantity>0 AND reason IS NOT NULL AND length(btrim(reason))>0
    AND (reviewed_by IS NULL OR reviewed_by<>processed_by) AND (
      (decision_state='pending' AND approved_by IS NULL AND reviewed_by IS NULL AND reviewed_at IS NULL AND decision_reason IS NULL) OR
      (decision_state='approved' AND approved_by IS NOT NULL AND reviewed_by IS NOT NULL AND approved_by=reviewed_by AND reviewed_at IS NOT NULL AND decision_reason IS NULL) OR
      (decision_state='rejected' AND approved_by IS NULL AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL
        AND decision_reason IS NOT NULL AND length(btrim(decision_reason))>0)
    ))) NOT VALID;

-- Explicit professional authorization, distinct from the application's role.
-- Evidence references are private; a role name is never evidence of licensure.
CREATE TABLE pharmacist_authorizations (
  authorization_id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(user_id),
  authorized_by INTEGER NOT NULL REFERENCES users(user_id),
  evidence_ref TEXT NOT NULL CHECK (length(btrim(evidence_ref))>0),
  verified_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL CHECK (expires_at>verified_at),
  revoked_at TIMESTAMPTZ,
  UNIQUE (authorization_id,user_id),
  CHECK (authorized_by<>user_id)
);

-- Physical returns remain outside batches.qty_on_hand while quarantined.
-- A disposition consumes accepted/received units; acceptance is not disposition.
CREATE TABLE return_dispositions (
  disposition_id INTEGER PRIMARY KEY,
  return_id INTEGER NOT NULL REFERENCES sale_returns(return_id),
  request_key UUID NOT NULL UNIQUE,
  action TEXT NOT NULL CHECK (action IN ('destroy','supplier_return','restock')),
  quantity INTEGER NOT NULL CHECK (quantity>0),
  requested_by INTEGER NOT NULL REFERENCES users(user_id),
  requested_at TIMESTAMPTZ NOT NULL,
  reason TEXT NOT NULL CHECK (length(btrim(reason))>0),
  decision_state TEXT NOT NULL CHECK (decision_state IN ('pending','approved','rejected')),
  reviewed_by INTEGER REFERENCES users(user_id),
  reviewed_at TIMESTAMPTZ,
  decision_reason TEXT,
  pharmacist_authorization_id INTEGER,
  adjustment_id INTEGER UNIQUE REFERENCES stock_adjustments(adjustment_id),
  posted_at TIMESTAMPTZ,
  restock_eligible BOOLEAN,
  restock_assessment TEXT,
  CONSTRAINT disposition_restock_assessment_ck CHECK (
    (decision_state='approved' AND action='restock' AND restock_eligible IS TRUE AND restock_assessment IS NOT NULL AND length(btrim(restock_assessment))>0)
    OR ((decision_state<>'approved' OR action<>'restock') AND restock_eligible IS NULL AND restock_assessment IS NULL)),
  FOREIGN KEY (pharmacist_authorization_id,reviewed_by)
    REFERENCES pharmacist_authorizations(authorization_id,user_id),
  CHECK (reviewed_by IS NULL OR reviewed_by<>requested_by),
  CHECK (
    (decision_state='pending' AND reviewed_by IS NULL AND reviewed_at IS NULL AND decision_reason IS NULL AND pharmacist_authorization_id IS NULL) OR
    (decision_state='approved' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND decision_reason IS NULL) OR
    (decision_state='rejected' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL
      AND decision_reason IS NOT NULL AND length(btrim(decision_reason))>0)
  ),
  CHECK (
    (decision_state='approved' AND action='restock' AND pharmacist_authorization_id IS NOT NULL
      AND adjustment_id IS NOT NULL AND posted_at IS NOT NULL) OR
    ((decision_state<>'approved' OR action<>'restock') AND adjustment_id IS NULL AND posted_at IS NULL)
  )
);

ALTER TABLE stock_adjustments
  ADD COLUMN return_disposition_id INTEGER UNIQUE REFERENCES return_dispositions(disposition_id),
  ADD CONSTRAINT adjustment_return_origin_ck CHECK (
    (origin_kind='manual' AND return_disposition_id IS NULL) OR
    (origin_kind='return_restock' AND return_disposition_id IS NOT NULL)),
  ADD CONSTRAINT adjustment_disposition_pair_uq UNIQUE (adjustment_id,return_disposition_id);
ALTER TABLE return_dispositions ADD CONSTRAINT disposition_posting_pair_fk
  FOREIGN KEY (adjustment_id,disposition_id)
  REFERENCES stock_adjustments(adjustment_id,return_disposition_id)
  DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX return_dispositions_return_idx ON return_dispositions(return_id,decision_state);
CREATE INDEX sale_returns_decision_queue_idx ON sale_returns(decision_state,return_date,return_id);
CREATE FUNCTION tgp_return_lifecycle() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.decision_state<>'pending' THEN RAISE EXCEPTION 'New return must be pending'; END IF;
  ELSE
    IF TG_OP='DELETE' OR OLD.decision_state IN ('legacy','rejected') THEN RAISE EXCEPTION 'Return history is immutable'; END IF;
    IF OLD.decision_state='approved' THEN
      IF OLD.received_quantity<>0 OR NEW.received_quantity<>OLD.quantity OR
         (to_jsonb(NEW)-ARRAY['received_quantity','received_at','received_by']) IS DISTINCT FROM
         (to_jsonb(OLD)-ARRAY['received_quantity','received_at','received_by']) THEN
        RAISE EXCEPTION 'Only one full quarantine receipt is allowed';
      END IF;
    ELSE
      IF NEW.decision_state NOT IN ('approved','rejected') OR
         (to_jsonb(NEW)-ARRAY['decision_state','approved_by','reviewed_by','reviewed_at','decision_reason']) IS DISTINCT FROM
         (to_jsonb(OLD)-ARRAY['decision_state','approved_by','reviewed_by','reviewed_at','decision_reason']) THEN
        RAISE EXCEPTION 'Only a terminal return decision is allowed';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM users WHERE user_id=NEW.reviewed_by AND status='active' AND role IN ('manager','admin')) THEN
        RAISE EXCEPTION 'Active management reviewer required';
      END IF;
    END IF;
  END IF;
  -- All competing requests for the same sold line share this serialization key.
  PERFORM 1 FROM sale_items WHERE sale_item_id=NEW.sale_item_id FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM sale_items WHERE sale_item_id=NEW.sale_item_id AND quantity IS NOT NULL AND quantity>0) THEN
    RAISE EXCEPTION 'Verified sold quantity required';
  END IF;
  IF NEW.decision_state='approved' AND (
    SELECT COALESCE(sum(quantity),0)+NEW.quantity FROM sale_returns
      WHERE sale_item_id=NEW.sale_item_id AND decision_state='approved' AND return_id<>NEW.return_id
  ) > (SELECT quantity FROM sale_items WHERE sale_item_id=NEW.sale_item_id) THEN
    RAISE EXCEPTION 'Cumulative approved returns exceed sold quantity';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER return_lifecycle BEFORE INSERT OR UPDATE OR DELETE ON sale_returns
  FOR EACH ROW EXECUTE FUNCTION tgp_return_lifecycle();

CREATE FUNCTION tgp_preserve_return_source() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM sale_returns WHERE sale_item_id=OLD.sale_item_id) THEN
    RAISE EXCEPTION 'Sold line with return history is immutable';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER preserve_return_source BEFORE UPDATE OR DELETE ON sale_items
  FOR EACH ROW EXECUTE FUNCTION tgp_preserve_return_source();

CREATE FUNCTION tgp_disposition_lifecycle() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r sale_returns%ROWTYPE; b batches%ROWTYPE;
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.decision_state<>'pending' THEN RAISE EXCEPTION 'New disposition must be pending'; END IF;
  ELSE
    IF TG_OP='DELETE' OR OLD.decision_state<>'pending' THEN RAISE EXCEPTION 'Disposition history is immutable'; END IF;
    IF NEW.decision_state NOT IN ('approved','rejected') OR
       (to_jsonb(NEW)-ARRAY['decision_state','reviewed_by','reviewed_at','decision_reason','pharmacist_authorization_id','adjustment_id','posted_at','restock_eligible','restock_assessment']) IS DISTINCT FROM
       (to_jsonb(OLD)-ARRAY['decision_state','reviewed_by','reviewed_at','decision_reason','pharmacist_authorization_id','adjustment_id','posted_at','restock_eligible','restock_assessment']) THEN
      RAISE EXCEPTION 'Only a terminal disposition decision is allowed';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM users WHERE user_id=NEW.reviewed_by AND status='active' AND role IN ('manager','admin')) THEN
      RAISE EXCEPTION 'Active management reviewer required';
    END IF;
  END IF;
  SELECT * INTO STRICT r FROM sale_returns WHERE return_id=NEW.return_id FOR UPDATE;
  IF r.decision_state<>'approved' OR r.received_quantity<>r.quantity THEN RAISE EXCEPTION 'Full accepted quarantine receipt required'; END IF;
  IF NEW.decision_state='approved' THEN
    IF (SELECT COALESCE(sum(quantity),0)+NEW.quantity FROM return_dispositions
        WHERE return_id=NEW.return_id AND decision_state='approved' AND disposition_id<>NEW.disposition_id)>r.received_quantity THEN
      RAISE EXCEPTION 'Disposition exceeds quarantine balance';
    END IF;
    IF NEW.action='restock' THEN
      IF NEW.reviewed_by=r.processed_by THEN RAISE EXCEPTION 'Return initiator cannot authorize restocking'; END IF;
      PERFORM 1 FROM pharmacist_authorizations WHERE authorization_id=NEW.pharmacist_authorization_id
        AND user_id=NEW.reviewed_by AND verified_at<=CURRENT_TIMESTAMP AND expires_at>CURRENT_TIMESTAMP AND revoked_at IS NULL FOR SHARE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Current verified pharmacist authorization required'; END IF;
      SELECT b0.* INTO STRICT b FROM batches b0 JOIN sale_items i ON i.batch_id=b0.batch_id WHERE i.sale_item_id=r.sale_item_id FOR UPDATE OF b0;
      IF b.expiry_date IS NULL OR b.expiry_date<=(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date THEN
        RAISE EXCEPTION 'Expired/expiring-today batch cannot become sellable';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER disposition_lifecycle BEFORE INSERT OR UPDATE OR DELETE ON return_dispositions
  FOR EACH ROW EXECUTE FUNCTION tgp_disposition_lifecycle();

-- Deferred so the linked pending adjustment can be inserted before both
-- decisions are finalized in the same transaction; reject partial pair commits.
CREATE FUNCTION tgp_restock_pair() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a stock_adjustments%ROWTYPE; d return_dispositions%ROWTYPE; sold_batch INTEGER;
BEGIN
  IF TG_TABLE_NAME='stock_adjustments' THEN
    IF NEW.origin_kind<>'return_restock' THEN RETURN NULL; END IF;
    SELECT * INTO STRICT a FROM stock_adjustments WHERE adjustment_id=NEW.adjustment_id;
    SELECT * INTO STRICT d FROM return_dispositions WHERE disposition_id=a.return_disposition_id;
  ELSE
    SELECT * INTO STRICT d FROM return_dispositions WHERE disposition_id=NEW.disposition_id;
    IF d.decision_state<>'approved' OR d.action<>'restock' THEN RETURN NULL; END IF;
    SELECT * INTO STRICT a FROM stock_adjustments WHERE adjustment_id=d.adjustment_id;
  END IF;
  SELECT i.batch_id INTO STRICT sold_batch FROM sale_items i JOIN sale_returns r ON r.sale_item_id=i.sale_item_id WHERE r.return_id=d.return_id;
  IF d.decision_state<>'approved' OR d.action<>'restock' OR a.decision_state<>'approved'
    OR d.adjustment_id IS DISTINCT FROM a.adjustment_id OR a.return_disposition_id IS DISTINCT FROM d.disposition_id
    OR a.origin_kind<>'return_restock' OR a.batch_id<>sold_batch OR a.quantity<>d.quantity
    OR a.reviewed_by IS DISTINCT FROM d.reviewed_by OR a.adjusted_by<>d.requested_by OR a.posted_at IS DISTINCT FROM d.posted_at THEN
    RAISE EXCEPTION 'Restock posting must match approved disposition, original batch, quantity and reviewers';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER restock_adjustment_pair AFTER INSERT OR UPDATE ON stock_adjustments
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION tgp_restock_pair();
CREATE CONSTRAINT TRIGGER restock_disposition_pair AFTER INSERT OR UPDATE ON return_dispositions
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION tgp_restock_pair();
-- Services must also lock parent rows BEFORE calculating aggregate limits;
-- these guards are defense in depth, not permission to bypass transaction code.
-- No automatic refund or balance update occurs in these migrations.
COMMIT;
