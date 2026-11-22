// Calculation interface only; NOT imported by POS. Rates/eligibility policy
// require independent statutory/accounting approval; no statutory defaults.
const invalid = () => { throw new Error('Verified benefit classification and approved calculation policy required'); };
const nonempty = x => typeof x === 'string' && x.trim().length > 0;
export function cents(value) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,11})(\.\d{1,2})?$/.test(value)) invalid();
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}
export const amount = value => `${value / 100n}.${String(value % 100n).padStart(2, '0')}`;
const rounded = (n, d) => (n + d / 2n) / d;
const bps = value => { if (!Number.isInteger(value) || value < 0 || value > 10000) invalid(); return BigInt(value); };

export function prepareBenefitQuote({ benefit, customer, items, policy }) {
  if (!['senior','pwd'].includes(benefit) || !nonempty(customer?.name) || !nonempty(customer?.id)
    || policy?.verified !== true || policy.benefit !== benefit || !nonempty(policy.version) || !nonempty(policy.source)
    || policy.rounding !== 'half_up_per_line' || typeof policy.exemptEligibleVatable !== 'boolean'
    || !Array.isArray(items) || !items.length) invalid();
  const discountBps = bps(policy.discountBps), vatBps = bps(policy.vatBps);
  const seen = new Set();
  const lines = items.map(item => {
    if (!nonempty(item.lineKey) || seen.has(item.lineKey) || !nonempty(item.name)
      || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 2147483647
      || !['eligible','ineligible'].includes(item.eligibility) || !['vatable','vat_exempt'].includes(item.tax)
      || item.benefit !== benefit || !nonempty(item.taxSource) || !nonempty(item.taxVersion)
      || !nonempty(item.classificationSource) || !nonempty(item.classificationVersion)
      || (item.tax === 'vatable' ? item.priceBasis !== 'vat_inclusive' : item.priceBasis !== 'vat_exempt')) invalid();
    seen.add(item.lineKey);
    const eligible = item.eligibility === 'eligible', gross = cents(item.unitPrice) * BigInt(item.quantity);
    const exempted = eligible && item.tax === 'vatable' && policy.exemptEligibleVatable;
    const removed = exempted ? gross - rounded(gross * 10000n, 10000n + vatBps) : 0n;
    const base = gross - removed;
    const discount = eligible ? rounded(base * discountBps, 10000n) : 0n;
    const net = base - discount;
    const taxable = item.tax === 'vatable' && !exempted;
    const vat = taxable ? net - rounded(net * 10000n, 10000n + vatBps) : 0n;
    return {
      lineKey: item.lineKey, quantity: item.quantity, unitPrice: amount(cents(item.unitPrice)),
      financialSnapshotVersion: '1', productName: item.name, genericName: item.genericName ?? null,
      taxTreatment: item.tax, benefitEligible: eligible, discountRateBps: eligible ? policy.discountBps : 0,
      vatRateBps: item.tax === 'vatable' ? policy.vatBps : 0, priceBasis: item.priceBasis,
      benefitType: benefit, taxSource: item.taxSource, taxVersion: item.taxVersion,
      classificationSource: item.classificationSource, classificationVersion: item.classificationVersion, policyVersion: policy.version,
      gross: amount(gross), vatRemoved: amount(removed), discount: amount(discount), net: amount(net),
      vatable: amount(taxable ? net - vat : 0n), exempt: amount(taxable ? 0n : net), vat: amount(vat),
    };
  });
  const totals = Object.fromEntries(['gross','vatRemoved','discount','net','vatable','exempt','vat'].map(field => [field, amount(lines.reduce((sum, line) => sum + cents(line[field]), 0n))]));
  return { financialSnapshotVersion: '1', benefit, customer: { name: customer.name.trim(), id: customer.id.trim() }, policyVersion: policy.version, policySource: policy.source, rounding: policy.rounding, lines, totals };
}
