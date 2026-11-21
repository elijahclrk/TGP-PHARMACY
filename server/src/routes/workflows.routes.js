import {Router} from 'express';
import {requireAuth,requireRole,requireTrustedRequest} from '../middleware/auth.js';
import {idValue,parseInput} from '../services/inventory-validation.js';
import {adjustmentRequest,returnRequest,dispositionRequest,workflowDecision,workflowQuery,receiptQuery} from '../services/workflow-validation.js';
export function createWorkflowsRouter({config,sessions,authRepository,repository,service,enabled=false,restockingEnabled=false}){
  const router=Router();
  router.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();},requireTrustedRequest(config.origin),requireAuth(authRepository,sessions,config.secure?'__Secure-tgp_session':'tgp_session'));
  const unavailable=res=>res.status(503).json({success:false,code:'WORKFLOWS_UNAVAILABLE',message:'Controlled inventory workflows are not available. Contact an administrator.'});
  const ready=()=>enabled?repository.schemaReady():false;
  router.get('/capabilities',async(_req,res)=>{const available=await ready();res.json({success:true,data:{enabled:available,restocking_enabled:available&&restockingEnabled,senior_pwd_enabled:false}});});
  router.use(async(_req,res,next)=>{if(!await ready())return unavailable(res);next();});
  router.use((req,res,next)=>{if(!['GET','HEAD'].includes(req.method)&&Object.keys(req.query).length)return res.status(400).json({success:false,message:'Unexpected query.'});next();});
  router.get('/receipt',async(req,res)=>{const q=parseInput(receiptQuery,req.query,res);if(q)res.json({success:true,data:await repository.receipt(q.receipt)});});
  router.get('/pharmacist-authorizations',requireRole('manager','admin'),async(req,res)=>res.json({success:true,data:await repository.authorizations(req.auth.user)}));
  for(const [kind,schema,create,decide]of [['adjustments',adjustmentRequest,'requestAdjustment','decideAdjustment'],['returns',returnRequest,'requestReturn','decideReturn'],['dispositions',dispositionRequest,'requestDisposition','decideDisposition']]){
    if(kind==='dispositions')router.use('/'+kind,requireRole('manager','admin'));
    router.get('/'+kind,async(req,res)=>{const q=parseInput(workflowQuery,req.query,res);if(q)res.json({success:true,...await repository.list(kind,req.auth.user,q)});});
    router.get('/'+kind+'/:id',async(req,res)=>{const id=parseInput(idValue,req.params.id,res);if(id)res.json({success:true,data:await repository.detail(kind,id,req.auth.user)});});
    router.post('/'+kind,async(req,res)=>{const data=parseInput(schema,req.body,res);if(!data||Object.keys(req.query).length)return data&&res.status(400).json({success:false,message:'Unexpected query.'});
      if(kind==='dispositions'&&data.action==='restock'&&!restockingEnabled)return unavailable(res);
      res.status(201).json({success:true,data:await service[create](req.auth.user.user_id,data)});
    });
    router.post('/'+kind+'/:id/decision',requireRole('manager','admin'),async(req,res)=>{
      const id=parseInput(idValue,req.params.id,res);if(!id)return;
      const d=parseInput(workflowDecision,req.body,res);if(!d)return;
      if(kind!=='dispositions'&&(d.authorization_id||d.assessment||d.restock_eligible))return res.status(400).json({success:false,message:'Unexpected review fields.'});
      if(kind==='dispositions'){
        const row=await repository.detail(kind,id,req.auth.user);
        if(row.action==='restock'&&d.decision==='approved'&&(!restockingEnabled||d.restock_eligible!==true||!d.assessment||!d.authorization_id))return unavailable(res);
        if(row.action!=='restock'&&(d.authorization_id||d.assessment||d.restock_eligible))return res.status(400).json({success:false,message:'Unexpected restock fields.'});
      }
      res.json({success:true,data:await service[decide](req.auth.user.user_id,id,d.decision,d.reason,d.authorization_id,d.assessment)});
    });
  }
  router.post('/returns/:id/receive',async(req,res)=>{
    const id=parseInput(idValue,req.params.id,res);if(!id)return;
    if(!req.body||Object.keys(req.body).length)return res.status(400).json({success:false,message:'Full receipt only; no quantity override.'});
    await repository.detail('returns',id,req.auth.user);
    res.json({success:true,data:await service.receiveReturn(req.auth.user.user_id,id)});
  });
  router.use((error,_req,res,_next)=>{
    if(['42P01','42703','42883'].includes(error.code))return unavailable(res);
    if(['23514','23503','23505','P0001','40P01'].includes(error.code)||error.status===409)return res.status(409).json({success:false,message:'The record cannot be changed. Reload its current state before retrying.'});
    if([400,403,404].includes(error.status))return res.status(error.status).json({success:false,message:({400:'Invalid workflow input.',403:'Independent authorized review required.',404:'Matching eligible record not found.'})[error.status]});
    return unavailable(res); // No raw database errors or uncertain-success acknowledgement.
  });
  return router;
}
