-- Local-only MVP proposal. Requires 003/007/008; 009/011 optional source readers.
-- No production execution. No historical migration or financial backfill.
BEGIN;
SET LOCAL search_path = public;
CREATE DOMAIN tgp_exchange_money AS NUMERIC CHECK(VALUE IS NOT NULL AND VALUE>=0 AND VALUE<1000000000000 AND scale(VALUE)<=2);
CREATE TABLE product_exchanges (
 exchange_id UUID PRIMARY KEY, request_digest TEXT NOT NULL,
 root_sale_id INTEGER NOT NULL REFERENCES sales(sale_id),
 initiated_by INTEGER NOT NULL REFERENCES users(user_id),
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN('pending','approved','rejected','cancelled','posted')),
 reason TEXT NOT NULL CHECK(length(btrim(reason)) BETWEEN 1 AND 1000),
 request JSONB NOT NULL, quote JSONB NOT NULL, fingerprint TEXT NOT NULL,
 policy_version TEXT NOT NULL, reviewed_by INTEGER REFERENCES users(user_id), reviewed_at TIMESTAMPTZ,
 decision_reason TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 posted_at TIMESTAMPTZ, business_date DATE, posting_request_id UUID UNIQUE, posting_digest TEXT,
 return_value tgp_exchange_money NOT NULL, replacement_value tgp_exchange_money NOT NULL,
 additional_cash tgp_exchange_money NOT NULL,
 CHECK(replacement_value=return_value+additional_cash),
 CHECK(reviewed_by IS NULL OR reviewed_by<>initiated_by),
 CHECK(state NOT IN('approved','posted') OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)),
 CHECK(state<>'posted' OR (posted_at IS NOT NULL AND business_date IS NOT NULL AND posting_request_id IS NOT NULL AND posting_digest IS NOT NULL))
 ,CHECK(state='posted' OR (posted_at IS NULL AND business_date IS NULL AND posting_request_id IS NULL AND posting_digest IS NULL))
);
CREATE TABLE exchange_claims (
 claim_id UUID PRIMARY KEY, exchange_id UUID NOT NULL REFERENCES product_exchanges(exchange_id),
 return_id INTEGER NOT NULL REFERENCES sale_returns(return_id),
 sale_id INTEGER NOT NULL, sale_item_id INTEGER NOT NULL,
 quantity INTEGER NOT NULL CHECK(quantity>0), unit_price tgp_exchange_money NOT NULL,
 applied_value tgp_exchange_money NOT NULL CHECK(applied_value=quantity*unit_price),
 FOREIGN KEY(sale_id,sale_item_id) REFERENCES sale_items(sale_id,sale_item_id),
 UNIQUE(exchange_id,return_id)
);
CREATE TABLE exchange_pricing_lines (
 line_id UUID PRIMARY KEY, exchange_id UUID NOT NULL REFERENCES product_exchanges(exchange_id),
 product_id INTEGER NOT NULL REFERENCES products(product_id), quantity INTEGER NOT NULL CHECK(quantity>0),
 product_name TEXT NOT NULL, unit_price tgp_exchange_money NOT NULL,
 payable tgp_exchange_money NOT NULL CHECK(payable=quantity*unit_price),
 evidence JSONB NOT NULL, tax_status TEXT NOT NULL CHECK(tax_status='unassessed_internal'),
 UNIQUE(exchange_id,product_id), UNIQUE(line_id,exchange_id,product_id)
);
CREATE TABLE exchange_items (
 exchange_item_id UUID PRIMARY KEY, line_id UUID NOT NULL, exchange_id UUID NOT NULL, product_id INTEGER NOT NULL,
 batch_id INTEGER NOT NULL REFERENCES batches(batch_id), batch_no TEXT NOT NULL, expiry_date DATE NOT NULL,
 quantity INTEGER NOT NULL CHECK(quantity>0), unit_price tgp_exchange_money NOT NULL,
 payable tgp_exchange_money NOT NULL CHECK(payable=quantity*unit_price),
 FOREIGN KEY(line_id,exchange_id,product_id) REFERENCES exchange_pricing_lines(line_id,exchange_id,product_id),
 UNIQUE(line_id,batch_id)
);
CREATE TABLE exchange_settlements (
 exchange_id UUID PRIMARY KEY REFERENCES product_exchanges(exchange_id),
 cash_due tgp_exchange_money NOT NULL, tender tgp_exchange_money NOT NULL, change_due tgp_exchange_money NOT NULL,
 CHECK(tender-change_due=cash_due), CHECK(cash_due>0 OR (tender=0 AND change_due=0))
);
CREATE TABLE exchange_events (
 event_id UUID PRIMARY KEY, exchange_id UUID NOT NULL REFERENCES product_exchanges(exchange_id),
 actor_id INTEGER NOT NULL REFERENCES users(user_id), event_kind TEXT NOT NULL CHECK(event_kind IN('requested','approved','rejected','cancelled','posted','attempt_closed')),
 operation_id UUID NOT NULL UNIQUE, payload JSONB NOT NULL DEFAULT '{}', occurred_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX exchange_queue ON product_exchanges(state,created_at);
CREATE INDEX exchange_claim_source ON exchange_claims(return_id);
CREATE UNIQUE INDEX exchange_event_once ON exchange_events(exchange_id,event_kind) WHERE event_kind<>'attempt_closed';

CREATE FUNCTION tgp_exchange_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE e product_exchanges%ROWTYPE; r RECORD; used BIGINT; n INTEGER;
BEGIN
 PERFORM pg_advisory_xact_lock(742901,2);
 IF TG_TABLE_NAME='product_exchanges' THEN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Exchange history cannot be deleted'; END IF;
  IF TG_OP='INSERT' THEN
   IF NEW.request->>'route' IS DISTINCT FROM 'voluntary' THEN RAISE EXCEPTION 'Authorized remedy review required'; END IF;
   IF NEW.state<>'pending' OR NEW.reviewed_by IS NOT NULL OR NEW.posting_request_id IS NOT NULL THEN RAISE EXCEPTION 'Invalid initial exchange'; END IF;
   IF NOT EXISTS(SELECT 1 FROM users WHERE user_id=NEW.initiated_by AND status='active') THEN RAISE EXCEPTION 'Inactive initiator'; END IF;
   RETURN NEW;
  END IF;
  IF (to_jsonb(NEW)-ARRAY['state','reviewed_by','reviewed_at','decision_reason','posted_at','business_date','posting_request_id','posting_digest'])
    IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','reviewed_by','reviewed_at','decision_reason','posted_at','business_date','posting_request_id','posting_digest']) THEN RAISE EXCEPTION 'Immutable exchange content'; END IF;
  IF NOT ((OLD.state='pending' AND NEW.state IN('approved','rejected','cancelled')) OR (OLD.state='approved' AND NEW.state IN('posted','cancelled'))) THEN RAISE EXCEPTION 'Terminal exchange state'; END IF;
  IF NEW.state IN('approved','rejected') AND NOT EXISTS(SELECT 1 FROM users WHERE user_id=NEW.reviewed_by AND status='active' AND role IN('manager','admin') AND user_id<>NEW.initiated_by) THEN RAISE EXCEPTION 'Independent review required'; END IF;
  IF NEW.state IN('rejected','cancelled') AND (NEW.decision_reason IS NULL OR length(btrim(NEW.decision_reason))=0) THEN RAISE EXCEPTION 'Decision reason required'; END IF;
  IF OLD.state='approved' AND (NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at) THEN RAISE EXCEPTION 'Immutable review'; END IF;
  IF NEW.state IN('approved','posted') THEN
   FOR r IN SELECT c.*,x.sale_id AS actual_sale,x.sale_item_id AS actual_item,x.quantity AS accepted,x.received_quantity,x.decision_state FROM exchange_claims c JOIN sale_returns x USING(return_id) WHERE c.exchange_id=NEW.exchange_id ORDER BY c.return_id LOOP
    PERFORM 1 FROM sale_items WHERE sale_item_id=r.sale_item_id FOR UPDATE;
    PERFORM 1 FROM sale_returns WHERE return_id=r.return_id FOR UPDATE;
    IF r.sale_id<>NEW.root_sale_id OR r.actual_sale<>r.sale_id OR r.actual_item<>r.sale_item_id OR r.decision_state<>'approved' OR r.received_quantity<>r.accepted THEN RAISE EXCEPTION 'Approved physical source required'; END IF;
    SELECT coalesce(sum(c.quantity),0) INTO used FROM exchange_claims c JOIN product_exchanges x USING(exchange_id) WHERE c.return_id=r.return_id AND x.state IN('approved','posted') AND x.exchange_id<>NEW.exchange_id;
    IF used+r.quantity>r.received_quantity THEN RAISE EXCEPTION 'Exchange source exhausted'; END IF;
   END LOOP;
  END IF;
  IF NEW.state='posted' THEN
   IF NOT EXISTS(SELECT 1 FROM users WHERE user_id=NEW.initiated_by AND status='active') OR NOT EXISTS(SELECT 1 FROM users WHERE user_id=NEW.reviewed_by AND status='active' AND role IN('manager','admin')) THEN RAISE EXCEPTION 'Current authorization required'; END IF;
   IF NEW.business_date<>(clock_timestamp() AT TIME ZONE 'Asia/Manila')::date THEN RAISE EXCEPTION 'Stale business date'; END IF;
   FOR r IN SELECT * FROM exchange_items WHERE exchange_id=NEW.exchange_id ORDER BY product_id,expiry_date,batch_id LOOP
    UPDATE batches SET qty_on_hand=qty_on_hand-r.quantity WHERE batch_id=r.batch_id AND product_id=r.product_id AND expiry_date=r.expiry_date AND expiry_date>NEW.business_date AND qty_on_hand>=r.quantity;
    GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'Replacement inventory unavailable'; END IF;
   END LOOP;
  END IF;
  RETURN NEW;
 END IF;
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Immutable exchange evidence'; END IF;
 SELECT * INTO STRICT e FROM product_exchanges WHERE exchange_id=NEW.exchange_id FOR UPDATE;
 IF TG_TABLE_NAME='exchange_events' THEN
  IF (NEW.event_kind='requested' AND (e.state<>'pending' OR NEW.actor_id<>e.initiated_by))
   OR (NEW.event_kind IN('approved','rejected','cancelled') AND e.state<>NEW.event_kind)
   OR (NEW.event_kind IN('approved','rejected') AND NEW.actor_id IS DISTINCT FROM e.reviewed_by)
   OR (NEW.event_kind IN('posted','attempt_closed') AND (e.state NOT IN('pending','approved') OR NEW.actor_id<>e.initiated_by))
   OR (NEW.event_kind='posted' AND e.state<>'approved') THEN RAISE EXCEPTION 'Event state mismatch'; END IF;
 ELSIF TG_TABLE_NAME='exchange_settlements' THEN
  IF e.state<>'approved' THEN RAISE EXCEPTION 'Approved settlement required'; END IF;
 ELSIF e.state<>'pending' THEN RAISE EXCEPTION 'Immutable reviewed lines'; END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION tgp_exchange_reconcile() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE e product_exchanges%ROWTYPE; r RECORD; n INTEGER; v NUMERIC;
BEGIN
 SELECT * INTO STRICT e FROM product_exchanges WHERE exchange_id=NEW.exchange_id;
 IF NOT EXISTS(SELECT 1 FROM sales WHERE sale_id=e.root_sale_id AND discount_id IS NULL AND senior_pwd_id IS NULL AND vat_exempt IS NOT TRUE AND to_jsonb(sales)->>'financial_snapshot_version' IS NULL) THEN RAISE EXCEPTION 'Unsupported discounted source'; END IF;
 SELECT count(*),sum(applied_value) INTO n,v FROM exchange_claims WHERE exchange_id=e.exchange_id;
 IF n=0 OR v IS DISTINCT FROM e.return_value THEN RAISE EXCEPTION 'Claim total mismatch'; END IF;
 FOR r IN SELECT c.*,i.quantity AS sold,i.unit_price AS original_price,x.sale_id AS actual_sale,x.sale_item_id AS actual_item FROM exchange_claims c JOIN sale_items i USING(sale_item_id) JOIN sale_returns x USING(return_id) WHERE c.exchange_id=e.exchange_id LOOP
  IF r.sale_id<>e.root_sale_id OR r.actual_sale<>r.sale_id OR r.actual_item<>r.sale_item_id OR r.quantity>r.sold OR r.unit_price<>r.original_price THEN RAISE EXCEPTION 'Original linkage or amount mismatch'; END IF;
 END LOOP;
 SELECT count(*),sum(payable) INTO n,v FROM exchange_pricing_lines WHERE exchange_id=e.exchange_id;
 IF n=0 OR v IS DISTINCT FROM e.replacement_value THEN RAISE EXCEPTION 'Replacement total mismatch'; END IF;
 FOR r IN SELECT * FROM exchange_pricing_lines WHERE exchange_id=e.exchange_id LOOP
  IF (SELECT sum(quantity) FROM exchange_items WHERE line_id=r.line_id) IS DISTINCT FROM r.quantity::bigint OR (SELECT sum(payable) FROM exchange_items WHERE line_id=r.line_id) IS DISTINCT FROM r.payable THEN RAISE EXCEPTION 'Allocation mismatch'; END IF;
  IF EXISTS(SELECT 1 FROM exchange_items i JOIN batches b USING(batch_id) WHERE i.line_id=r.line_id AND (b.product_id<>r.product_id OR i.unit_price<>r.unit_price)) THEN RAISE EXCEPTION 'Batch consistency failure'; END IF;
 END LOOP;
 IF e.state='posted' THEN
  IF e.quote->>'policy_valid_until' IS NULL OR (e.quote->>'policy_valid_until')::timestamptz<=clock_timestamp() OR jsonb_typeof(e.quote->'clinical') IS DISTINCT FROM 'array' OR jsonb_array_length(e.quote->'clinical')=0 THEN RAISE EXCEPTION 'Verified exchange policy required'; END IF;
  FOR r IN SELECT value FROM jsonb_array_elements(e.quote->'clinical') LOOP
   IF (r.value->>'validUntil')::timestamptz<=clock_timestamp() OR NOT EXISTS(SELECT 1 FROM pharmacist_authorizations a JOIN users u ON u.user_id=a.user_id WHERE a.authorization_id=(r.value->>'authorizationId')::integer AND u.status='active' AND a.revoked_at IS NULL AND a.verified_at<=clock_timestamp() AND (a.expires_at IS NULL OR a.expires_at>clock_timestamp())) THEN RAISE EXCEPTION 'Current clinical authorization required'; END IF;
  END LOOP;
  IF NOT EXISTS(SELECT 1 FROM exchange_settlements WHERE exchange_id=e.exchange_id AND cash_due=e.additional_cash) OR NOT EXISTS(SELECT 1 FROM exchange_events WHERE exchange_id=e.exchange_id AND event_kind='posted' AND actor_id=e.initiated_by AND operation_id=e.posting_request_id) OR NOT EXISTS(SELECT 1 FROM activity_logs WHERE user_id=e.initiated_by AND module='exchanges' AND action='exchange.posted:'||e.exchange_id) THEN RAISE EXCEPTION 'Posting evidence mismatch'; END IF;
 ELSIF EXISTS(SELECT 1 FROM exchange_settlements WHERE exchange_id=e.exchange_id) THEN RAISE EXCEPTION 'Unposted cash'; END IF;
 RETURN NULL;
END $$;
CREATE FUNCTION tgp_exchange_audit_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.module='exchanges' THEN RAISE EXCEPTION 'Immutable exchange audit history'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER exchange_audit_guard BEFORE UPDATE OR DELETE ON activity_logs FOR EACH ROW EXECUTE FUNCTION tgp_exchange_audit_guard();
DO $$ DECLARE t TEXT; BEGIN
 FOREACH t IN ARRAY ARRAY['product_exchanges','exchange_claims','exchange_pricing_lines','exchange_items','exchange_settlements','exchange_events'] LOOP
  EXECUTE format('CREATE TRIGGER exchange_guard BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION tgp_exchange_guard()',t);
  EXECUTE format('CREATE CONSTRAINT TRIGGER exchange_reconcile AFTER INSERT OR UPDATE ON %I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION tgp_exchange_reconcile()',t);
 END LOOP;
END $$;
COMMIT;
