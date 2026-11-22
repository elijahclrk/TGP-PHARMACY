import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole, requireTrustedRequest } from '../middleware/auth.js';
import { parseInput, idValue } from '../services/inventory-validation.js';
import { purchasingQuery } from '../services/purchasing-validation.js';
import { cartInput, checkoutInput, posInput } from '../services/pos-validation.js';
import { createQuoteProtection } from '../services/pos-quotes.js';
import {benefitVerificationInput,benefitQuoteInput,benefitCheckoutInput} from '../repositories/local-benefits.repository.js';

export function createPosRouter({ config, sessions, authRepository, repository, benefits }) {
  const router = Router();
  const quotes = createQuoteProtection(config.secret);
  async function currentActor(req, client) {
    const actor = await authRepository.findById(req.auth.user.user_id,client);
    if (actor?.status !== 'active' || !['employee','manager','admin'].includes(actor.role)) throw Object.assign(new Error('Access denied'), { status:403 });
    return actor;
  }
  router.use((_req,res,next) => { res.set('Cache-Control','no-store'); next(); }, requireTrustedRequest(config.origin),
    requireAuth(authRepository, sessions, config.secure ? '__Secure-tgp_session' : 'tgp_session'), requireRole('admin','manager','employee'));
  router.get('/products', async (req,res) => {
    const query = parseInput(purchasingQuery, req.query, res); if (!query) return;
    res.json({ success: true, ...await repository.products(query) });
  });
  router.get('/benefits/availability',async(_req,res)=>res.json({success:true,data:{available:benefits?await authRepository.transaction(c=>benefits.availability(c)):false,
    local_only:Boolean(benefits),reason:'Branch tax status, medicine eligibility evidence, documentary procedures and invoice format require validation.'}}));
  for(const[path,schema,method]of [['/benefits/verify',benefitVerificationInput,'verification'],['/benefits/quote',benefitQuoteInput,'quote']])router.post(path,async(req,res)=>{
    if(!benefits)return res.status(503).json({success:false,message:'Statutory checkout is unavailable.'});
    const parsed=schema.safeParse(req.body);
    if(!parsed.success)return res.status(400).json({success:false,message:'Beneficiary identity, scheme documents and cart must be complete and valid.'});
    const data=parsed.data;
    const result=await authRepository.transaction(async c=>benefits[method](c,await currentActor(req,c),data));
    res.json({success:true,data:result});
  });
  router.get('/checkouts/:requestId',async(req,res)=>{
    const parsed=z.uuid().safeParse(req.params.requestId);
    if(!parsed.success)return res.status(400).json({success:false,message:'Invalid checkout reference.'});
    const data=await authRepository.transaction(async client=>{
      const actor=await currentActor(req,client);
      return repository.status(client,actor,parsed.data);
    });
    res.json({success:true,data});
  });
  router.post('/checkouts/:requestId/resolve', async(req,res) => {
    const parsed=z.uuid().safeParse(req.params.requestId);
    if(!parsed.success || !z.object({}).strict().safeParse(req.body).success) return res.status(400).json({success:false,message:'Invalid checkout resolution request.'});
    const data=await authRepository.transaction(async client=>repository.resolve(client,await currentActor(req,client),parsed.data,authRepository.audit));
    res.json({success:true,data});
  });
  router.get('/sales/:id', async (req,res) => {
    const id = parseInput(idValue,req.params.id,res); if (!id) return;
    res.json({ success: true, data: await repository.receipt(id, req.auth.user) });
  });
  for (const [path,schema] of [['/quote',cartInput],['/checkout',checkoutInput]]) router.post(path, async (req,res,next) => {
    const isBenefit=path==='/checkout'&&req.body?.benefit!==undefined;
    if(isBenefit&&!benefits)return res.status(503).json({success:false,message:'Statutory checkout is unavailable.'});
    const data = posInput(isBenefit?benefitCheckoutInput:schema,req.body,res); if (!data) return;
    try {
      const result = await authRepository.transaction(async client => {
        const actor = await currentActor(req,client);
        if (path === '/quote') {
          const { fingerprint, ...quote } = await repository.quote(client,data);
          return { ...quote, quote_token: quotes.sign(actor.user_id, fingerprint) };
        }
        await client.query('SAVEPOINT pos_checkout_attempt');
        try {
          const result = isBenefit?await benefits.checkout(client,actor,data,authRepository.audit):await repository.checkout(client,actor,data,authRepository.audit,quotes.verify(data.quote_token,actor.user_id));
          await client.query('RELEASE SAVEPOINT pos_checkout_attempt');
          return result;
        } catch (error) {
          await client.query('ROLLBACK TO SAVEPOINT pos_checkout_attempt');
          await client.query('RELEASE SAVEPOINT pos_checkout_attempt');
          if (error.correctable || error.checkoutClosed) {
            const resolved = await repository.resolve(client,actor,data.request_id,authRepository.audit);
            if (resolved.status === 'completed') return { receipt:resolved.receipt,replayed:true };
            return { rejected:error.status,reason:error.code,checkout_state:'closed' };
          }
          throw error;
        }
      });
      if (result.rejected) return res.status(result.rejected).json({success:false,checkout_state:'closed',
        message:result.reason==='BENEFIT_DOCUMENTS_INVALID'?'Beneficiary verification or prescription quantity changed. Review the documents and obtain a fresh quote.':result.rejected===422 ? 'Cash received must cover the full total. Correct the cash and review again.' : 'The reviewed quote is no longer valid. Review a fresh quote before completing this sale.'});
      res.status(path === '/checkout' && !result.replayed ? 201 : 200).json({ success:true,data:result });
    } catch (error) {
      if (error.status === 409 || error.status === 422) return res.status(error.status).json({ success:false,message: error.status === 422 ? 'Cash received must cover the full total.' : 'Stock, pricing or checkout reference cannot be validated. Review the cart before retrying.' });
      next(error);
    }
  });
  return router;
}
