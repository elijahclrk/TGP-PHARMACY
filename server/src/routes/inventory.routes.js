import { Router } from 'express';
import { requireAuth, requireRole, requireTrustedRequest } from '../middleware/auth.js';
import { parseInput, productQuery, batchQuery, productCreate, productEdit, batchCreate, batchEdit, idValue } from '../services/inventory-validation.js';

export function createInventoryRouter({ config, sessions, authRepository, repository,operations }) {
  const router = Router();
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.use(requireTrustedRequest(config.origin));
  router.use(requireAuth(authRepository, sessions, config.secure ? '__Secure-tgp_session' : 'tgp_session'));
  const manage = requireRole('admin', 'manager');
  const write = async (req, work, action, module) => authRepository.transaction(async client => {
    const actor = await authRepository.findById(req.auth.user.user_id, client);
    if (actor?.status !== 'active' || !['admin', 'manager'].includes(actor.role)) throw Object.assign(new Error('Access denied'), { status: 403 });
    if (Object.hasOwn(req.body, 'reorder_level') && actor.role !== 'admin') throw Object.assign(new Error('Access denied'), { status: 403 });
    if(Object.hasOwn(req.body,'strength_dosage')&&(!operations||!await operations.schemaReady(client)))throw Object.assign(Error('Extended product fields unavailable'),{status:503});
    const row = await work(client);
    await authRepository.audit(client, actor.user_id, `${action}:${row.batch_id ?? row.product_id}`, module);
    return row;
  });
  const listProducts = async (req, res, low = false) => {
    const query = parseInput(productQuery, low ? { ...req.query, stock: 'low' } : req.query, res);
    if (query) res.json({ success: true, ...await repository.products(query) });
  };
  router.get('/products', (req, res) => listProducts(req, res));
  router.get('/inventory/low-stock', (req, res) => listProducts(req, res, true));
  router.get('/products/:id', async (req, res) => {
    const id = parseInput(idValue, req.params.id, res); if (!id) return;
    const data = await repository.product(id);
    if (!data) return res.status(404).json({ success: false, message: 'Product not found.' });
    res.json({ success: true, data });
  });
  const listBatches = async (req, res, near = false) => {
    const query = parseInput(batchQuery, near ? { ...req.query, status: 'near_expiry' } : req.query, res);
    if (query) res.json({ success: true, ...await repository.batches(query, req.auth.user.role !== 'employee') });
  };
  router.get('/inventory/batches', (req, res) => listBatches(req, res));
  router.get('/inventory/near-expiry', (req, res) => listBatches(req, res, true));
  router.post('/products', manage, async (req, res) => {
    const data = parseInput(productCreate, req.body, res); if (!data) return;
    const row = await write(req, client => repository.insertProduct(client, data), 'product.created', 'products');
    res.status(201).json({ success: true, data: row });
  });
  router.patch('/products/:id', manage, async (req, res) => {
    const id = parseInput(idValue, req.params.id, res); if (!id) return;
    const data = parseInput(productEdit, req.body, res); if (!data) return;
    res.json({ success: true, data: await write(req, client => repository.editProduct(client, id, data), 'product.updated', 'products') });
  });
  router.post('/products/:id/batches', manage, async (req, res) => {
    const id = parseInput(idValue, req.params.id, res); if (!id) return;
    const data = parseInput(batchCreate, req.body, res); if (!data) return;
    res.status(201).json({ success: true, data: await write(req, client => repository.insertBatch(client, id, data), 'batch.created_zero_stock', 'inventory') });
  });
  router.patch('/inventory/batches/:id', manage, async (req, res) => {
    const id = parseInput(idValue, req.params.id, res); if (!id) return;
    const data = parseInput(batchEdit, req.body, res); if (!data) return;
    res.json({ success: true, data: await write(req, client => repository.editBatch(client, id, data), 'batch.metadata_updated', 'inventory') });
  });
  return router;
}
