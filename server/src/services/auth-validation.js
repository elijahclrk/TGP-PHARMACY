import { z } from 'zod';

const username = z.string().trim().min(1).max(64).regex(/^[a-zA-Z0-9_.-]+$/);
export const loginSchema = z.object({ username, password: z.string().min(1).max(128) }).strict();
export const userSchema = z.object({
  username, password: z.string().min(12).max(128),
  full_name: z.string().trim().min(1).max(120).optional(),
  role: z.enum(['manager', 'employee']),
}).strict();
export const bootstrapSchema = userSchema.extend({ role: z.literal('admin') });

export const validateBody = schema => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ success: false, message: 'Invalid request fields.' });
  req.validated = result.data;
  next();
};
