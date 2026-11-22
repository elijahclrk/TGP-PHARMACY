import {Router} from 'express';
import {z} from 'zod';
import {requireAuth,requireRole,requireTrustedRequest} from '../middleware/auth.js';
const id=z.string().regex(/^[1-9]\d{0,9}$/).transform(Number).refine(n=>n<=2147483647);
export function createOperationsRouter({config,sessions,authRepository,service}){
 const r=Router();r.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();},requireTrustedRequest(config.origin),requireAuth(authRepository,sessions,config.secure?'__Secure-tgp_session':'tgp_session'));
 r.get('/availability',async(req,res)=>res.json({success:true,data:service?await service.availability(req.auth.user.user_id):{preferences:false,purchasing:false,metadata:false}}));
 r.use((_req,res,next)=>service?next():res.status(503).json({success:false,message:'Extended operational features are unavailable.'}));
 r.use((req,_res,next)=>{if(Object.keys(req.query).length)throw Object.assign(Error('Unexpected query'),{status:400});next();});
 r.get('/notification-preferences',requireRole('admin'),async(req,res)=>res.json({success:true,data:await service.preferences(req.auth.user.user_id)}));
 r.put('/notification-preferences',requireRole('admin'),async(req,res)=>res.json({success:true,data:await service.savePreferences(req.auth.user.user_id,req.body)}));
 r.use(['/purchase-orders','/stock-ins','/receiving-attempts'],requireRole('manager','admin'));
 r.get('/purchase-orders/:id',async(req,res)=>res.json({success:true,data:await service.order(req.auth.user.user_id,id.parse(req.params.id))}));
 r.patch('/purchase-orders/:id',async(req,res)=>res.json({success:true,data:await service.orderMetadata(req.auth.user.user_id,id.parse(req.params.id),req.body)}));
 r.post('/stock-ins',async(req,res)=>res.status(201).json({success:true,data:await service.receive(req.auth.user.user_id,req.body)}));
 r.post('/receiving-attempts/:key/resolve',async(req,res)=>{z.object({}).strict().parse(req.body);res.json({success:true,data:await service.receivingStatus(req.auth.user.user_id,z.uuid().parse(req.params.key).toLowerCase())});});
 r.use((e,_req,res,_next)=>{const status=e instanceof z.ZodError?400:[400,403,404,409,503].includes(e.status)?e.status:['23505','23514','23503','P0001'].includes(e.code)?409:503;res.status(status).json({success:false,message:({400:'Invalid operational fields.',403:'Authorized role required.',404:'Matching record not found.',409:'The record changed or this delivery is already recorded. Reload its state before retrying.',503:'Required local configuration or schema is unavailable.'})[status]});});return r;
}
