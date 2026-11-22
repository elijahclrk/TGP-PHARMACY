// Validated future integration seam. No checkout route imports this module.
// The caller must obtain policy/classifications from reviewed server records;
// none may come from a browser or an unverified catalog default.
import {z} from 'zod';
import {prepareBenefitQuote} from './prepared-benefits.js';
export const beneficiaryDraft=z.object({benefit:z.enum(['senior','pwd']),customer:z.object({name:z.string().trim().min(1).max(200),id:z.string().trim().min(1).max(100)}).strict()}).strict();
export function validateBenefitPreparation(draft,verifiedItems,verifiedPolicy){
  const parsed=beneficiaryDraft.parse(draft);
  return prepareBenefitQuote({...parsed,items:verifiedItems,policy:verifiedPolicy});
}
