import {Router} from 'express';
import {requireAuth,requireRole} from '../middleware/auth.js';
import {salesReportQuery,productReportQuery,rangeQuery,emptyQuery,reportInput} from '../services/report-validation.js';
import {productQuery,batchQuery,parseInput} from '../services/inventory-validation.js';

export function createReportsRouter({config,sessions,authRepository,repository,inventoryRepository}) {
  const router=Router();
  router.use((_req,res,next)=>{res.set('Cache-Control','no-store');next()},
    requireAuth(authRepository,sessions,config.secure?'__Secure-tgp_session':'tgp_session'),requireRole('admin','manager'));
  router.get('/sales',async(req,res)=>{
    const query=reportInput(salesReportQuery,req.query,res);if(!query)return;
    if(req.auth.user.role==='manager' && query.period==='month') return res.status(403).json({success:false,message:'Monthly reporting requires administrator access.'});
    res.json({success:true,...await repository.sales(query)});
  });
  router.get('/products',requireRole('admin'),async(req,res)=>{
    const query=reportInput(productReportQuery,req.query,res);if(query)res.json({success:true,...await repository.products(query)});
  });
  router.get('/profit',requireRole('admin'),async(req,res)=>{
    const query=reportInput(rangeQuery,req.query,res);if(query)res.json({success:true,...await repository.profit(query)});
  });
  router.get('/valuation',requireRole('admin'),async(req,res)=>{
    if(reportInput(emptyQuery,req.query,res))res.json({success:true,...await repository.valuation()});
  });
  router.get('/low-stock',async(req,res)=>{
    const query=parseInput(productQuery,{...req.query,stock:'low'},res);if(query)res.json({success:true,...await inventoryRepository.products(query)});
  });
  router.get('/near-expiry',async(req,res)=>{
    const query=parseInput(batchQuery,{...req.query,status:'near_expiry'},res);if(query)res.json({success:true,...await inventoryRepository.batches(query,false)});
  });
  return router;
}
