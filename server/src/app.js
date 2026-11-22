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
import {requireAcademic} from './academic/capabilities.js';
import {NOTICE} from './academic/manifest.js';
import {createLocalBenefitsRepository} from './repositories/local-benefits.repository.js';
import {createExchangesRepository} from './repositories/exchanges.repository.js';
import {createOperationsRepository} from './repositories/operations.repository.js';

export function createApplication({benefits,exchanges,operations}={}) {
if(operations&&env.nodeEnv==='production')throw new Error('Local operations cannot activate in a production runtime.');
if(exchanges&&env.nodeEnv==='production')throw new Error('Local exchanges cannot be activated in a production runtime.');
if(benefits&&env.nodeEnv==='production')throw new Error('Synthetic benefit checkout cannot be activated in a production runtime.');
return composeApplication({benefits,exchanges,operations});
}
export function createAcademicApplication(context){
 const {capability,provider}=context??{};
 const {config}=requireAcademic(capability,provider);
 if(config.document.payload.phase!=='ready')throw Error('Academic setup cannot serve HTTP');
 const benefits=createLocalBenefitsRepository({poolProvider:provider,posRepository:createPosRepository(provider),secret:config.secret,isolatedCapability:capability});
 const exchanges=createExchangesRepository({poolProvider:provider,secret:config.secret,policy:config.document.payload.exchangePolicy,isolatedCapability:capability});
 const operations=createOperationsRepository(provider,capability);
 return composeApplication({benefits,exchanges,operations},{provider,config:{secret:config.secret,ttl:config.ttl,secure:true,origin:config.origin,academicDemo:true},academic:context});
}
function composeApplication({benefits,exchanges,operations},{provider=getPool,config=getAuthConfig(),academic}={}){
const app = express();

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: { directives: {
  imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com'],
} } }));
if(academic){
 const {config:runtime}=requireAcademic(academic.capability,provider);
 if(runtime.railwayEdge){
  app.set('trust proxy',false);
  const host=new URL(runtime.origin).host;
  app.use((req,res,next)=>{
   // Railway public HTTP ingress provides TLS. Host is a routing check,
   // never evidence of TLS or authentication. Ignore forwarding headers.
   if(req.method==='GET'&&req.path==='/api/health')return next();
   if(req.headers.host!==host)return res.sendStatus(421);
   if(req.headers.origin!==undefined&&req.headers.origin!==runtime.origin)return res.sendStatus(403);
   next();
  });
 }
}
app.use(cors({ origin: config.origin, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

if(academic){
 const {config:runtime}=requireAcademic(academic.capability,provider);
 app.set('trust proxy',!runtime.railwayEdge&&runtime.proxies.length?runtime.proxies:false);
 let inFlight=0,exports=0;
 app.use((req,res,next)=>{
  try{requireAcademic(academic.capability,provider);}catch{return res.status(503).json({success:false,message:'Academic demo authorization unavailable.'});}
  if(req.path!=='/api/health'&&!runtime.railwayEdge&&!req.secure)return res.status(503).json({success:false,message:'HTTPS is required for this academic demo.'});
  if(req.path.startsWith('/api/')&&req.path!=='/api/health'){
   const exporting=req.path.endsWith('/export')||(req.path==='/api/exchanges/report'&&req.query.format);
   if(inFlight>=8||(exporting&&exports>=1))return res.status(503).json({success:false,message:'Academic demo capacity is busy. Retry shortly.'});
   inFlight++;if(exporting)exports++;let released=false;const release=()=>{if(released)return;released=true;inFlight--;if(exporting)exports--;};res.once('finish',release);res.once('close',release);
  }
  next();
 });
 app.get('/api/health',(_req,res)=>res.set('Cache-Control','no-store').json({success:true,status:'ok',academic_demo:true,notice:NOTICE}));
 app.get('/api/health/db',async(_req,res)=>{try{await provider().query('SELECT 1');res.json({success:true,status:'ok'});}catch{res.status(503).json({success:false,status:'unavailable'});}});
}
const sessions = createSessions(config);
const authRepository = createAuthRepository(provider);
app.use('/api/auth', createAuthRouter({ config, sessions, repository: authRepository }));
app.use('/api/audit-logs', createAuditRouter({ config, sessions, authRepository, repository: createAuditRepository(provider) }));
app.use('/api', apiRouter);
app.use('/api/workflows',createWorkflowsRouter({config,sessions,authRepository,repository:createWorkflowsRepository(provider),service:createPreparedWorkflows(provider),enabled:Boolean(academic)||process.env.CONTROLLED_WORKFLOWS_ENABLED==='true',restockingEnabled:Boolean(academic)||process.env.RETURN_RESTOCK_ENABLED==='true'}));
app.use('/api/exchanges',createExchangesRouter({config,sessions,authRepository,service:exchanges}));
app.use('/api/operations',createOperationsRouter({config,sessions,authRepository,service:operations}));
app.use('/api/reports', createReportsRouter({ config,sessions,authRepository,repository:createReportsRepository(provider),inventoryRepository:createInventoryRepository(provider) }));
app.use('/api/pos', createPosRouter({ config, sessions, authRepository, repository: createPosRepository(provider), benefits }));
app.use('/api', createProductImagesRouter({ config, sessions, authRepository,
  repository: createProductImagesRepository(provider), provider: academic?{enabled:false}:createImageProvider() }));
app.use('/api', createPurchasingRouter({ config, sessions, authRepository, repository: createPurchasingRepository(provider,{linkedReady:operations?(c=>operations.schemaReady(c)):undefined}),operations }));
app.use('/api', createInventoryRouter({ config, sessions, authRepository, repository: createInventoryRepository(provider),operations }));
if (academic||env.nodeEnv === 'production') serveFrontend(app,fileURLToPath(new URL('../../client/dist/',import.meta.url)));
app.use(notFound);
app.use(errorHandler);

return app;
}
export default createApplication();
