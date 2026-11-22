-- Additive successor to 009. LOCAL TEST CONTRACT ONLY, no production activation.
-- Dependencies 001/002/004/009. Never changes historical migration bytes.
BEGIN;
SET LOCAL search_path = public;
CREATE TABLE benefit_policies (
 policy_id INTEGER PRIMARY KEY, benefit_type TEXT NOT NULL CHECK(benefit_type IN ('senior','pwd')),
 version TEXT NOT NULL UNIQUE CHECK(length(btrim(version))>0), payload JSONB NOT NULL,
 reviewed_by INTEGER NOT NULL REFERENCES users(user_id), reviewed_at TIMESTAMPTZ NOT NULL,
 active BOOLEAN NOT NULL DEFAULT FALSE, test_only BOOLEAN NOT NULL CHECK(test_only),
 CHECK(COALESCE(payload->>'testOnly'='true' AND payload->>'rounding'='half_up_product_line_v1'
 AND payload->>'vatStatus' IN ('vat_registered','non_vat') AND payload->>'discountBps'='2000'
 AND payload->>'vatBps'='1200' AND payload->>'fiscalInvoice'='false',false))
);
CREATE UNIQUE INDEX benefit_policy_active_scheme ON benefit_policies(benefit_type) WHERE active;
CREATE TABLE benefit_product_versions (
 version_id UUID PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(product_id),
 benefit_type TEXT NOT NULL CHECK(benefit_type IN ('senior','pwd')),
 version TEXT NOT NULL CHECK(length(btrim(version))>0),
 eligibility TEXT NOT NULL CHECK(eligibility IN ('eligible','ineligible')),
 tax TEXT NOT NULL CHECK(tax IN ('vatable','vat_exempt')),
 price_basis TEXT NOT NULL CHECK(price_basis IN ('vat_inclusive','vat_exempt','non_vat')),
 prescription_required BOOLEAN NOT NULL, promotion_state TEXT NOT NULL CHECK(promotion_state='none'),
 source TEXT NOT NULL CHECK(length(btrim(source))>0),
 reviewed_by INTEGER NOT NULL REFERENCES users(user_id), reviewed_at TIMESTAMPTZ NOT NULL,
 valid_from TIMESTAMPTZ NOT NULL, valid_until TIMESTAMPTZ NOT NULL CHECK(valid_until>valid_from),
 active BOOLEAN NOT NULL DEFAULT FALSE, UNIQUE(product_id,benefit_type,version)
);
CREATE UNIQUE INDEX benefit_product_active_scheme ON benefit_product_versions(product_id,benefit_type) WHERE active;
CREATE TABLE benefit_verifications (
 verification_id UUID PRIMARY KEY, actor_id INTEGER NOT NULL REFERENCES users(user_id),
 policy_id INTEGER NOT NULL REFERENCES benefit_policies(policy_id), benefit_type TEXT NOT NULL CHECK(benefit_type IN ('senior','pwd')),
 customer_name TEXT NOT NULL CHECK(length(btrim(customer_name)) BETWEEN 1 AND 200),
 customer_id TEXT NOT NULL CHECK(length(btrim(customer_id)) BETWEEN 1 AND 100),
 document_snapshot JSONB NOT NULL CHECK(COALESCE(jsonb_typeof(document_snapshot)='object'
  AND document_snapshot->'documents'->>'identitySeen'='true' AND document_snapshot->'documents'->>'entitlementConfirmed'='true'
  AND document_snapshot->'documents'->>'exclusiveUse'='true'
  AND (benefit_type<>'pwd' OR document_snapshot->'documents'->>'bookletSeen'='true'),false)),
 cart JSONB NOT NULL CHECK(jsonb_typeof(cart)='array' AND jsonb_array_length(cart)>0), verified_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 expires_at TIMESTAMPTZ NOT NULL CHECK(expires_at>verified_at)
);
CREATE TABLE benefit_prescription_fills (
 sale_id INTEGER NOT NULL REFERENCES sales(sale_id), product_id INTEGER NOT NULL REFERENCES products(product_id),
 beneficiary_digest TEXT NOT NULL, prescription_ref TEXT NOT NULL CHECK(length(btrim(prescription_ref))>0),
 quantity INTEGER NOT NULL CHECK(quantity>0), PRIMARY KEY(sale_id,product_id)
);
CREATE TABLE sale_pricing_lines (
 sale_id INTEGER NOT NULL REFERENCES sales(sale_id), product_id INTEGER NOT NULL REFERENCES products(product_id),
 payload JSONB NOT NULL, PRIMARY KEY(sale_id,product_id)
);
ALTER TABLE sales ADD COLUMN benefit_policy_id INTEGER REFERENCES benefit_policies(policy_id),
 ADD COLUMN benefit_verification_id UUID UNIQUE REFERENCES benefit_verifications(verification_id),
 ADD COLUMN benefit_request_digest TEXT, ADD COLUMN branch_vat_status_snapshot TEXT,
 ADD COLUMN non_vat_amount NUMERIC;
ALTER TABLE sale_items ADD COLUMN pricing_product_id INTEGER,
 ADD COLUMN batch_no_snapshot TEXT, ADD COLUMN expiry_date_snapshot DATE, ADD COLUMN category_snapshot TEXT,
 ADD COLUMN non_vat_line_amount NUMERIC,
 ADD CONSTRAINT benefit_logical_line_fk FOREIGN KEY(sale_id,pricing_product_id) REFERENCES sale_pricing_lines(sale_id,product_id);
ALTER TABLE sales ADD CONSTRAINT benefit_header_extension_ck CHECK(financial_snapshot_version IS NOT DISTINCT FROM '2' OR
 (benefit_policy_id IS NULL AND benefit_verification_id IS NULL AND benefit_request_digest IS NULL AND branch_vat_status_snapshot IS NULL AND non_vat_amount IS NULL));
ALTER TABLE sale_items ADD CONSTRAINT benefit_item_extension_ck CHECK(financial_snapshot_version IS NOT DISTINCT FROM '2' OR
 (pricing_product_id IS NULL AND batch_no_snapshot IS NULL AND expiry_date_snapshot IS NULL AND category_snapshot IS NULL AND non_vat_line_amount IS NULL));

CREATE FUNCTION tgp_benefit_money(value TEXT) RETURNS BOOLEAN LANGUAGE sql IMMUTABLE AS $$
 SELECT COALESCE(value::numeric>=0 AND value::numeric<'Infinity'::numeric AND value::numeric=round(value::numeric,2)
 AND value::numeric<1000000000000,false)
$$;
CREATE FUNCTION tgp_benefit_header(j JSONB) RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE k TEXT;
BEGIN
 FOREACH k IN ARRAY ARRAY['total_amount','gross_amount','vat_removed_amount','discount_amount','vatable_amount','vat_exempt_amount','vat_amount','non_vat_amount'] LOOP
  IF NOT tgp_benefit_money(j->>k) THEN RETURN FALSE; END IF;
 END LOOP;
 RETURN COALESCE(j->>'financial_snapshot_version'='2' AND j->>'benefit_type' IN ('senior','pwd')
 AND length(btrim(j->>'customer_name'))>0 AND length(btrim(j->>'senior_pwd_id'))>0
 AND j->>'benefit_policy_id' IS NOT NULL AND j->>'benefit_verification_id' IS NOT NULL
 AND j->>'benefit_request_digest' ~ '^[0-9a-f]{64}$' AND length(btrim(j->>'policy_version'))>0
 AND length(btrim(j->>'policy_source_snapshot'))>0 AND j->>'snapshot_transaction' IS NOT NULL
 AND j->>'receipt_no' IS NOT NULL AND j->>'sale_date' IS NOT NULL AND j->>'discount_id' IS NOT NULL
 AND j->>'branch_vat_status_snapshot' IN ('vat_registered','non_vat')
 AND (j->>'total_amount')::numeric=(j->>'gross_amount')::numeric-(j->>'vat_removed_amount')::numeric-(j->>'discount_amount')::numeric
 AND (j->>'total_amount')::numeric=(j->>'vatable_amount')::numeric+(j->>'vat_exempt_amount')::numeric+(j->>'vat_amount')::numeric+(j->>'non_vat_amount')::numeric
 AND (j->>'branch_vat_status_snapshot'<>'non_vat' OR ((j->>'vat_amount')::numeric=0 AND (j->>'vat_removed_amount')::numeric=0)),false);
END $$;
CREATE FUNCTION tgp_benefit_item(j JSONB) RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE k TEXT;
BEGIN
 FOREACH k IN ARRAY ARRAY['unit_price','gross_line_amount','vat_removed_line_amount','discount_line_amount','net_line_amount','vatable_line_amount','vat_exempt_line_amount','vat_line_amount','non_vat_line_amount'] LOOP
  IF NOT tgp_benefit_money(j->>k) THEN RETURN FALSE; END IF;
 END LOOP;
 RETURN COALESCE((j->>'quantity')::int>0 AND j->>'pricing_product_id' IS NOT NULL
 AND j->>'financial_snapshot_version'='2' AND length(btrim(j->>'product_name_snapshot'))>0
 AND j->>'tax_treatment_snapshot' IN ('vatable','vat_exempt')
 AND j->>'price_basis_snapshot' IN ('vat_inclusive','vat_exempt','non_vat')
 AND j->>'benefit_eligible_snapshot' IN ('true','false')
 AND (j->>'discount_rate_snapshot')::numeric BETWEEN 0 AND 1 AND (j->>'vat_rate_snapshot')::numeric BETWEEN 0 AND 1
 AND j->>'benefit_type_snapshot' IN ('senior','pwd') AND length(btrim(j->>'policy_version_snapshot'))>0
 AND length(btrim(j->>'eligibility_source_snapshot'))>0 AND length(btrim(j->>'eligibility_version_snapshot'))>0
 AND length(btrim(j->>'tax_source_snapshot'))>0 AND length(btrim(j->>'tax_version_snapshot'))>0
 AND j->>'expiry_date_snapshot' IS NOT NULL AND length(btrim(j->>'batch_no_snapshot'))>0
 AND (j->>'gross_line_amount')::numeric=(j->>'unit_price')::numeric*(j->>'quantity')::int
 AND (j->>'net_line_amount')::numeric=(j->>'gross_line_amount')::numeric-(j->>'vat_removed_line_amount')::numeric-(j->>'discount_line_amount')::numeric
 AND (j->>'net_line_amount')::numeric=(j->>'vatable_line_amount')::numeric+(j->>'vat_exempt_line_amount')::numeric+(j->>'vat_line_amount')::numeric+(j->>'non_vat_line_amount')::numeric
 AND ((j->>'benefit_eligible_snapshot')::boolean OR ((j->>'discount_line_amount')::numeric=0 AND (j->>'vat_removed_line_amount')::numeric=0 AND (j->>'discount_rate_snapshot')::numeric=0)),false);
END $$;
-- Keep the exact original checks for legacy/version1; widen only new version2.
DO $$ DECLARE n TEXT; tab TEXT; oldcheck TEXT; fn TEXT;
BEGIN
 FOREACH tab IN ARRAY ARRAY['sales','sale_items'] LOOP
  n:=CASE WHEN tab='sales' THEN 'sale_financial_snapshot_ck' ELSE 'sale_item_financial_snapshot_ck' END;
  fn:=CASE WHEN tab='sales' THEN 'tgp_benefit_header' ELSE 'tgp_benefit_item' END;
  SELECT regexp_replace(regexp_replace(pg_get_constraintdef(oid),'^CHECK ',''),' NOT VALID$','') INTO oldcheck
   FROM pg_constraint WHERE conrelid=tab::regclass AND conname=n;
  IF oldcheck IS NULL THEN RAISE EXCEPTION 'Required 009 constraint absent'; END IF;
  EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I',tab,n);
  EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK (CASE WHEN financial_snapshot_version=''2'' THEN %s(to_jsonb(%I)) ELSE %s END) NOT VALID',tab,n,fn,tab,oldcheck);
 END LOOP;
END $$;
CREATE FUNCTION tgp_benefit_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME IN ('benefit_policies','benefit_product_versions') AND TG_OP='UPDATE'
 AND (to_jsonb(NEW)-'active') IS NOT DISTINCT FROM (to_jsonb(OLD)-'active') THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'Completed benefit evidence is immutable';
END $$;
CREATE TRIGGER benefit_policy_immutable BEFORE UPDATE OR DELETE ON benefit_policies FOR EACH ROW EXECUTE FUNCTION tgp_benefit_immutable();
CREATE TRIGGER benefit_product_immutable BEFORE UPDATE OR DELETE ON benefit_product_versions FOR EACH ROW EXECUTE FUNCTION tgp_benefit_immutable();
CREATE TRIGGER benefit_verification_immutable BEFORE UPDATE OR DELETE ON benefit_verifications FOR EACH ROW EXECUTE FUNCTION tgp_benefit_immutable();
CREATE TRIGGER benefit_logical_immutable BEFORE UPDATE OR DELETE ON sale_pricing_lines FOR EACH ROW EXECUTE FUNCTION tgp_benefit_immutable();
CREATE TRIGGER benefit_fill_immutable BEFORE UPDATE OR DELETE ON benefit_prescription_fills FOR EACH ROW EXECUTE FUNCTION tgp_benefit_immutable();

CREATE FUNCTION tgp_benefit_reconcile() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE sid INTEGER; s sales%ROWTYPE; v benefit_verifications%ROWTYPE; p benefit_policies%ROWTYPE; m benefit_product_versions%ROWTYPE; l RECORD; logical RECORD; k TEXT; col TEXT; a NUMERIC; b NUMERIC; gross NUMERIC; base NUMERIC; removed NUMERIC; reduction NUMERIC; payable NUMERIC; taxable NUMERIC; exempt NUMERIC; vat NUMERIC; nonvat NUMERIC;
BEGIN
 sid:=COALESCE((to_jsonb(NEW)->>'sale_id')::int,(to_jsonb(OLD)->>'sale_id')::int);
 SELECT * INTO s FROM sales WHERE sale_id=sid;
 IF NOT FOUND OR s.financial_snapshot_version IS DISTINCT FROM '2' THEN RETURN NULL; END IF;
 SELECT * INTO v FROM benefit_verifications WHERE verification_id=s.benefit_verification_id;
 SELECT * INTO p FROM benefit_policies WHERE policy_id=s.benefit_policy_id;
 IF v.actor_id IS DISTINCT FROM s.user_id OR v.policy_id IS DISTINCT FROM p.policy_id OR v.benefit_type IS DISTINCT FROM s.benefit_type
 OR v.customer_name IS DISTINCT FROM s.customer_name OR v.customer_id IS DISTINCT FROM s.senior_pwd_id
 OR p.benefit_type IS DISTINCT FROM s.benefit_type OR p.version IS DISTINCT FROM s.policy_version
 OR p.payload->>'source' IS DISTINCT FROM s.policy_source_snapshot
 OR p.payload->>'vatStatus' IS DISTINCT FROM s.branch_vat_status_snapshot
 OR NOT EXISTS(SELECT 1 FROM discounts WHERE discount_id=s.discount_id AND type=s.benefit_type)
 THEN RAISE EXCEPTION 'Benefit identity/policy mismatch'; END IF;
 IF (SELECT count(*) FROM payments WHERE sale_id=sid)<>1 OR NOT EXISTS(
 SELECT 1 FROM payments WHERE sale_id=sid AND method='cash' AND tgp_benefit_money(amount_paid::text) AND tgp_benefit_money(change_due::text)
 AND amount_paid-change_due=s.total_amount) OR NOT EXISTS(SELECT 1 FROM activity_logs WHERE user_id=s.user_id AND module='POS' AND action='sale.paid:'||sid)
 THEN RAISE EXCEPTION 'Benefit payment/audit reconciliation failed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM sale_pricing_lines WHERE sale_id=sid) THEN RAISE EXCEPTION 'Logical benefit lines absent'; END IF;
 FOR logical IN SELECT * FROM sale_pricing_lines WHERE sale_id=sid LOOP
  SELECT * INTO m FROM benefit_product_versions WHERE product_id=logical.product_id AND benefit_type=s.benefit_type AND version=logical.payload->>'classificationVersion';
  IF NOT FOUND OR (logical.payload->>'benefitEligible')::boolean IS DISTINCT FROM (m.eligibility='eligible')
   OR logical.payload->>'priceBasis' IS DISTINCT FROM m.price_basis OR logical.payload->>'taxTreatment' IS DISTINCT FROM m.tax
   OR logical.payload->>'classificationSource' IS DISTINCT FROM m.source OR logical.payload->>'policyVersion' IS DISTINCT FROM p.version
   OR logical.payload->>'taxSource' IS DISTINCT FROM m.source OR logical.payload->>'taxVersion' IS DISTINCT FROM m.version
   OR logical.payload->>'benefitType' IS DISTINCT FROM s.benefit_type
  THEN RAISE EXCEPTION 'Benefit classification evidence mismatch'; END IF;
  gross:=(logical.payload->>'quantity')::int*(logical.payload->>'unitPrice')::numeric;
  base:=CASE WHEN s.branch_vat_status_snapshot='vat_registered' AND m.tax='vatable' AND m.eligibility='eligible' THEN round(gross/1.12,2) ELSE gross END;
  removed:=gross-base;reduction:=CASE WHEN m.eligibility='eligible' THEN round(base*0.2,2) ELSE 0 END;payable:=base-reduction;
  taxable:=0;exempt:=0;vat:=0;nonvat:=0;
  IF s.branch_vat_status_snapshot='non_vat' THEN nonvat:=payable;
  ELSIF m.tax='vatable' AND m.eligibility='ineligible' THEN taxable:=round(payable/1.12,2);vat:=payable-taxable;
  ELSE exempt:=payable; END IF;
  IF (logical.payload->>'gross')::numeric IS DISTINCT FROM gross OR (logical.payload->>'vatRemoved')::numeric IS DISTINCT FROM removed
  OR (logical.payload->>'discount')::numeric IS DISTINCT FROM reduction OR (logical.payload->>'net')::numeric IS DISTINCT FROM payable
  OR (logical.payload->>'vatable')::numeric IS DISTINCT FROM taxable OR (logical.payload->>'exempt')::numeric IS DISTINCT FROM exempt
  OR (logical.payload->>'vat')::numeric IS DISTINCT FROM vat OR (logical.payload->>'nonVat')::numeric IS DISTINCT FROM nonvat
  THEN RAISE EXCEPTION 'Benefit approved calculation mismatch'; END IF;
  SELECT count(*) AS n,sum(quantity) AS qty,sum(quantity*unit_price) AS gross INTO l FROM sale_items WHERE sale_id=sid AND pricing_product_id=logical.product_id;
  IF l.n=0 OR l.qty IS DISTINCT FROM (logical.payload->>'quantity')::numeric OR l.gross IS DISTINCT FROM (logical.payload->>'gross')::numeric
   OR EXISTS(SELECT 1 FROM sale_items i JOIN batches b USING(batch_id) WHERE i.sale_id=sid AND i.pricing_product_id=logical.product_id AND
    (b.product_id<>logical.product_id OR i.unit_price IS DISTINCT FROM (logical.payload->>'unitPrice')::numeric
     OR i.discount_rate_snapshot IS DISTINCT FROM CASE WHEN m.eligibility='eligible' THEN 0.2 ELSE 0 END
     OR i.vat_rate_snapshot IS DISTINCT FROM CASE WHEN s.branch_vat_status_snapshot='vat_registered' AND m.tax='vatable' THEN 0.12 ELSE 0 END
     OR i.tax_source_snapshot IS DISTINCT FROM m.source OR i.tax_version_snapshot IS DISTINCT FROM m.version
     OR i.benefit_eligible_snapshot IS DISTINCT FROM (m.eligibility='eligible') OR i.price_basis_snapshot IS DISTINCT FROM m.price_basis
     OR i.tax_treatment_snapshot IS DISTINCT FROM m.tax OR i.eligibility_version_snapshot IS DISTINCT FROM m.version
     OR i.eligibility_source_snapshot IS DISTINCT FROM m.source))
  THEN RAISE EXCEPTION 'Benefit logical/batch mismatch'; END IF;
  FOR k,col IN SELECT * FROM (VALUES('vatRemoved','vat_removed_line_amount'),('discount','discount_line_amount'),('net','net_line_amount'),('vatable','vatable_line_amount'),('exempt','vat_exempt_line_amount'),('vat','vat_line_amount'),('nonVat','non_vat_line_amount')) AS fields(k,col) LOOP
   EXECUTE format('SELECT sum(%I) FROM sale_items WHERE sale_id=$1 AND pricing_product_id=$2',col) INTO a USING sid,logical.product_id;
   IF a IS DISTINCT FROM (logical.payload->>k)::numeric THEN RAISE EXCEPTION 'Benefit allocation mismatch'; END IF;
  END LOOP;
 END LOOP;
 SELECT sum(non_vat_line_amount) INTO a FROM sale_items WHERE sale_id=sid;
 IF a IS DISTINCT FROM s.non_vat_amount THEN RAISE EXCEPTION 'Non-VAT reconciliation failed'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER benefit_sale_reconcile AFTER INSERT OR UPDATE ON sales DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION tgp_benefit_reconcile();
CREATE CONSTRAINT TRIGGER benefit_item_reconcile AFTER INSERT OR UPDATE OR DELETE ON sale_items DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION tgp_benefit_reconcile();
CREATE CONSTRAINT TRIGGER benefit_logical_reconcile AFTER INSERT OR UPDATE OR DELETE ON sale_pricing_lines DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION tgp_benefit_reconcile();
CREATE CONSTRAINT TRIGGER benefit_payment_reconcile AFTER INSERT OR UPDATE OR DELETE ON payments DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION tgp_benefit_reconcile();
CREATE FUNCTION tgp_benefit_payment_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE sid INTEGER; s sales%ROWTYPE;
BEGIN
 FOR sid IN SELECT DISTINCT x FROM unnest(ARRAY[(to_jsonb(NEW)->>'sale_id')::int,(to_jsonb(OLD)->>'sale_id')::int]) AS ids(x) WHERE x IS NOT NULL LOOP
  SELECT * INTO s FROM sales WHERE sale_id=sid;
  IF s.financial_snapshot_version='2' AND s.snapshot_transaction IS DISTINCT FROM pg_current_xact_id() THEN RAISE EXCEPTION 'Completed benefit payment/lines immutable'; END IF;
 END LOOP;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER benefit_payment_guard BEFORE INSERT OR UPDATE OR DELETE ON payments FOR EACH ROW EXECUTE FUNCTION tgp_benefit_payment_guard();
CREATE TRIGGER benefit_logical_guard BEFORE INSERT ON sale_pricing_lines FOR EACH ROW EXECUTE FUNCTION tgp_benefit_payment_guard();
CREATE FUNCTION tgp_benefit_audit_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.module='POS' AND EXISTS(SELECT 1 FROM sales WHERE financial_snapshot_version='2' AND OLD.action='sale.paid:'||sale_id)
 THEN RAISE EXCEPTION 'Completed benefit audit immutable'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER benefit_audit_guard BEFORE UPDATE OR DELETE ON activity_logs FOR EACH ROW EXECUTE FUNCTION tgp_benefit_audit_guard();
COMMIT;
