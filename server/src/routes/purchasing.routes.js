import { Router } from 'express';
import { requireAuth, requireRole, requireTrustedRequest } from '../middleware/auth.js';
import { parseInput, idValue } from '../services/inventory-validation.js';
import { supplierCreate, supplierEdit, orderCreate, receivingCreate, approvalInput, purchasingQuery } from '../services/purchasing-validation.js';

export function createPurchasingRouter({ config, sessions, authRepository, repository }) {
  const router = Router();
  // Scope middleware so unrelated inventory routes retain employee access.
  router.use(['/suppliers', '/purchase-orders', '/stock-ins'],
    (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); },
    requireTrustedRequest(config.origin),
    requireAuth(authRepository, sessions, config.secure ? '__Secure-tgp_session' : 'tgp_session'), requireRole('admin', 'manager'));
  async function write(req, work, action, module, key) {
    return authRepository.transaction(async client => {
      const actor = await authRepository.findById(req.auth.user.user_id, client);
      if (actor?.status !== 'active' || !['admin', 'manager'].includes(actor.role)) throw Object.assign(new Error('Access denied'), { status: 403 });
      const row = await work(client, actor.user_id);
      await authRepository.audit(client, actor.user_id, `${action}:${row[key]}`, module);
      return row;
    });
  }
  for (const [path, type, key, schema, module] of [
    ['/suppliers', 'suppliers', 'supplier_id', supplierCreate, 'suppliers'],
    ['/purchase-orders', 'orders', 'po_id', orderCreate, 'purchase_orders'],
    ['/stock-ins', 'receiving', 'stock_in_id', receivingCreate, 'stock_in'],
  ]) {
    router.get(path, async (req, res) => {
      const query = parseInput(purchasingQuery, req.query, res); if (!query) return;
      res.json({ success: true, ...await repository.list(type, query) });
    });
    router.get(path + '/:id', async (req, res) => {
      const id = parseInput(idValue, req.params.id, res); if (!id) return;
      res.json({ success: true, data: await repository.detail(type, id) });
    });
    router.post(path, async (req, res) => {
      const data = parseInput(schema, req.body, res); if (!data) return;
      const record = await write(req, (client, actor) => type === 'suppliers' ? repository.createSupplier(client, data)
        : repository.createDocument(client, type, actor, data), `${type}.created`, module, key);
      res.status(201).json({ success: true, data: record });
    });
    if (type !== 'suppliers') router.post(path + '/:id/approve', async (req, res) => {
      const id = parseInput(idValue, req.params.id, res); if (!id || !parseInput(approvalInput, req.body, res)) return;
      const data = await write(req, (client, actor) => repository.approve(client, type, id, actor), `${type}.approved`, module, key);
      res.json({ success: true, data });
    });
  }
  router.patch('/suppliers/:id', async (req, res) => {
    const id = parseInput(idValue, req.params.id, res); if (!id) return;
    const data = parseInput(supplierEdit, req.body, res); if (!data) return;
    res.json({ success: true, data: await write(req, client => repository.editSupplier(client, id, data), 'suppliers.updated', 'suppliers', 'supplier_id') });
  });
  return router;
}
