-- DESIGN ONLY. NOT APPLIED OR INCLUDED IN ANY RUNNER.
-- PO/Stock-In permissions and schema are deliberately unchanged.
BEGIN;
SET LOCAL search_path = public;

ALTER TABLE stock_adjustments
  ADD COLUMN decision_state TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN request_key UUID UNIQUE,
  ADD COLUMN reviewed_by INTEGER REFERENCES users(user_id),
  ADD COLUMN reviewed_at TIMESTAMPTZ,
  ADD COLUMN decision_reason TEXT,
  ADD COLUMN posted_at TIMESTAMPTZ,
  ADD COLUMN balance_before INTEGER,
  ADD COLUMN balance_after INTEGER,
  ADD COLUMN origin_kind TEXT NOT NULL DEFAULT 'manual',
  ADD CONSTRAINT adjustment_origin_kind_ck CHECK (origin_kind IN ('manual','return_restock')),
  ADD CONSTRAINT adjustment_decision_state_ck CHECK (decision_state IN ('legacy','pending','approved','rejected')),
  ADD CONSTRAINT adjustment_two_person_decision_ck CHECK (decision_state='legacy' OR (
    request_key IS NOT NULL AND quantity IS NOT NULL AND quantity<>0 AND reason IS NOT NULL AND length(btrim(reason))>0
    AND adjustment_date IS NOT NULL AND (reviewed_by IS NULL OR reviewed_by<>adjusted_by) AND (
      (decision_state='pending' AND approved_by IS NULL AND reviewed_by IS NULL AND reviewed_at IS NULL AND decision_reason IS NULL
        AND posted_at IS NULL AND balance_before IS NULL AND balance_after IS NULL) OR
      (decision_state='approved' AND approved_by IS NOT NULL AND reviewed_by IS NOT NULL AND approved_by=reviewed_by
        AND reviewed_at IS NOT NULL AND posted_at IS NOT NULL AND decision_reason IS NULL
        AND balance_before IS NOT NULL AND balance_after IS NOT NULL
        AND balance_before>=0 AND balance_after>=0 AND balance_before::bigint+quantity::bigint=balance_after::bigint) OR
      (decision_state='rejected' AND approved_by IS NULL AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL
        AND decision_reason IS NOT NULL AND length(btrim(decision_reason))>0 AND posted_at IS NULL
        AND balance_before IS NULL AND balance_after IS NULL)
    ))) NOT VALID;

CREATE FUNCTION tgp_adjustment_lifecycle() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.decision_state<>'pending' THEN RAISE EXCEPTION 'New adjustment must be pending'; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP='DELETE' OR OLD.decision_state<>'pending' THEN
    RAISE EXCEPTION 'Adjustment history is immutable';
  END IF;
  IF NEW.decision_state NOT IN ('approved','rejected') OR
     (to_jsonb(NEW)-ARRAY['decision_state','approved_by','reviewed_by','reviewed_at','decision_reason','posted_at','balance_before','balance_after'])
       IS DISTINCT FROM
     (to_jsonb(OLD)-ARRAY['decision_state','approved_by','reviewed_by','reviewed_at','decision_reason','posted_at','balance_before','balance_after']) THEN
    RAISE EXCEPTION 'Only a terminal decision is allowed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM users WHERE user_id=NEW.reviewed_by AND status='active' AND role IN ('manager','admin')) THEN
    RAISE EXCEPTION 'Active management reviewer required';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER adjustment_lifecycle BEFORE INSERT OR UPDATE OR DELETE ON stock_adjustments
  FOR EACH ROW EXECUTE FUNCTION tgp_adjustment_lifecycle();
CREATE INDEX stock_adjustments_decision_queue_idx ON stock_adjustments(decision_state,adjustment_date,adjustment_id);
-- Legacy rows remain readable, frozen pending a separately reviewed conversion.
-- Batch mutation, decision and audit must use the prepared transaction service.
COMMIT;
