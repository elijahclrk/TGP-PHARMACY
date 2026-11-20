import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole, requireTrustedRequest } from '../middleware/auth.js';
import { parseInput, idValue } from '../services/inventory-validation.js';
import { purchasingQuery } from '../services/purchasing-validation.js';
import { cartInput, checkoutInput, posInput } from '../services/pos-validation.js';

export function createPosRouter({ config, sessions, authRepository, repository }) {
  const router = Router();
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
    const data = posInput(schema,req.body,res); if (!data) return;
    try {
      const result = await authRepository.transaction(async client => {
        const actor = await currentActor(req,client);
        if (path === '/quote') return repository.quote(client,data);
        await client.query('SAVEPOINT pos_checkout_attempt');
        try {
          const result = await repository.checkout(client,actor,data,authRepository.audit);
          await client.query('RELEASE SAVEPOINT pos_checkout_attempt');
          return result;
        } catch (error) {
          await client.query('ROLLBACK TO SAVEPOINT pos_checkout_attempt');
          await client.query('RELEASE SAVEPOINT pos_checkout_attempt');
          if (error.correctable || error.checkoutClosed) {
            const resolved = await repository.resolve(client,actor,data.request_id,authRepository.audit);
            if (resolved.status === 'completed') return { receipt:resolved.receipt,replayed:true };
            return { rejected:error.status,checkout_state:'closed' };
          }
          throw error;
        }
      });
      if (result.rejected) return res.status(result.rejected).json({success:false,checkout_state:'closed',
        message:result.rejected===422 ? 'Cash received must cover the full total. Correct the cash and review again.' : 'Stock or pricing changed. Correct the cart and review again.'});
      res.status(path === '/checkout' && !result.replayed ? 201 : 200).json({ success:true,data:result });
    } catch (error) {
      if (error.status === 409 || error.status === 422) return res.status(error.status).json({ success:false,message: error.status === 422 ? 'Cash received must cover the full total.' : 'Stock, pricing or checkout reference cannot be validated. Review the cart before retrying.' });
      next(error);
    }
  });
  return router;
}
