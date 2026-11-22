import { z } from 'zod';

const text = z.string().trim().min(1).max(200);
const optionalText = z.string().trim().max(200).nullable().transform(value => value || null);
// Decimal strings preserve pg NUMERIC precision; no unapproved rounding/scale.
export const money = z.union([z.string().max(40), z.number().finite().nonnegative()])
  .transform(String).refine(value => /^\d+(\.\d+)?$/.test(value), 'Use a nonnegative decimal value.');
const quantity = z.number().int().min(0).max(2147483647);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(value + 'T00:00:00Z');
  return value >= '0001-01-01' && !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}, 'Use a valid calendar date.');
export const productCreate = z.object({ name: text, generic_name: optionalText.optional(), category: optionalText.optional(),
  strength_dosage:optionalText.optional(),unit_price: money, reorder_level: quantity.nullable().optional() }).strict();
export const productEdit = productCreate.partial().refine(value => Object.keys(value).length > 0);
const batchFields = { batch_no: text, expiry_date: date, cost_price: money, selling_price: money };
// A zero value can be acknowledged at creation, but never accepted for editing.
export const batchCreate = z.object({ ...batchFields, qty_on_hand: z.literal(0).optional() }).strict();
export const batchEdit = z.object(batchFields).strict().partial().refine(value => Object.keys(value).length > 0);
export const idValue = z.string().regex(/^[1-9]\d{0,9}$/).transform(Number).refine(value => value <= 2147483647);
const page = z.string().regex(/^[1-9]\d{0,5}$/).transform(Number);
const limit = z.string().regex(/^\d{1,3}$/).transform(Number).refine(value => value >= 1 && value <= 100);
const common = { q: z.string().trim().max(200).default(''), page: page.default(1), limit: limit.default(20) };
export const productQuery = z.object({ ...common, category: z.string().trim().max(200).default(''),
  stock: z.enum(['all', 'low']).default('all') }).strict();
export const batchQuery = z.object({ ...common, product_id: idValue.optional(),
  status: z.enum(['all', 'near_expiry', 'expiring_today', 'expired']).default('all'),
}).strict();

export function parseInput(schema, value, res) {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: 'Invalid inventory fields or query parameters.' });
    return null;
  }
  return parsed.data;
}
