import {test} from 'node:test';
import assert from 'node:assert/strict';
import {salesReportQuery} from '../src/services/report-validation.js';
test('report dates reject invalid calendars, reversed/unbounded ranges and extra authority fields',()=>{
  assert(salesReportQuery.safeParse({from:'2024-01-01',to:'2024-12-31'}).success);
  for(const data of [{from:'2026-02-29',to:'2026-03-01'},{from:'2026-01-02',to:'2026-01-01'},{from:'2024-01-01',to:'2025-01-01'},{from:'2026-01-01',to:'2026-01-02',role:'admin'}])assert(!salesReportQuery.safeParse(data).success);
});
