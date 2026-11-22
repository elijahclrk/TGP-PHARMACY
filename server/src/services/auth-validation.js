import { z } from 'zod';

const username = z.string().trim().min(1).max(64).regex(/^[a-zA-Z0-9_.-]+$/);
export const loginSchema = z.object({ username, password: z.string().min(1).max(128) }).strict();
export const userSchema = z.object({
  username, password: z.string().min(12).max(128),
  full_name: z.string().trim().min(1).max(120).optional(),
  role: z.enum(['manager', 'employee']),
}).strict();
export const bootstrapSchema = userSchema.extend({ role: z.literal('admin') });
export const accountEdit=userSchema.partial().extend({full_name:z.string().trim().min(1).max(120).nullable().optional(),status:z.enum(['active','inactive']).optional()}).strict().refine(value=>Object.keys(value).length>0);
export const accountListQuery = z.object({
  q: z.string().trim().max(200).default(''),
  page: z.string().regex(/^[1-9]\d{0,5}$/).transform(Number).default(1),
  limit: z.string().regex(/^\d{1,3}$/).transform(Number).refine(value => value >= 1 && value <= 100).default(20),
}).strict();
export const accountId = z.string().regex(/^[1-9]\d{0,9}$/).transform(Number).refine(value => value <= 2147483647);

export const validateBody = schema => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ success: false, message: 'Invalid request fields.' });
  req.validated = result.data;
  next();
};
