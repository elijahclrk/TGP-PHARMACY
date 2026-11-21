import {z} from 'zod';
export const workflowId=z.number().int().positive().max(2147483647);
const reason=z.string().trim().min(1).max(1000);
export const requestKey=z.string().uuid().transform(s=>s.toLowerCase());
export const adjustmentRequest=z.object({batch_id:workflowId,quantity:z.number().int().min(-2147483647).max(2147483647).refine(n=>n!==0),reason,request_key:requestKey}).strict();
export const returnRequest=z.object({sale_id:workflowId,sale_item_id:workflowId,quantity:workflowId,reason,request_key:requestKey}).strict();
export const dispositionRequest=z.object({return_id:workflowId,quantity:workflowId,action:z.enum(['destroy','supplier_return','restock']),reason,request_key:requestKey}).strict();
export const workflowDecision=z.object({decision:z.enum(['approved','rejected']),reason:reason.optional(),authorization_id:workflowId.optional(),restock_eligible:z.literal(true).optional(),assessment:reason.optional()}).strict()
  .refine(d=>d.decision!=='rejected'||Boolean(d.reason))
  .refine(d=>d.decision!=='rejected'||(!d.authorization_id&&!d.assessment&&!d.restock_eligible));
export const receiptQuery=z.object({receipt:z.string().trim().min(1).max(100)}).strict();
export const workflowQuery=z.object({status:z.enum(['all','pending','approved','rejected']).default('all'),page:z.string().regex(/^[1-9]\d{0,5}$/).transform(Number).default(1),limit:z.string().regex(/^\d{1,3}$/).transform(Number).refine(n=>n>0&&n<=100).default(20),request_key:requestKey.optional()}).strict();
