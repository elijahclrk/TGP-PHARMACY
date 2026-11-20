import { Router } from 'express';
import multer from 'multer';
import { rateLimit } from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import { requireAuth, requireRole, requireTrustedRequest } from '../middleware/auth.js';
import { idValue } from '../services/inventory-validation.js';
import { maxImageBytes, imagePrefix, validImageId, normalizeProductImage } from '../services/product-images.js';
import { imageFailure } from '../repositories/product-images.repository.js';

export function createProductImagesRouter({ config, sessions, authRepository, repository, provider, mutationLimit = 10 }) {
  const router = Router();
  router.use('/products/:id/image', (_req,res,next) => { res.set('Cache-Control','no-store'); next(); },
    requireTrustedRequest(config.origin), requireAuth(authRepository,sessions,config.secure ? '__Secure-tgp_session' : 'tgp_session'));
  const parser = multer({ storage: multer.memoryStorage(), limits: {
    fileSize: maxImageBytes, files: 1, fields: 1, parts: 2, fieldSize: 100, fieldNameSize: 50,
  } }).single('image');
  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: mutationLimit,
    keyGenerator: req => String(req.auth.user.user_id), standardHeaders: 'draft-8', legacyHeaders: false,
    message: { success: false, message: 'Too many image changes. Please try later.' } });
  let active = 0;
  const representation = id => id ? { public_id: id, url: provider.url(id) } : null;
  function productId(req) {
    const parsed = idValue.safeParse(req.params.id);
    if (!parsed.success || Object.keys(req.query).length) throw imageFailure(400);
    return parsed.data;
  }
  async function actor(client, req) {
    const user = await authRepository.findById(req.auth.user.user_id,client);
    if (user?.status !== 'active' || !['manager','admin'].includes(user.role)) throw imageFailure(403);
    return user;
  }
  const failure = (error,res) => {
    const status = error instanceof multer.MulterError || error.status === 400 ? 400 :
      [403,404,409,429,502,503].includes(error.status) ? error.status : 503;
    const messages = { 400:'Use one valid JPEG/PNG image (up to 5 MiB) and the current image reference.',
      403:'Access denied.',404:'Product not found.',409:'The image changed. Reload before trying again.',
      502:'Image provider unavailable. Reload to check the current image before retrying.',
      503:'Images unavailable or outcome uncertain. Reload before retrying; contact an administrator if this persists.' };
    if (!res.headersSent && !res.destroyed) res.status(status).json({ success:false,message:messages[status] || 'Image change unavailable.' });
  };
  router.get('/products/:id/image', async (req,res) => {
    try {
      const id = productId(req);
      if (!provider.enabled) return res.json({ success:true,data:{ enabled:false,image:null } });
      const row = await repository.get(id);
      res.json({ success:true,data:{ enabled:true,image:representation(row.image_public_id) } });
    } catch (error) { failure(error,res); }
  });
  for (const method of ['put','delete']) router[method]('/products/:id/image', requireRole('admin','manager'),limiter,async(req,res) => {
    let uploadedId = null, committed = false, reserved = false;
    try {
      const id = productId(req);
      if (!provider.enabled) throw imageFailure(503);
      if (active >= 2) throw imageFailure(503);
      active++; reserved = true;
      // Fail before reading an upload if the product/migration is unavailable.
      await repository.get(id);
      if (method === 'put') {
        if (!req.is('multipart/form-data')) throw imageFailure(400);
        req.setTimeout(15000);
        await new Promise((resolve,reject) => parser(req,res,error => error ? reject(error) : resolve()));
      }
      const body = req.body;
      if (!body || Object.keys(body).length !== 1 || !Object.hasOwn(body,'expected_image') ||
        !(body.expected_image === '' || validImageId(body.expected_image))) throw imageFailure(400);
      if (method === 'put' && !req.file) throw imageFailure(400);
      const expected = body.expected_image || null;
      const nextId = method === 'put' ? imagePrefix + randomUUID() : null;
      const buffer = method === 'put' ? await normalizeProductImage(req.file.buffer) : null;
      // Persist intent for crash/orphan reconciliation without holding locks over provider calls.
      await authRepository.transaction(async client => {
        const user = await actor(client,req);
        const row = await repository.get(id,client,true);
        if (row.image_public_id !== expected) throw imageFailure(409);
        await authRepository.audit(client,user.user_id,`product_image.${method === 'put' ? 'upload_started' : 'remove_started'}:${id}:${nextId || expected || 'none'}`,'product_images');
      });
      if (nextId) {
        // On provider timeout the upload may have completed: retain intent for reconciliation.
        await provider.upload(buffer,nextId);
        uploadedId = nextId;
      }
      await authRepository.transaction(async client => {
        const user = await actor(client,req);
        await repository.replace(client,id,expected,nextId);
        await authRepository.audit(client,user.user_id,`product_image.${nextId ? 'saved' : 'removed'}:${id}:${expected || 'none'}:${nextId || 'none'}`,'product_images');
      });
      committed = true;
      let cleanupPending = false;
      if (expected) {
        try { await provider.remove(expected); } catch { cleanupPending = true; }
      }
      res.json({ success:true,data:{ enabled:true,image:representation(nextId),cleanup_pending:cleanupPending } });
    } catch (error) {
      if (uploadedId && !committed) {
        // Never destroy a possibly committed asset after a lost COMMIT response.
        try {
          const detached = await authRepository.transaction(async client => {
            // Wait for the shared transaction lock, including any uncertain
            // COMMIT still executing on the original connection, before deciding.
            const current = await repository.get(productId(req),client,true);
            return current.image_public_id !== uploadedId;
          });
          if (detached) await provider.remove(uploadedId);
        } catch { /* Durable intent remains for operator reconciliation. */ }
      }
      failure(error,res);
    } finally {
      if (reserved) active--;
      req.file = undefined;
    }
  });
  return router;
}
