import { z } from 'zod';
const id = z.number().int().positive().max(2147483647);
export const cartInput = z.object({ items: z.array(z.object({ product_id: id, quantity: id }).strict()).min(1).max(100) }).strict()
  .refine(data => new Set(data.items.map(item => item.product_id)).size === data.items.length);
export const checkoutInput = cartInput.safeExtend({
  request_id: z.uuid(),
  amount_paid: z.string().regex(/^\d{1,20}(\.\d{1,2})?$/),
  // Optional solely for recovery of pre-upgrade paid requests. New sales without
  // a valid quote are closed safely by the transaction/recovery protocol.
  quote_token: z.string().min(1).max(512).optional(),
});
export function posInput(schema, value, res) {
  const result = schema.safeParse(value);
  if (!result.success) { res.status(400).json({ success: false, message: 'Invalid cart or cash amount. Discounts are unavailable.' }); return null; }
  return result.data;
}
