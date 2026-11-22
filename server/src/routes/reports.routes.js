import {Router} from 'express';
import {requireAuth,requireRole} from '../middleware/auth.js';
import {salesReportQuery,productReportQuery,rangeQuery,emptyQuery,detailReportQuery,reportInput} from '../services/report-validation.js';
import {generateReportExport,reportColumns} from '../services/report-exports.js';
import {productQuery,batchQuery,parseInput} from '../services/inventory-validation.js';

export function createReportsRouter({config,sessions,authRepository,repository,inventoryRepository}) {
  const router=Router();
  router.use((_req,res,next)=>{res.set('Cache-Control','no-store');next()},
    requireAuth(authRepository,sessions,config.secure?'__Secure-tgp_session':'tgp_session'),requireRole('admin','manager'));
  const details=['transactions','categories','best-selling','slow-moving','returns'];
  router.get('/:kind/export',requireRole('admin'),async(req,res)=>{
    const {kind}=req.params;const {format,...filters}=req.query;
    if(Object.hasOwn(filters,'receipt')&&kind!=='transactions')return res.status(400).json({success:false,message:'Receipt filter requires transaction history.'});
    if(kind==='exchanges'||!Object.hasOwn(reportColumns,kind)||!['xlsx','pdf'].includes(format))return res.status(400).json({success:false,message:'Unsupported report or export format.'});
    if(Object.hasOwn(filters,'category')&&!['best-selling','slow-moving','low-stock'].includes(kind))return res.status(400).json({success:false,message:'Category filter is unsupported for this report.'});
    // Page parameters are deliberately absent: export every filtered row, never
    // silently export only the visible page or truncate a large report.
    const schema=kind==='sales'?salesReportQuery:kind==='valuation'?emptyQuery:kind==='low-stock'?productQuery:kind==='near-expiry'?batchQuery:details.includes(kind)?detailReportQuery:rangeQuery;
    if(Object.hasOwn(filters,'page')||Object.hasOwn(filters,'limit')||Object.hasOwn(filters,'stock')||Object.hasOwn(filters,'status'))return res.status(400).json({success:false,message:'Use report filters without pagination or status overrides.'});
    const query=reportInput(schema,filters,res);if(!query)return;
    let result;
    if(kind==='low-stock'||kind==='near-expiry'){
      const selected={...query,page:1,limit:10001,...(kind==='low-stock'?{stock:'low'}:{status:'near_expiry'})};
      result=kind==='low-stock'?await inventoryRepository.products(selected):await inventoryRepository.batches(selected,false);
      if(result.total>10000)return res.status(422).json({success:false,message:'Report exceeds 10,000 rows. Narrow the filters.'});
    }else if(details.includes(kind))result=await repository.detail(kind,query);
    else if(kind==='products'){
      result=await repository.products({...query,page:1,limit:10001});
      if(result.total>10000)return res.status(422).json({success:false,message:'Report exceeds 10,000 rows. Narrow the date range.'});
    }else result=await repository[kind](query);
    const file=await generateReportExport(kind,format,result,query);
    res.set('Content-Type',format==='xlsx'?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'application/pdf');
    res.set('Content-Disposition',`attachment; filename="tgp-${kind}.${format}"`).send(file);
  });
  for(const kind of details)router.get('/'+kind,requireRole('admin'),async(req,res)=>{
    if(Object.hasOwn(req.query,'receipt')&&kind!=='transactions')return res.status(400).json({success:false,message:'Receipt filter requires transaction history.'});
    if(Object.hasOwn(req.query,'category')&&!['best-selling','slow-moving'].includes(kind))return res.status(400).json({success:false,message:'Category filter is unsupported for this report.'});
    const query=reportInput(detailReportQuery,req.query,res);if(query)res.json({success:true,...await repository.detail(kind,query)});
  });
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
