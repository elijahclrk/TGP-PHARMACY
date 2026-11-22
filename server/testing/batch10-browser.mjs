// Real Chrome journeys. Only called after batch4-uat's independent TLS/identity,
// checksum and disposable-schema checks. Never loads production configuration.
import assert from 'node:assert/strict';
import {writeFile,readFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import ExcelJS from 'exceljs';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
export async function runBrowser({root,manifest,origin}){
 assert.equal(manifest.benefits,true);assert.equal(new URL(origin).hostname,'127.0.0.1');
 const {chromium}=await import(pathToFileURL(join(root,'browser-tools/node_modules/playwright-core/index.mjs')).href);
 await mkdir(join(manifest.runDir,'downloads'),{recursive:true});
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const results={browser:browser.version(),frontendMode:manifest.frontendMode,localOnly:true,steps:[],screenshots:[],runtimeErrors:[],externalRequests:[]};
 const actors={};let currentPage,receipt,paidRequest;
 const persist=()=>writeFile(join(manifest.runDir,'browser-results.json'),JSON.stringify(results,null,2));
 async function shot(name){await currentPage.screenshot({path:join(manifest.runDir,'screenshots',name+'.png'),fullPage:true});results.screenshots.push(name+'.png');}
 async function step(name,run){try{await run();results.steps.push({name,status:'passed'});console.log('BROWSER PASS '+name);}catch(e){results.steps.push({name,status:'failed',error:String(e.message).slice(0,500)});await shot('failure').catch(()=>{});await persist();throw Error('Local benefit browser failure: '+name+'; inspect retained results.');}await persist();}
 const go=async(label,path)=>{currentPage=actors[label].page;await currentPage.goto(origin+path);return currentPage;};
 const api=async(label,path,options={})=>actors[label].context.request.fetch(origin+'/api'+path,{...options,headers:{Origin:origin,'X-TGP-Request':'1',...options.headers}});
 const json=async(label,path,options={})=>{const r=await api(label,path,options);return {status:r.status(),body:await r.json()};};
 async function scheme(p,kind){await p.getByLabel('Customer benefit',{exact:true}).selectOption(kind);await p.getByLabel('Beneficiary name',{exact:true}).fill('SYNTHETIC LOCAL BENEFICIARY');await p.getByLabel('Beneficiary identification number',{exact:true}).fill('SYNTHETIC-LOCAL-ID');for(const label of ['Presented identity verified','Scheme entitlement verified','Items are for beneficiary exclusive use',...(kind==='pwd'?['PWD medicine booklet verified']:[])])await p.getByLabel(label,{exact:true}).check();}
 async function add(p,index,quantity=1){const name='SYNTHETIC benefit '+index;await p.getByRole('button',{name:'Add '+name,exact:true}).click();if(quantity!==1)await p.getByLabel('Quantity for '+name,{exact:true}).fill(String(quantity));}
 async function review(p,total){await p.getByRole('button',{name:'Review total',exact:true}).click();await p.getByText('Total: PHP '+total,{exact:true}).waitFor();}
 async function pay(p,cash='500'){await p.getByLabel('Cash received (PHP)').fill(cash);const pending=p.waitForResponse(r=>r.url()===origin+'/api/pos/checkout'&&r.request().method()==='POST');await p.getByRole('button',{name:'Complete cash sale',exact:true}).click();const r=await pending;assert.equal(r.status(),201);paidRequest=r.request().postDataJSON();return (await r.json()).data.receipt;}
 try{
  await step('Production bundle login, local-only gate and role separation',async()=>{
   for(const label of ['employee','manager','admin']){
    const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'en-PH',timezoneId:'Asia/Manila'});
    await context.route('**/*',route=>{const u=new URL(route.request().url());if(['http:','https:'].includes(u.protocol)&&u.hostname!=='127.0.0.1'){results.externalRequests.push(u.origin);return route.abort();}return route.continue();});
    const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>results.runtimeErrors.push(e.message));actors[label]={context,page};
    const u=manifest.users.find(u=>u.label===label);await go(label,'/login');await page.getByLabel('Username',{exact:true}).fill(u.username);await page.getByLabel('Password',{exact:true}).fill(u.password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL(origin+'/'+u.role);
    const caps=await json(label,'/pos/benefits/availability');assert.equal(caps.body.data.available,true);assert.equal(caps.body.data.local_only,true);
   }
   const p=await go('employee','/pos');await p.getByLabel('Customer benefit').waitFor();await shot('local-benefit-gate');
  });
  await step('Senior mixed VAT/exempt/ineligible basket, split FEFO and historical receipt',async()=>{
   const p=actors.employee.page;await scheme(p,'senior');assert.equal(await p.getByLabel('PWD medicine booklet verified').count(),0);
   await add(p,1,2);await add(p,2);await add(p,3);await review(p,'352.00');await shot('senior-reviewed');receipt=await pay(p);
   assert.equal(Number(receipt.financial.discount),60);assert.equal(Number(receipt.financial.vatRemoved),24);assert.equal(Number(receipt.financial.vat),12);assert.equal(receipt.items.filter(i=>i.product_id===211).length,2);assert(receipt.items.every(i=>![902,905,908].includes(i.batch_id)));
   await p.getByRole('region',{name:'Historical benefit breakdown'}).waitFor();await shot('senior-receipt');
   assert.equal((await json('manager','/pos/sales/'+receipt.sale_id)).status,200);
   assert.equal((await json('employee','/pos/checkout',{method:'POST',data:paidRequest})).status,200);
   assert.equal((await json('employee','/pos/checkout',{method:'POST',data:{...paidRequest,amount_paid:'501'}})).status,409);
   assert.equal((await json('manager','/pos/checkout',{method:'POST',data:paidRequest})).status,409);
   await p.getByRole('button',{name:'Back to POS',exact:true}).click();assert.equal(await p.getByLabel('Customer benefit').inputValue(),'regular');
  });
  await step('PWD documentary requirements and explicit quote invalidation after identity change',async()=>{
   const p=actors.employee.page;await scheme(p,'pwd');await add(p,2);await p.getByLabel('PWD medicine booklet verified').uncheck();await p.getByRole('button',{name:'Review total',exact:true}).click();await p.getByRole('alert').waitFor();assert.equal(await p.getByRole('button',{name:'Complete cash sale',exact:true}).count(),0);
   await p.getByLabel('PWD medicine booklet verified').check();await review(p,'80.00');await p.getByLabel('Beneficiary name',{exact:true}).fill('SYNTHETIC AMENDED');assert.equal(await p.getByRole('button',{name:'Complete cash sale',exact:true}).count(),0);await review(p,'80.00');await shot('pwd-reviewed');await pay(p);await p.getByRole('button',{name:'Back to POS',exact:true}).click();
  });
  await step('Unknown product metadata is unavailable and cannot bypass checkout',async()=>{
   const p=actors.employee.page;await scheme(p,'senior');await add(p,4);await p.getByRole('button',{name:'Review total',exact:true}).click();await p.getByRole('alert').waitFor();assert.equal(await p.getByRole('button',{name:'Complete cash sale',exact:true}).count(),0);await shot('unknown-classification');await p.getByRole('button',{name:'Remove SYNTHETIC benefit 4',exact:true}).click();
  });
  await step('Changed server price closes stale reference and requires renewed documentary quote review',async()=>{
   const p=actors.employee.page;await add(p,2);await review(p,'80.00');assert.equal((await json('admin','/products/212',{method:'PATCH',data:{unit_price:'101.00'}})).status,200);
   await p.getByLabel('Cash received (PHP)').fill('500');const response=p.waitForResponse(r=>r.url()===origin+'/api/pos/checkout'&&r.request().method()==='POST');await p.getByRole('button',{name:'Complete cash sale',exact:true}).click();assert.equal((await response).status(),409);await p.getByRole('alert').waitFor();assert.equal(await p.getByRole('button',{name:'Complete cash sale',exact:true}).count(),0);assert.equal(await p.getByLabel('Customer benefit').inputValue(),'senior');assert.equal(await p.getByLabel('Beneficiary name',{exact:true}).inputValue(),'');await shot('stale-quote-closed');await p.getByRole('button',{name:'Remove SYNTHETIC benefit 2',exact:true}).click();
  });
  await step('Lost checkout acknowledgement recovers after refresh without PII in browser storage',async()=>{
   const p=actors.employee.page;await scheme(p,'pwd');await add(p,5,3);await review(p,'0.02');
   await p.route('**/api/pos/checkout',async route=>{await route.fetch();await route.abort('connectionaborted');},{times:1});await p.getByLabel('Cash received (PHP)').fill('1');await p.getByRole('button',{name:'Complete cash sale',exact:true}).click();await p.getByText(/Checkout outcome is uncertain/).waitFor();
   const storage=await p.evaluate(()=>JSON.stringify(localStorage));assert(!storage.includes('SYNTHETIC LOCAL BENEFICIARY'));assert(!storage.includes('SYNTHETIC-LOCAL-ID'));assert(storage.includes('verification_id'));
   await p.reload();await p.getByRole('button',{name:'Check transaction status',exact:true}).click();await p.getByRole('dialog',{name:'Transaction complete'}).waitFor();await p.getByText('Total: PHP 0.02',{exact:true}).waitFor();await shot('lost-ack-recovered');await p.getByRole('button',{name:'Back to POS',exact:true}).click();
  });
  await step('Owner reports and real Excel/PDF downloads reconcile immutable benefit totals without customer IDs',async()=>{
   const day=new Date(Date.now()+28800000).toISOString().slice(0,10),filters=`from=${day}&to=${day}`;
   const r=await json('admin','/reports/sales?'+filters);assert.equal(Number(r.body.sales_amount),432.02);assert.equal(r.body.excluded_records,0);
   const p=await go('admin','/reports');await p.getByLabel('Report',{exact:true}).selectOption('transactions');await p.getByRole('cell',{name:receipt.receipt_no,exact:true}).waitFor();await shot('transaction-snapshots');
   const rows=(await json('admin','/reports/transactions?'+filters)).body.data;assert.equal(rows.length,3);assert.equal(rows.reduce((n,r)=>n+Number(r.discount_amount),0),80.01);
   for(const [format,label]of [['xlsx','Export Excel (.xlsx)'],['pdf','Export PDF']]){
    const next=p.waitForEvent('download');await p.getByRole('button',{name:label,exact:true}).click();const d=await next;const path=join(manifest.runDir,'downloads','transactions.'+format);await d.saveAs(path);let text='';
    if(format==='xlsx'){const book=new ExcelJS.Workbook();await book.xlsx.readFile(path);book.eachSheet(s=>s.eachRow(r=>r.eachCell(c=>{text+=String(c.value)+' ';assert(typeof c.value!=='object'||!c.value?.formula);})));assert(text.includes('352.00'));assert(text.includes('60.00'));}
    else{const task=getDocument({data:new Uint8Array(await readFile(path)),useSystemFonts:true});const doc=await task.promise;try{for(let i=1;i<=doc.numPages;i++)text+=(await(await doc.getPage(i)).getTextContent()).items.map(i=>i.str).join(' ');}finally{await task.destroy();}assert(text.includes('sales_amount: 352.00'));assert(text.includes('discount_amount: 60.00'));}
    assert(!text.includes('SYNTHETIC-LOCAL-ID'));assert(!text.includes('SYNTHETIC LOCAL BENEFICIARY'));
   }
   assert.equal((await json('manager','/reports/transactions?'+filters)).status,403);
  });
  await step('Discounted return acceptance preserves payment recognition and stock quarantine boundaries',async()=>{
   const found=await json('employee','/workflows/receipt?receipt='+encodeURIComponent(receipt.receipt_no));assert.equal(found.status,200);
   const item=receipt.items.find(i=>i.product_id===212),request=await json('employee','/workflows/returns',{method:'POST',data:{sale_id:receipt.sale_id,sale_item_id:item.sale_item_id,quantity:1,reason:'SYNTHETIC discounted return',request_key:crypto.randomUUID()}});assert.equal(request.status,201);const id=request.body.data.return_id;
   const day=new Date(Date.now()+28800000).toISOString().slice(0,10),sales=async()=>Number((await json('admin',`/reports/sales?from=${day}&to=${day}`)).body.sales_amount);assert.equal(await sales(),432.02);
   assert.equal((await json('manager',`/workflows/returns/${id}/decision`,{method:'POST',data:{decision:'approved'}})).status,200);assert.equal(await sales(),432.02);
   assert.equal((await json('employee',`/workflows/returns/${id}/receive`,{method:'POST',data:{}})).status,200);const ret=await json('manager','/workflows/returns/'+id);assert.equal(ret.body.data.quarantined_remaining,'1');assert(!JSON.stringify(ret.body).includes('SYNTHETIC-LOCAL-ID'));
  });
  await step('CSRF, unauthenticated access and employee export boundaries remain enforced',async()=>{
   const r=await actors.employee.context.request.post(origin+'/api/pos/benefits/verify',{data:{}});assert.equal(r.status(),403);
   assert.equal((await json('employee','/reports/transactions?from=2026-01-01&to=2026-12-31')).status,403);
   const guest=await browser.newContext();try{assert.equal((await guest.request.get(origin+'/api/pos/benefits/availability')).status(),401);}finally{await guest.close();}
   assert.equal(results.runtimeErrors.length,0);assert.equal(results.externalRequests.length,0);
  });
 }finally{await persist();await browser.close();}
 console.log(JSON.stringify({benefitBrowserPassed:results.steps.filter(s=>s.status==='passed').length,failed:results.steps.filter(s=>s.status==='failed').length,screenshots:results.screenshots.length}));
}
