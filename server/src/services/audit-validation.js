import { z } from 'zod';

export const auditQuery = z.object({
  q: z.string().trim().max(200).default(''),
  module: z.string().max(200).default(''),
  page: z.string().regex(/^[1-9]\d{0,5}$/).transform(Number).default(1),
  limit: z.string().regex(/^\d{1,3}$/).transform(Number).refine(value => value >= 1 && value <= 100).default(20),
}).strict();
