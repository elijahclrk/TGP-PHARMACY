import { z } from 'zod';
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(value + 'T00:00:00Z');
  return value >= '0001-01-01' && Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0,10) === value;
});
const range = { from: date, to: date };
const withinYear = data => {
  const days = (Date.parse(data.to+'T00:00:00Z')-Date.parse(data.from+'T00:00:00Z'))/86400000;
  return days >= 0 && days < 366;
};
export const salesReportQuery = z.object({ ...range, period:z.enum(['day','week','month']).default('day') }).strict().refine(withinYear);
export const rangeQuery = z.object(range).strict().refine(withinYear);
export const productReportQuery = z.object({ ...range,
  page:z.string().regex(/^[1-9]\d{0,5}$/).transform(Number).default(1),
  limit:z.string().regex(/^\d{1,3}$/).transform(Number).refine(value=>value>=1 && value<=100).default(20),
}).strict().refine(withinYear);
export const emptyQuery = z.object({}).strict();
export function reportInput(schema,value,res) {
  const result=schema.safeParse(value);
  if(!result.success) {res.status(400).json({success:false,message:'Use valid report filters and an inclusive date range of at most 366 days.'});return null;}
  return result.data;
}
