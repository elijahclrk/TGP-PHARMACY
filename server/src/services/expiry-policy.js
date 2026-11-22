// PostgreSQL's date + interval '3 months' uses the same month-end clamp.
// Pure equivalents support boundary regression checks without a database.
export const manilaBusinessDate = (instant = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(instant);
export function threeMonthsAfter(date) {
  const [year, month, day] = date.split('-').map(Number);
  const target = new Date(0); target.setUTCFullYear(year, month - 1 + 3, 1); target.setUTCHours(0, 0, 0, 0);
  const last = new Date(target); last.setUTCMonth(last.getUTCMonth() + 1, 0);
  target.setUTCDate(Math.min(day, last.getUTCDate()));
  return target.toISOString().slice(0, 10);
}
export function expiryStatus(expiry, today) {
  if (!expiry) return 'unknown';
  if (expiry < today) return 'expired';
  if (expiry === today) return 'expiring_today';
  return expiry <= threeMonthsAfter(today) ? 'near_expiry' : 'within_date';
}
export const businessTodaySql = "(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date";
export const nearExpiryThroughSql = `(${businessTodaySql} + interval '3 months')::date`;
