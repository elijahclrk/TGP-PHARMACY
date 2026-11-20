import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole, requireTrustedRequest } from '../middleware/auth.js';
import { parseInput, idValue } from '../services/inventory-validation.js';
import { purchasingQuery } from '../services/purchasing-validation.js';
import { cartInput, checkoutInput, posInput } from '../services/pos-validation.js';

export function createPosRouter({ config, sessions, authRepository, repository }) {
  const router = Router();
  router.use((_req,res,next) => { res.set('Cache-Control','no-store'); next(); }, requireTrustedRequest(config.origin),
    requireAuth(authRepository, sessions, config.secure ? '__Secure-tgp_session' : 'tgp_session'), requireRole('admin','manager','employee'));
  router.get('/products', async (req,res) => {
    const query = parseInput(purchasingQuery, req.query, res); if (!query) return;
    res.json({ success: true, ...await repository.products(query) });
  });
  router.get('/checkouts/:requestId',async(req,res)=>{
    const parsed=z.uuid().safeParse(req.params.requestId);
    if(!parsed.success)return res.status(400).json({success:false,message:'Invalid checkout reference.'});
    const data=await authRepository.transaction(async client=>{
      const actor=await authRepository.findById(req.auth.user.user_id,client);
      if(actor?.status!=='active')throw Object.assign(new Error('Access denied'),{status:403});
      return repository.status(client,actor,parsed.data);
    });
    res.json({success:true,data});
  });
  router.get('/sales/:id', async (req,res) => {
    const id = parseInput(idValue,req.params.id,res); if (!id) return;
    res.json({ success: true, data: await repository.receipt(id, req.auth.user) });
  });
  for (const [path,schema] of [['/quote',cartInput],['/checkout',checkoutInput]]) router.post(path, async (req,res,next) => {
    const data = posInput(schema,req.body,res); if (!data) return;
    try {
      const result = await authRepository.transaction(async client => {
        const actor = await authRepository.findById(req.auth.user.user_id,client);
        if (actor?.status !== 'active' || !['employee','manager','admin'].includes(actor.role)) throw Object.assign(new Error('Access denied'), { status:403 });
        return path === '/quote' ? repository.quote(client,data) : repository.checkout(client,actor,data,authRepository.audit);
      });
      res.status(path === '/checkout' && !result.replayed ? 201 : 200).json({ success:true,data:result });
    } catch (error) {
      if (error.status === 409 || error.status === 422) return res.status(error.status).json({ success:false,message: error.status === 422 ? 'Cash received must cover the full total.' : 'Stock, pricing or checkout reference cannot be validated. Review the cart before retrying.' });
      next(error);
    }
  });
  return router;
}
