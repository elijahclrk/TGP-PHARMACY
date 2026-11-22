-- PROPOSAL ONLY. NOT APPLIED OR INCLUDED IN ANY MIGRATION RUNNER.
-- Decision required: approve durable per-Admin dashboard display preferences.
-- This is not pharmacy-wide safety-alert suppression or scheduled messaging.
-- Prerequisites: original users/activity_logs and reviewed baseline history.
BEGIN;
SET LOCAL search_path = public;

CREATE TABLE admin_notification_preferences (
  user_id INTEGER PRIMARY KEY REFERENCES users(user_id),
  low_stock_dashboard BOOLEAN NOT NULL,
  upcoming_expiry_dashboard BOOLEAN NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  updated_by INTEGER NOT NULL REFERENCES users(user_id),
  updated_at TIMESTAMPTZ NOT NULL,
  CHECK (updated_by = user_id)
);

CREATE FUNCTION tgp_notification_preferences_owner() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE user_id=NEW.user_id AND role='admin' AND status='active') THEN
    RAISE EXCEPTION 'Active Admin preferences owner required';
  END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.revision<>1 THEN RAISE EXCEPTION 'Initial preference revision must be one'; END IF;
  ELSIF NEW.user_id<>OLD.user_id OR NEW.revision<>OLD.revision+1 THEN
    RAISE EXCEPTION 'Immutable preference owner and sequential revision required';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER notification_preferences_owner BEFORE INSERT OR UPDATE ON admin_notification_preferences
  FOR EACH ROW EXECUTE FUNCTION tgp_notification_preferences_owner();

-- Future API must require active Admin, trusted mutation request, bind self,
-- lock user against concurrent role/status changes, compare expected revision,
-- update booleans/revision/server time and audit in one transaction.
-- GET returns own reviewed preferences only; no cross-account/global settings.
-- Absence preserves current enabled display behavior; no production rows seeded.
-- Keep all safety alerts, expiry eligibility, stock/reports and review rules.
-- Rollback: disable durable writers, retain table/audits and fall back to clearly
-- labeled browser-local preferences. Do not drop history as routine rollback.
COMMIT;
