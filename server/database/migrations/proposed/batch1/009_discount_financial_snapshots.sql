-- DESIGN ONLY. NOT APPLIED, NOT IN ANY RUNNER/ALLOWLIST.
-- Prerequisites: 001/002/004. Independent of return/adjustment activation.
-- No eligibility, VAT registration, statutory policy, or historic tax is guessed.
BEGIN;
SET LOCAL search_path = public;

ALTER TABLE products
  ADD COLUMN benefit_eligibility TEXT NOT NULL DEFAULT 'unverified'
    CHECK (benefit_eligibility IN ('unverified','eligible','ineligible')),
  ADD COLUMN tax_treatment TEXT NOT NULL DEFAULT 'unknown'
    CHECK (tax_treatment IN ('unknown','vatable','vat_exempt')),
  ADD COLUMN classification_source TEXT,
  ADD COLUMN classification_version TEXT,
  ADD COLUMN classification_reviewed_by INTEGER REFERENCES users(user_id),
  ADD COLUMN classification_reviewed_at TIMESTAMPTZ,
  ADD CONSTRAINT product_classification_evidence_ck CHECK (
    (benefit_eligibility='unverified' AND tax_treatment='unknown') OR
    (classification_source IS NOT NULL AND length(btrim(classification_source))>0
      AND classification_version IS NOT NULL AND length(btrim(classification_version))>0
      AND classification_reviewed_by IS NOT NULL AND classification_reviewed_at IS NOT NULL));

-- A shared medicine flag is not proof of eligibility under both schemes.
-- products.benefit_eligibility is advisory only; future calculations must read
-- this scheme-specific evidence AND the independently verified tax treatment.
CREATE TABLE product_benefit_classifications (
  product_id INTEGER NOT NULL REFERENCES products(product_id),
  benefit_type TEXT NOT NULL CHECK (benefit_type IN ('senior','pwd')),
  eligibility TEXT NOT NULL DEFAULT 'unverified' CHECK (eligibility IN ('unverified','eligible','ineligible')),
  source TEXT,
  version TEXT,
  reviewed_by INTEGER REFERENCES users(user_id),
  reviewed_at TIMESTAMPTZ,
  PRIMARY KEY (product_id,benefit_type),
  CHECK (eligibility='unverified' OR (source IS NOT NULL AND length(btrim(source))>0
    AND version IS NOT NULL AND length(btrim(version))>0 AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);

ALTER TABLE sales
  ADD COLUMN financial_snapshot_version TEXT,
  ADD COLUMN snapshot_transaction xid8,
  ADD COLUMN customer_name TEXT,
  ADD COLUMN benefit_type TEXT CHECK (benefit_type IN ('regular','senior','pwd')),
  ADD COLUMN policy_version TEXT,
  ADD COLUMN policy_source_snapshot TEXT,
  ADD COLUMN gross_amount NUMERIC,
  ADD COLUMN vat_removed_amount NUMERIC,
  ADD COLUMN discount_amount NUMERIC,
  ADD COLUMN vatable_amount NUMERIC,
  ADD COLUMN vat_exempt_amount NUMERIC,
  ADD COLUMN vat_amount NUMERIC,
  ADD CONSTRAINT sale_financial_snapshot_ck CHECK (financial_snapshot_version IS NULL OR (
    length(btrim(financial_snapshot_version))>0 AND snapshot_transaction IS NOT NULL AND benefit_type IS NOT NULL
    AND policy_version IS NOT NULL AND length(btrim(policy_version))>0
    AND policy_source_snapshot IS NOT NULL AND length(btrim(policy_source_snapshot))>0
    AND receipt_no IS NOT NULL AND length(btrim(receipt_no))>0 AND sale_date IS NOT NULL
    AND gross_amount IS NOT NULL AND gross_amount>=0 AND gross_amount<'Infinity'::numeric
    AND vat_removed_amount IS NOT NULL AND vat_removed_amount>=0 AND vat_removed_amount<'Infinity'::numeric
    AND discount_amount IS NOT NULL AND discount_amount>=0 AND discount_amount<'Infinity'::numeric
    AND vatable_amount IS NOT NULL AND vatable_amount>=0 AND vatable_amount<'Infinity'::numeric
    AND vat_exempt_amount IS NOT NULL AND vat_exempt_amount>=0 AND vat_exempt_amount<'Infinity'::numeric
    AND vat_amount IS NOT NULL AND vat_amount>=0 AND vat_amount<'Infinity'::numeric
    AND total_amount IS NOT NULL AND total_amount=gross_amount-vat_removed_amount-discount_amount
    AND total_amount=vatable_amount+vat_exempt_amount+vat_amount
    AND ((benefit_type='regular' AND discount_id IS NULL AND senior_pwd_id IS NULL
          AND discount_amount=0 AND vat_removed_amount=0) OR
      (benefit_type IN ('senior','pwd') AND discount_id IS NOT NULL AND senior_pwd_id IS NOT NULL
        AND length(btrim(senior_pwd_id))>0 AND customer_name IS NOT NULL AND length(btrim(customer_name))>0
        ))
  )) NOT VALID;

ALTER TABLE sale_items
  ADD COLUMN financial_snapshot_version TEXT,
  ADD COLUMN product_name_snapshot TEXT,
  ADD COLUMN generic_name_snapshot TEXT,
  ADD COLUMN tax_treatment_snapshot TEXT CHECK (tax_treatment_snapshot IN ('vatable','vat_exempt')),
  ADD COLUMN benefit_eligible_snapshot BOOLEAN,
  ADD COLUMN discount_rate_snapshot NUMERIC,
  ADD COLUMN vat_rate_snapshot NUMERIC,
  ADD COLUMN price_basis_snapshot TEXT,
  ADD COLUMN eligibility_source_snapshot TEXT,
  ADD COLUMN eligibility_version_snapshot TEXT,
  ADD COLUMN policy_version_snapshot TEXT,
  ADD COLUMN benefit_type_snapshot TEXT CHECK (benefit_type_snapshot IN ('regular','senior','pwd')),
  ADD COLUMN tax_source_snapshot TEXT,
  ADD COLUMN tax_version_snapshot TEXT,
  ADD COLUMN gross_line_amount NUMERIC,
  ADD COLUMN vat_removed_line_amount NUMERIC,
  ADD COLUMN discount_line_amount NUMERIC,
  ADD COLUMN net_line_amount NUMERIC,
  ADD COLUMN vatable_line_amount NUMERIC,
  ADD COLUMN vat_exempt_line_amount NUMERIC,
  ADD COLUMN vat_line_amount NUMERIC,
  ADD CONSTRAINT sale_item_financial_snapshot_ck CHECK (financial_snapshot_version IS NULL OR (
    length(btrim(financial_snapshot_version))>0 AND product_name_snapshot IS NOT NULL AND length(btrim(product_name_snapshot))>0
    AND quantity IS NOT NULL AND quantity>0 AND unit_price IS NOT NULL AND unit_price>=0 AND unit_price<'Infinity'::numeric
    AND unit_price=round(unit_price,2) AND gross_line_amount=quantity::numeric*unit_price
    AND price_basis_snapshot IS NOT NULL AND price_basis_snapshot IN ('vat_inclusive','vat_exempt')
    AND vat_rate_snapshot IS NOT NULL AND vat_rate_snapshot>=0 AND vat_rate_snapshot<=1
    AND eligibility_source_snapshot IS NOT NULL AND length(btrim(eligibility_source_snapshot))>0
    AND eligibility_version_snapshot IS NOT NULL AND length(btrim(eligibility_version_snapshot))>0
    AND policy_version_snapshot IS NOT NULL AND length(btrim(policy_version_snapshot))>0
    AND benefit_type_snapshot IS NOT NULL
    AND tax_source_snapshot IS NOT NULL AND length(btrim(tax_source_snapshot))>0
    AND tax_version_snapshot IS NOT NULL AND length(btrim(tax_version_snapshot))>0
    AND tax_treatment_snapshot IS NOT NULL AND benefit_eligible_snapshot IS NOT NULL
    AND ((tax_treatment_snapshot='vatable' AND price_basis_snapshot='vat_inclusive') OR
      (tax_treatment_snapshot='vat_exempt' AND price_basis_snapshot='vat_exempt' AND vat_rate_snapshot=0 AND vat_line_amount=0 AND vat_removed_line_amount=0))
    AND discount_rate_snapshot IS NOT NULL AND discount_rate_snapshot>=0 AND discount_rate_snapshot<=1
    AND gross_line_amount IS NOT NULL AND gross_line_amount>=0 AND gross_line_amount<'Infinity'::numeric
    AND vat_removed_line_amount IS NOT NULL AND vat_removed_line_amount>=0 AND vat_removed_line_amount<'Infinity'::numeric
    AND discount_line_amount IS NOT NULL AND discount_line_amount>=0 AND discount_line_amount<'Infinity'::numeric
    AND net_line_amount IS NOT NULL AND net_line_amount>=0 AND net_line_amount<'Infinity'::numeric
    AND vatable_line_amount IS NOT NULL AND vatable_line_amount>=0 AND vatable_line_amount<'Infinity'::numeric
    AND vat_exempt_line_amount IS NOT NULL AND vat_exempt_line_amount>=0 AND vat_exempt_line_amount<'Infinity'::numeric
    AND vat_line_amount IS NOT NULL AND vat_line_amount>=0 AND vat_line_amount<'Infinity'::numeric
    AND net_line_amount=gross_line_amount-vat_removed_line_amount-discount_line_amount
    AND net_line_amount=vatable_line_amount+vat_exempt_line_amount+vat_line_amount
    AND (benefit_eligible_snapshot OR (discount_rate_snapshot=0 AND discount_line_amount=0 AND vat_removed_line_amount=0))
  )) NOT VALID;

-- Unconstrained NUMERIC + equality rejects excess precision rather than
-- silently rounding input with NUMERIC(p,2). Existing legacy values untouched.
ALTER TABLE sales ADD CONSTRAINT sale_snapshot_cent_precision_ck CHECK (financial_snapshot_version IS NULL OR (
  gross_amount=round(gross_amount,2) AND vat_removed_amount=round(vat_removed_amount,2)
  AND discount_amount=round(discount_amount,2) AND vatable_amount=round(vatable_amount,2)
  AND vat_exempt_amount=round(vat_exempt_amount,2) AND vat_amount=round(vat_amount,2)
  AND total_amount=round(total_amount,2))) NOT VALID;
ALTER TABLE sale_items ADD CONSTRAINT item_snapshot_cent_precision_ck CHECK (financial_snapshot_version IS NULL OR (
  gross_line_amount=round(gross_line_amount,2) AND vat_removed_line_amount=round(vat_removed_line_amount,2)
  AND discount_line_amount=round(discount_line_amount,2) AND net_line_amount=round(net_line_amount,2)
  AND vatable_line_amount=round(vatable_line_amount,2) AND vat_exempt_line_amount=round(vat_exempt_line_amount,2)
  AND vat_line_amount=round(vat_line_amount,2))) NOT VALID;

CREATE FUNCTION tgp_financial_snapshot_write() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP<>'INSERT' THEN
    IF OLD.financial_snapshot_version IS NOT NULL THEN
      IF TG_TABLE_NAME='sales' AND TG_OP='UPDATE' AND
        (to_jsonb(NEW)-'approved_by') IS NOT DISTINCT FROM (to_jsonb(OLD)-'approved_by') THEN RETURN NEW; END IF;
      RAISE EXCEPTION 'Financial snapshots are immutable';
    END IF;
    IF TG_OP='DELETE' THEN RETURN OLD; END IF;
    IF NEW.financial_snapshot_version IS NOT NULL THEN RAISE EXCEPTION 'Historical snapshot backfill requires separate review'; END IF;
  END IF;
  IF TG_TABLE_NAME='sales' THEN
    IF TG_OP='INSERT' AND NEW.financial_snapshot_version IS NOT NULL THEN NEW.snapshot_transaction:=pg_current_xact_id(); END IF;
    IF NEW.financial_snapshot_version IS NULL AND (
      NEW.discount_id IS NOT NULL OR NEW.senior_pwd_id IS NOT NULL OR NEW.vat_exempt IS TRUE OR
      NEW.benefit_type IS NOT NULL OR NEW.customer_name IS NOT NULL OR NEW.snapshot_transaction IS NOT NULL
      OR NEW.policy_version IS NOT NULL OR NEW.policy_source_snapshot IS NOT NULL OR NEW.gross_amount IS NOT NULL
      OR NEW.vat_removed_amount IS NOT NULL OR NEW.discount_amount IS NOT NULL OR NEW.vatable_amount IS NOT NULL
      OR NEW.vat_exempt_amount IS NOT NULL OR NEW.vat_amount IS NOT NULL
    ) AND (TG_OP='INSERT' OR (to_jsonb(NEW)-'approved_by') IS DISTINCT FROM (to_jsonb(OLD)-'approved_by')) THEN
      RAISE EXCEPTION 'Discounted writes require complete financial snapshots';
    END IF;
  ELSE
    IF NEW.financial_snapshot_version IS NULL AND jsonb_strip_nulls(to_jsonb(NEW)) ?| ARRAY[
      'product_name_snapshot','generic_name_snapshot','tax_treatment_snapshot','benefit_eligible_snapshot',
      'discount_rate_snapshot','vat_rate_snapshot','price_basis_snapshot','eligibility_source_snapshot',
      'eligibility_version_snapshot','policy_version_snapshot','benefit_type_snapshot','tax_source_snapshot','tax_version_snapshot',
      'gross_line_amount','vat_removed_line_amount','discount_line_amount','net_line_amount',
      'vatable_line_amount','vat_exempt_line_amount','vat_line_amount'] THEN
      RAISE EXCEPTION 'Partial financial line requires complete versioned snapshot';
    END IF;
    -- Adding/deleting legacy lines under a versioned sale is also forbidden.
    -- Versioned lines may only be inserted with a header created in this same
    -- transaction, not appended to an already completed receipt later.
    IF EXISTS (SELECT 1 FROM sales WHERE sale_id=NEW.sale_id AND financial_snapshot_version IS NOT NULL
        AND snapshot_transaction IS DISTINCT FROM pg_current_xact_id()) THEN
      RAISE EXCEPTION 'Completed financial receipt cannot receive new lines';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER sale_snapshot_write BEFORE INSERT OR UPDATE OR DELETE ON sales
  FOR EACH ROW EXECUTE FUNCTION tgp_financial_snapshot_write();
CREATE TRIGGER item_snapshot_write BEFORE INSERT OR UPDATE OR DELETE ON sale_items
  FOR EACH ROW EXECUTE FUNCTION tgp_financial_snapshot_write();

CREATE FUNCTION tgp_financial_reconciliation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s sales%ROWTYPE; totals RECORD; sid INTEGER;
BEGIN
  sid:=CASE WHEN TG_OP='DELETE' THEN OLD.sale_id ELSE NEW.sale_id END;
  SELECT * INTO s FROM sales WHERE sale_id=sid;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF s.financial_snapshot_version IS NULL THEN
    IF EXISTS (SELECT 1 FROM sale_items WHERE sale_id=sid AND financial_snapshot_version IS NOT NULL) THEN
      RAISE EXCEPTION 'Versioned lines require a versioned header';
    END IF;
    RETURN NULL;
  END IF;
  SELECT count(*) AS n, count(*) FILTER (WHERE financial_snapshot_version IS DISTINCT FROM s.financial_snapshot_version
      OR policy_version_snapshot IS DISTINCT FROM s.policy_version OR benefit_type_snapshot IS DISTINCT FROM s.benefit_type) AS mismatches,
    sum(gross_line_amount) AS gross, sum(vat_removed_line_amount) AS removed, sum(discount_line_amount) AS discount,
    sum(net_line_amount) AS net, sum(vatable_line_amount) AS taxable, sum(vat_exempt_line_amount) AS exempt, sum(vat_line_amount) AS vat
    INTO totals FROM sale_items WHERE sale_id=sid;
  IF totals.n=0 OR totals.mismatches<>0 OR totals.gross IS DISTINCT FROM s.gross_amount
    OR totals.removed IS DISTINCT FROM s.vat_removed_amount OR totals.discount IS DISTINCT FROM s.discount_amount
    OR totals.net IS DISTINCT FROM s.total_amount OR totals.taxable IS DISTINCT FROM s.vatable_amount
    OR totals.exempt IS DISTINCT FROM s.vat_exempt_amount OR totals.vat IS DISTINCT FROM s.vat_amount THEN
    RAISE EXCEPTION 'Financial header/line reconciliation failed';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER sale_snapshot_reconciliation AFTER INSERT OR UPDATE ON sales
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION tgp_financial_reconciliation();
CREATE CONSTRAINT TRIGGER item_snapshot_reconciliation AFTER INSERT OR UPDATE OR DELETE ON sale_items
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION tgp_financial_reconciliation();

-- Existing unit_price remains the original regular sale-time unit price.
-- Future report code must sum net_line_amount for snapshot-versioned sales,
-- while preserving the existing regular-sale fallback for legacy records.
-- Mixed baskets must snapshot each item's classification; the historical
-- vat_exempt header flag does NOT imply every medicine is VAT-exempt.
-- Customer name/ID must never enter general audit payloads.
COMMIT;
