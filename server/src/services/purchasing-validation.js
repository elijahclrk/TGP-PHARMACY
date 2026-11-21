import { z } from 'zod';
import { batchCreate, money } from './inventory-validation.js';

const id = z.number().int().positive().max(2147483647);
const text = z.string().trim().min(1).max(200);
const optionalText = z.string().trim().max(500).nullable().optional();
export const supplierCreate = z.object({ name: text, contact_no: optionalText, address: optionalText }).strict();
export const supplierEdit = supplierCreate.partial().refine(data => Object.keys(data).length > 0);
const quantity = id;
const poLine = z.object({ product_id: id, quantity, unit_cost: money }).strict();
const receivingLine = batchCreate.omit({ qty_on_hand: true }).extend({ product_id: id, quantity }).strict();
export const orderCreate = z.object({ supplier_id: id, items: z.array(poLine).min(1).max(100) }).strict();
export const receivingCreate = z.object({ supplier_id: id, delivery_ref: text, items: z.array(receivingLine).min(1).max(100) }).strict();
export const approvalInput = z.object({}).strict();
export const purchasingQuery = z.object({
  status: z.enum(['all', 'pending', 'approved']).default('all'),
  q: z.string().trim().max(200).default(''),
  page: z.string().regex(/^[1-9]\d{0,5}$/).transform(Number).default(1),
  limit: z.string().regex(/^\d{1,3}$/).transform(Number).refine(n => n >= 1 && n <= 100).default(20),
}).strict();
