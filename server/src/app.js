import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { createAuthRouter } from './routes/auth.routes.js';
import { getAuthConfig } from './config/auth.js';
import { getPool } from './config/database.js';
import { createSessions } from './services/sessions.js';
import { createAuthRepository } from './repositories/auth.repository.js';
import { createInventoryRepository } from './repositories/inventory.repository.js';
import { createInventoryRouter } from './routes/inventory.routes.js';
import { createPurchasingRouter } from './routes/purchasing.routes.js';
import { createPurchasingRepository } from './repositories/purchasing.repository.js';
import { createPosRepository } from './repositories/pos.repository.js';
import { createPosRouter } from './routes/pos.routes.js';
import { createReportsRepository } from './repositories/reports.repository.js';
import { createReportsRouter } from './routes/reports.routes.js';
import { env } from './config/env.js';
import apiRouter from './routes/index.js';
import { notFound } from './middleware/not-found.js';
import { errorHandler } from './middleware/error-handler.js';

const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: env.clientOrigin, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

const config = getAuthConfig();
const sessions = createSessions(config);
const authRepository = createAuthRepository(getPool);
app.use('/api/auth', createAuthRouter({ config, sessions, repository: authRepository }));
app.use('/api', apiRouter);
app.use('/api/reports', createReportsRouter({ config,sessions,authRepository,repository:createReportsRepository(getPool),inventoryRepository:createInventoryRepository(getPool) }));
app.use('/api/pos', createPosRouter({ config, sessions, authRepository, repository: createPosRepository(getPool) }));
app.use('/api', createPurchasingRouter({ config, sessions, authRepository, repository: createPurchasingRepository(getPool) }));
app.use('/api', createInventoryRouter({ config, sessions, authRepository, repository: createInventoryRepository(getPool) }));
app.use(notFound);
app.use(errorHandler);

export default app;
