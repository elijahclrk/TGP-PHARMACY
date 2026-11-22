import { test } from 'node:test';
import assert from 'node:assert/strict';
import { manilaBusinessDate, threeMonthsAfter, expiryStatus } from '../src/services/expiry-policy.js';

test('calendar-month boundaries clamp month ends and cross leap/year boundaries', () => {
  for (const [date, expected] of [['2026-01-31','2026-04-30'],['2025-11-30','2026-02-28'],['2023-11-30','2024-02-29'],['2026-11-21','2027-02-21'],['2026-12-31','2027-03-31']]) assert.equal(threeMonthsAfter(date),expected);
});
test('Manila midnight determines the business date independently of the process timezone', () => {
  assert.equal(manilaBusinessDate(new Date('2026-11-20T15:59:59.999Z')),'2026-11-20');
  assert.equal(manilaBusinessDate(new Date('2026-11-20T16:00:00Z')),'2026-11-21');
});
test('expired, today, inclusive three-month boundary and tomorrow-after-boundary are distinct', () => {
  for (const [date,status] of [[null,'unknown'],['2026-11-20','expired'],['2026-11-21','expiring_today'],['2026-11-22','near_expiry'],['2027-02-21','near_expiry'],['2027-02-22','within_date']]) assert.equal(expiryStatus(date,'2026-11-21'),status);
});
