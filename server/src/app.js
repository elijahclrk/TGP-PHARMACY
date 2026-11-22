import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'node:url';
import { serveFrontend } from './middleware/frontend.js';
import { createAuthRouter } from './routes/auth.routes.js';
import { getAuthConfig } from './config/auth.js';
import { getPool } from './config/database.js';
import { createSessions } from './services/sessions.js';
import { createAuthRepository } from './repositories/auth.repository.js';
import { createInventoryRepository } from './repositories/inventory.repository.js';
import { createInventoryRouter } from './routes/inventory.routes.js';
import { createPurchasingRouter } from './routes/purchasing.routes.js';
import { createPurchasingRepository } from './repositories/purchasing.repository.js';
import {createWorkflowsRouter} from './routes/workflows.routes.js';
import {createWorkflowsRepository} from './repositories/workflows.repository.js';
import {createPreparedWorkflows} from './services/prepared-workflows.js';
import { createPosRepository } from './repositories/pos.repository.js';
import { createPosRouter } from './routes/pos.routes.js';
import { createReportsRepository } from './repositories/reports.repository.js';
import { createReportsRouter } from './routes/reports.routes.js';
import { createAuditRouter } from './routes/audit.routes.js';
import { createAuditRepository } from './repositories/audit.repository.js';
import { env } from './config/env.js';
import { createProductImagesRouter } from './routes/product-images.routes.js';
import { createProductImagesRepository } from './repositories/product-images.repository.js';
import { createImageProvider } from './services/product-images.js';
import apiRouter from './routes/index.js';
import { notFound } from './middleware/not-found.js';
import { errorHandler } from './middleware/error-handler.js';
import {createExchangesRouter} from './routes/exchanges.routes.js';
import {createOperationsRouter} from './routes/operations.routes.js';

export function createApplication({benefits,exchanges,operations}={}) {
if(operations&&env.nodeEnv==='production')throw new Error('Local operations cannot activate in a production runtime.');
if(exchanges&&env.nodeEnv==='production')throw new Error('Local exchanges cannot be activated in a production runtime.');
if(benefits&&env.nodeEnv==='production')throw new Error('Synthetic benefit checkout cannot be activated in a production runtime.');
const app = express();

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: { directives: {
  imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com'],
} } }));
app.use(cors({ origin: env.clientOrigin, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

const config = getAuthConfig();
const sessions = createSessions(config);
const authRepository = createAuthRepository(getPool);
app.use('/api/auth', createAuthRouter({ config, sessions, repository: authRepository }));
app.use('/api/audit-logs', createAuditRouter({ config, sessions, authRepository, repository: createAuditRepository(getPool) }));
app.use('/api', apiRouter);
app.use('/api/workflows',createWorkflowsRouter({config,sessions,authRepository,repository:createWorkflowsRepository(getPool),service:createPreparedWorkflows(getPool),enabled:process.env.CONTROLLED_WORKFLOWS_ENABLED==='true',restockingEnabled:process.env.RETURN_RESTOCK_ENABLED==='true'}));
app.use('/api/exchanges',createExchangesRouter({config,sessions,authRepository,service:exchanges}));
app.use('/api/operations',createOperationsRouter({config,sessions,authRepository,service:operations}));
app.use('/api/reports', createReportsRouter({ config,sessions,authRepository,repository:createReportsRepository(getPool),inventoryRepository:createInventoryRepository(getPool) }));
app.use('/api/pos', createPosRouter({ config, sessions, authRepository, repository: createPosRepository(getPool), benefits }));
app.use('/api', createProductImagesRouter({ config, sessions, authRepository,
  repository: createProductImagesRepository(getPool), provider: createImageProvider() }));
app.use('/api', createPurchasingRouter({ config, sessions, authRepository, repository: createPurchasingRepository(getPool,{linkedReady:operations?(c=>operations.schemaReady(c)):undefined}),operations }));
app.use('/api', createInventoryRouter({ config, sessions, authRepository, repository: createInventoryRepository(getPool),operations }));
if (env.nodeEnv === 'production') serveFrontend(app,fileURLToPath(new URL('../../client/dist/',import.meta.url)));
app.use(notFound);
app.use(errorHandler);

return app;
}
export default createApplication();
