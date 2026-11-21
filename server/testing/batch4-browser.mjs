import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';

export async function runBrowser({root,manifest,origin}){
  const {chromium}=await import(pathToFileURL(join(root,'browser-tools','node_modules','playwright-core','index.mjs')).href);
  const persistent=await chromium.launchPersistentContext(join(manifest.runDir,'chrome-profile'),{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,downloadsPath:join(manifest.runDir,'downloads')});
  const browser=persistent.browser();
  const results={browser:browser.version(),frontendMode:manifest.frontendMode??'development',viewport:{width:1440,height:1000},origin,schema:manifest.schema,steps:[],screenshots:[],runtimeErrors:[],httpErrors:[],externalRequests:[]};
  const actors={},secrets=[manifest.jwt,...manifest.users.map(u=>u.password)];
  const redact=s=>secrets.reduce((v,k)=>v.replaceAll(k,'[redacted]'),String(s));
  const persist=()=>writeFile(join(manifest.runDir,'browser-results.json'),JSON.stringify(results,null,2));
  let currentPage;
  async function shot(page,name){await page.screenshot({path:join(manifest.runDir,'screenshots',name+'.png'),fullPage:true});results.screenshots.push(name+'.png');}
  async function step(name,work){const started=Date.now();try{await work();results.steps.push({name,status:'passed',milliseconds:Date.now()-started});console.log('BROWSER PASS '+name);}catch(error){results.steps.push({name,status:'failed',error:redact(error.message)});if(currentPage)await shot(currentPage,'failure-'+results.steps.length).catch(()=>{});await persist();throw Error('Browser journey failed: '+name+'; see retained redacted results.');}await persist();}
  async function go(page,path){currentPage=page;await page.goto(origin+path);}
  async function json(actor,path,options={}){const r=await actors[actor].context.request.fetch(origin+'/api'+path,{...options,headers:{Origin:origin,'X-TGP-Request':'1',...options.headers}});return {status:r.status(),body:await r.json()};}
  async function posted(page,path,click){const response=page.waitForResponse(r=>r.url()===origin+'/api'+path&&r.request().method()==='POST');await click();const r=await response;assert(r.status()>=200&&r.status()<300,'POST failed: '+path+' '+r.status());return (await r.json()).data;}
  async function queue(actor,kind,id){const p=actors[actor].page;await go(p,'/approvals');await p.getByRole('button',{name:kind,exact:true}).click();await p.getByRole('button',{name:`Review ${kind.toLowerCase()} ${id}`,exact:true}).click();await p.getByRole('region',{name:'Workflow details'}).waitFor();return p;}
  async function report(stage){const p=actors.admin.page;await go(p,'/reports');await p.getByRole('heading',{name:'Reports',exact:true}).waitFor();await p.getByText('No automatic refund, credit or exchange adjustment is included.',{exact:false}).waitFor();const day=new Date(Date.now()+8*3600000).toISOString().slice(0,10);const r=await json('admin',`/reports/sales?from=${day}&to=${day}&period=day`);assert.equal(r.status,200);assert.equal(Number(r.body.sales_amount),224);await p.getByText('PHP 224.00',{exact:true}).first().waitFor();await shot(p,'report-'+stage);}
  let receipt,adjustment,rejectedAdjustment,pendingReturn,acceptedReturn,disposition;
  try{
    await step('Chrome launch, real login and role-specific navigation',async()=>{
      for(const label of ['employee','manager','admin','pharmacist']){
        const user=manifest.users.find(u=>u.label===label),context=await browser.newContext({viewport:results.viewport,locale:'en-PH',timezoneId:'Asia/Manila'});
        await context.route('**/*',route=>{const u=new URL(route.request().url());if(['http:','https:'].includes(u.protocol)&&u.hostname!=='127.0.0.1'){results.externalRequests.push(u.origin+u.pathname);return route.abort();}return route.continue();});
        const page=await context.newPage();page.setDefaultTimeout(12000);actors[label]={context,page};currentPage=page;
        page.on('pageerror',e=>results.runtimeErrors.push(redact(e.message)));
        page.on('response',r=>{if(r.status()>=400&&r.url().includes('/api/'))results.httpErrors.push({path:new URL(r.url()).pathname,status:r.status()});});
        await go(page,'/login');await page.getByRole('heading',{name:'Welcome back.'}).waitFor();
        if(manifest.frontendMode==='production-bundle'){
          const scripts=await page.locator('script[src]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('src')));
          assert(scripts.some(src=>src.startsWith('/assets/')&&src.endsWith('.js')));assert(!scripts.some(src=>src.includes('@vite')||src.includes('/src/')));
        }
        if(label==='employee')await shot(page,'login');
        await page.getByLabel('Username',{exact:true}).fill(user.username);await page.getByLabel('Password',{exact:true}).fill(user.password);await page.getByRole('button',{name:'Sign in',exact:true}).click();
        await page.waitForURL(origin+'/'+user.role);await page.getByRole('link',{name:'Returns',exact:true}).waitFor();
        const caps=await json(label,'/workflows/capabilities');assert.equal(caps.body.data.enabled,true);assert.equal(caps.body.data.restocking_enabled,true);assert.equal(caps.body.data.senior_pwd_enabled,false);
        if(label==='employee'){assert.equal(await page.getByRole('link',{name:'Approvals',exact:true}).count(),0);assert.equal(await page.getByRole('link',{name:'User accounts',exact:true}).count(),0);await shot(page,'employee-navigation');}
        if(label==='manager')assert.equal(await page.getByRole('link',{name:'User accounts',exact:true}).count(),0);
        if(label==='admin')await shot(page,'admin-overview');
      }
    });
    await step('POS cash checkout, FEFO selection and real receipt',async()=>{
      const p=actors.employee.page;await go(p,'/pos');await p.getByRole('button',{name:'Add UAT FEFO medicine',exact:true}).click();await p.getByLabel('Quantity for UAT FEFO medicine').fill('2');await p.getByRole('button',{name:'Review total',exact:true}).click();await p.getByLabel('Cash received (PHP)').fill('300');
      await shot(p,'pos-reviewed');const data=await posted(p,'/pos/checkout',()=>p.getByRole('button',{name:'Complete cash sale',exact:true}).click());receipt=data.receipt;
      assert.equal(Number(receipt.total_amount),224);assert.equal(receipt.items[0].batch_id,301);assert.equal(receipt.items[0].quantity,2);assert.equal(Number(receipt.payments[0].change_due),76);
      assert(Math.abs(Date.now()-Date.parse(receipt.sale_date))<60000,'Receipt instant must match actual checkout time on a Manila host');
      await p.getByRole('dialog',{name:'Transaction complete'}).waitFor();
      const localReceiptTime=await p.evaluate(value=>new Date(value).toLocaleString('en-PH',{timeZone:'Asia/Manila'}),receipt.sale_date);
      await p.getByText('Cashier: '+receipt.username+' · '+localReceiptTime,{exact:true}).waitFor();
      await shot(p,'pos-receipt');await p.getByRole('button',{name:'Back to POS',exact:true}).click();
      await p.getByRole('button',{name:'Last receipt',exact:true}).click();await p.getByRole('dialog',{name:'Transaction complete'}).waitFor();await p.keyboard.press('Escape');await p.getByRole('dialog',{name:'Transaction complete'}).waitFor({state:'hidden'});
      const inventory=await json('admin','/inventory/batches?limit=100');assert.equal(inventory.body.data.find(b=>b.batch_id===301).qty_on_hand,3);assert.equal(inventory.body.data.find(b=>b.batch_id===303).qty_on_hand,3);assert.equal(inventory.body.data.find(b=>b.batch_id===304).qty_on_hand,3);
    });
    await step('Adjustment request and independent approval with once-only posting',async()=>{
      const p=actors.employee.page;await go(p,'/adjustments');await p.getByLabel('Find product or batch').fill('UAT-LATER');await p.getByRole('button',{name:'Search adjustment batches',exact:true}).click();await p.getByRole('button',{name:'Use batch UAT-LATER',exact:true}).click();assert.equal(await p.getByLabel('Original batch ID').inputValue(),'302');await shot(p,'batch7-adjustment-picker');
      await p.getByLabel('Quantity change (negative to deduct)').fill('-1');await p.getByLabel('Reason',{exact:true}).fill('SYNTHETIC UAT counted discrepancy');adjustment=await posted(p,'/workflows/adjustments',()=>p.getByRole('button',{name:'Submit adjustment request',exact:true}).click());await p.getByRole('heading',{name:'Request #'+adjustment.adjustment_id,exact:true}).waitFor();await shot(p,'adjustment-request');
      const m=await queue('manager','Adjustments',adjustment.adjustment_id);await posted(m,`/workflows/adjustments/${adjustment.adjustment_id}/decision`,()=>m.getByRole('button',{name:'Approve and post stock',exact:true}).click());await m.getByText('approved',{exact:true}).last().waitFor();await m.getByRole('heading',{name:'Recorded audit history (Asia/Manila)',exact:true}).waitFor();await shot(m,'adjustment-approved');
      const audited=(await json('manager',`/workflows/adjustments/${adjustment.adjustment_id}`)).body.data.history;assert(audited.every(h=>Math.abs(Date.now()-Date.parse(h.logged_at))<600000));
      const repeat=await json('manager',`/workflows/adjustments/${adjustment.adjustment_id}/decision`,{method:'POST',data:{decision:'approved'}});assert.equal(repeat.status,409);
      assert.equal((await json('admin','/inventory/batches?limit=100')).body.data.find(b=>b.batch_id===302).qty_on_hand,54);
    });
    await step('Adjustment rejection and management no-self-approval',async()=>{
      const p=actors.employee.page;await go(p,'/adjustments');await p.getByLabel('Original batch ID').fill('302');await p.getByLabel('Quantity change (negative to deduct)').fill('-2');await p.getByLabel('Reason',{exact:true}).fill('SYNTHETIC UAT unsubstantiated adjustment');rejectedAdjustment=await posted(p,'/workflows/adjustments',()=>p.getByRole('button',{name:'Submit adjustment request',exact:true}).click());
      const m=await queue('manager','Adjustments',rejectedAdjustment.adjustment_id);await m.getByLabel('Rejection reason').fill('SYNTHETIC UAT evidence rejected');await posted(m,`/workflows/adjustments/${rejectedAdjustment.adjustment_id}/decision`,()=>m.getByRole('button',{name:'Reject request',exact:true}).click());await shot(m,'adjustment-rejected');
      await go(m,'/adjustments');await m.getByLabel('Original batch ID').fill('302');await m.getByLabel('Quantity change (negative to deduct)').fill('-1');await m.getByLabel('Reason',{exact:true}).fill('SYNTHETIC self-review boundary');const own=await posted(m,'/workflows/adjustments',()=>m.getByRole('button',{name:'Submit adjustment request',exact:true}).click());await m.getByText('A different Manager/Admin must review your request.',{exact:true}).waitFor();assert.equal(await m.getByRole('button',{name:'Approve and post stock',exact:true}).count(),0);
      assert.equal((await json('manager',`/workflows/adjustments/${own.adjustment_id}/decision`,{method:'POST',data:{decision:'approved'}})).status,403);
      assert.equal((await json('admin','/inventory/batches?limit=100')).body.data.find(b=>b.batch_id===302).qty_on_hand,54);
    });
    async function newReturn(reason){const p=actors.employee.page;await go(p,'/returns');await p.getByLabel('Original receipt number').fill(receipt.receipt_no);await p.getByRole('button',{name:'Find original receipt',exact:true}).click();await p.getByLabel('Original sold item').selectOption(String(receipt.items[0].sale_item_id));await p.getByLabel('Return quantity').fill('1');await p.getByLabel('Reason',{exact:true}).fill(reason);return posted(p,'/workflows/returns',()=>p.getByRole('button',{name:'Submit return request',exact:true}).click());}
    await step('Return request remains pending; cash-sale report remains recognized',async()=>{pendingReturn=await newReturn('SYNTHETIC UAT first return');await actors.employee.page.getByRole('heading',{name:'Request #'+pendingReturn.return_id,exact:true}).waitFor();await shot(actors.employee.page,'return-pending');await report('pending-return');});
    await step('Independent return rejection with unchanged cash-sale report',async()=>{const p=await queue('admin','Returns',pendingReturn.return_id);await p.getByLabel('Rejection reason').fill('SYNTHETIC UAT return rejected');await posted(p,`/workflows/returns/${pendingReturn.return_id}/decision`,()=>p.getByRole('button',{name:'Reject request',exact:true}).click());await shot(p,'return-rejected');await report('rejected-return');});
    await step('Independent return acceptance and physical receipt into quarantine',async()=>{
      acceptedReturn=await newReturn('SYNTHETIC UAT accepted sealed medicine');const a=await queue('admin','Returns',acceptedReturn.return_id);await posted(a,`/workflows/returns/${acceptedReturn.return_id}/decision`,()=>a.getByRole('button',{name:'Approve',exact:true}).click());await report('accepted-return');
      const p=actors.employee.page;await go(p,'/returns');await p.getByRole('button',{name:'View request '+acceptedReturn.return_id,exact:true}).click();await posted(p,`/workflows/returns/${acceptedReturn.return_id}/receive`,()=>p.getByRole('button',{name:'Confirm full physical receipt into quarantine',exact:true}).click());await p.getByText(/Quarantine remaining: 1/).waitFor();await shot(p,'return-quarantine');
      assert.equal((await json('admin','/inventory/batches?limit=100')).body.data.find(b=>b.batch_id===301).qty_on_hand,3);
    });
    await step('Separate pharmacist disposition, evidence and once-only original-batch restocking',async()=>{
      const m=actors.manager.page;await go(m,'/returns');await m.getByRole('button',{name:'View request '+acceptedReturn.return_id,exact:true}).click();await m.getByLabel('Disposition action').selectOption('restock');await m.getByLabel('Disposition quantity').fill('1');await m.getByLabel('Disposition reason').fill('SYNTHETIC UAT pharmacist suitability review');disposition=await posted(m,'/workflows/dispositions',()=>m.getByRole('button',{name:'Submit disposition request',exact:true}).click());
      const p=await queue('pharmacist','Dispositions',disposition.disposition_id);await p.getByLabel('Current pharmacist authorization').selectOption('901');await p.getByLabel('Pharmacist suitability and storage assessment').fill('SYNTHETIC TEST ONLY: sealed pack and documented storage verified; suitable for restock.');await p.getByRole('checkbox').check();await shot(p,'pharmacist-assessment');await posted(p,`/workflows/dispositions/${disposition.disposition_id}/decision`,()=>p.getByRole('button',{name:'Approve and post stock',exact:true}).click());await shot(p,'restock-approved');
      const r=await json('pharmacist',`/workflows/dispositions/${disposition.disposition_id}/decision`,{method:'POST',data:{decision:'approved',authorization_id:901,restock_eligible:true,assessment:'SYNTHETIC repeat prevention'}});assert.equal(r.status,409);
      assert.equal((await json('admin','/inventory/batches?limit=100')).body.data.find(b=>b.batch_id===301).qty_on_hand,4);
      const ret=(await json('manager','/workflows/returns/'+acceptedReturn.return_id)).body.data;assert.equal(ret.quarantined_remaining,'0');assert.equal(ret.dispositions[0].restock_eligible,true);await report('after-restock');
    });
    await step('Unified PO and Stock-In approvals preserve existing permissions and post once',async()=>{
      const p=actors.manager.page;await go(p,'/approvals');await p.getByRole('button',{name:'Review purchase order 501',exact:true}).click();await posted(p,'/purchase-orders/501/approve',()=>p.getByRole('button',{name:'Approve purchase order',exact:true}).click());
      await p.getByRole('button',{name:/^Stock-in \(/}).click();await p.getByRole('button',{name:'Review stock-in 601',exact:true}).click();await posted(p,'/stock-ins/601/approve',()=>p.getByRole('button',{name:'Approve and post stock',exact:true}).click());await shot(p,'unified-stock-in-approved');
      assert.equal((await json('admin','/inventory/batches?limit=100')).body.data.find(b=>b.batch_id===305).qty_on_hand,4);
      const received=(await json('manager','/stock-ins/601')).body.data;assert(Math.abs(Date.now()-Date.parse(received.date_received))<600000);assert(received.history.every(h=>Math.abs(Date.now()-Date.parse(h.logged_at))<600000));
      await p.getByRole('button',{name:'Returns',exact:true}).click();await p.getByRole('button',{name:'Rejected history',exact:true}).click();await p.getByRole('button',{name:'Review returns '+pendingReturn.return_id,exact:true}).waitFor();await shot(p,'unified-rejected-history');
    });
    await step('Alerts distinguish expired/today/upcoming and Admin-only threshold editing',async()=>{
      const p=actors.admin.page;await go(p,'/reorder-thresholds');await p.getByRole('button',{name:'Edit threshold for UAT threshold unset',exact:true}).click();await p.getByLabel('Reorder level').fill('0');await p.getByRole('button',{name:'Save threshold',exact:true}).click();await p.getByText('Reorder threshold saved.',{exact:true}).waitFor();await shot(p,'admin-reorder-threshold');
      await go(p,'/alerts');await p.getByRole('button',{name:/^Expires today \(/}).click();await p.getByText('UAT-TODAY',{exact:true}).waitFor();await shot(p,'alerts-today');await p.getByRole('button',{name:/^Expired \(/}).click();await p.getByText('UAT-EXPIRED',{exact:true}).waitFor();await p.getByRole('button',{name:/^Upcoming expiry \(/}).click();await p.getByText('UAT-EARLIEST',{exact:true}).waitFor();await shot(p,'alerts-upcoming');
      const e=actors.employee.page;await go(e,'/reorder-thresholds');await e.waitForURL(origin+'/employee');assert.equal(await e.getByRole('heading',{name:'Reorder thresholds',exact:true}).count(),0);
    });
    await step('Admin transaction/category/slow-moving and separate accepted-return reports',async()=>{
      const p=actors.admin.page;await go(p,'/reports');
      await p.getByLabel('Report',{exact:true}).selectOption('transactions');await p.getByRole('cell',{name:receipt.receipt_no,exact:true}).waitFor();
      await p.getByRole('cell',{name:'PHP 224.00',exact:true}).waitFor();await shot(p,'batch5-transactions');
      await p.getByLabel('Report',{exact:true}).selectOption('categories');await p.getByRole('cell',{name:'Test only',exact:true}).waitFor();await p.getByRole('cell',{name:'PHP 224.00',exact:true}).waitFor();await shot(p,'batch5-categories');
      await p.getByLabel('Report',{exact:true}).selectOption('slow-moving');await p.getByRole('cell',{name:'UAT threshold unset',exact:true}).waitFor();await shot(p,'batch5-slow-moving');
      await p.getByLabel('Report',{exact:true}).selectOption('returns');await p.getByRole('cell',{name:'approved',exact:true}).waitFor();await p.getByRole('cell',{name:'rejected',exact:true}).waitFor();await shot(p,'batch5-return-decisions');
      const day=new Date(Date.now()+8*3600000).toISOString().slice(0,10),query=`from=${day}&to=${day}`;
      const rows=(await json('admin','/reports/returns?'+query)).body.data;
      assert.equal(rows.find(r=>r.decision_state==='approved').received_quantity,'1');
      assert.equal((await json('admin','/reports/sales?'+query)).body.sales_amount,'224.00');
      assert.equal((await json('manager','/reports/transactions?'+query)).status,403);
      const capability=await json('employee','/pos/benefits/availability');assert.equal(capability.body.data.available,false);
    });
    await step('Real browser Excel/PDF downloads match displayed sale totals and Admin permissions',async()=>{
      const p=actors.admin.page;await go(p,'/reports');await p.getByText('PHP 224.00',{exact:true}).first().waitFor();
      for(const [format,label]of [['xlsx','Export Excel (.xlsx)'],['pdf','Export PDF']]){
        const pending=p.waitForEvent('download');await p.getByRole('button',{name:label,exact:true}).click();const download=await pending;
        assert.equal(download.suggestedFilename(),'tgp-sales.'+format);const destination=join(manifest.runDir,'downloads','tgp-sales.'+format);await download.saveAs(destination);
        if(format==='xlsx'){
          const workbook=new ExcelJS.Workbook();await workbook.xlsx.readFile(destination);const values=[];workbook.eachSheet(s=>s.eachRow(r=>r.eachCell(c=>values.push(c.value))));assert(values.includes('224.00'));
        }else{
          const {readFile}=await import('node:fs/promises');const task=getDocument({data:new Uint8Array(await readFile(destination)),useSystemFonts:true});const doc=await task.promise;
          try{let text='';for(let i=1;i<=doc.numPages;i++)text+=(await(await doc.getPage(i)).getTextContent()).items.map(item=>item.str).join(' ');assert(text.includes('sales_amount: 224.00'));assert(text.includes('excluded_records: 0'));}finally{await task.destroy();}
        }
      }
      await shot(p,'batch5-export-controls');const m=actors.manager.page;await go(m,'/reports');await m.getByRole('heading',{name:'Reports',exact:true}).waitFor();assert.equal(await m.getByRole('button',{name:'Export PDF',exact:true}).count(),0);
      const day=new Date(Date.now()+8*3600000).toISOString().slice(0,10);assert.equal((await json('manager',`/reports/sales/export?from=${day}&to=${day}&format=xlsx`)).status,403);
    });
    await step('Browser RBAC/CSRF boundaries and statutory checkout remain protected',async()=>{
      assert.equal((await json('employee','/workflows/adjustments/'+adjustment.adjustment_id+'/decision',{method:'POST',data:{decision:'approved'}})).status,403);
      const r=await actors.admin.context.request.post(origin+'/api/workflows/returns/'+acceptedReturn.return_id+'/receive',{data:{}});assert.equal(r.status(),403);
      const p=actors.employee.page;await go(p,'/pos');await p.getByText('Senior/PWD preparation — unavailable',{exact:true}).click();assert.equal(await p.getByLabel('Beneficiary name').isDisabled(),true);assert.equal(await p.getByLabel('Senior/PWD ID',{exact:true}).isDisabled(),true);await shot(p,'statutory-disabled');
      assert.equal(results.externalRequests.length,0);assert.equal(results.runtimeErrors.length,0);
      assert.equal(results.httpErrors.filter(e=>e.status!==401).length,0,'No unexpected background API failures are allowed');
      const original=(await json('admin','/pos/sales/'+receipt.sale_id)).body.data;assert.equal(original.approved_by,null);assert.equal(Number(original.payments[0].amount_paid),300);assert.equal(Number(original.payments[0].change_due),76);
    });
    await step('Admin global audit/account review and Manager direct-route denial',async()=>{
      const p=actors.admin.page;await go(p,'/audit-logs');await p.getByRole('heading',{name:'Audit logs',exact:true}).waitFor();
      await p.getByLabel('Search audit logs',{exact:true}).fill('sale.paid:'+receipt.sale_id);await p.getByRole('button',{name:'Search',exact:true}).click();
      await p.getByRole('cell',{name:'sale.paid:'+receipt.sale_id,exact:true}).waitFor();
      for(const name of ['User','Action','Module','Reference','Time'])await p.getByRole('columnheader',{name,exact:true}).waitFor();
      await shot(p,'batch6-global-audit');
      await go(p,'/users');await p.getByRole('heading',{name:'User accounts',exact:true}).waitFor();await p.getByRole('button',{name:'View account uat_employee',exact:true}).waitFor();await shot(p,'batch6-admin-accounts');
      const m=actors.manager.page;await go(m,'/audit-logs');await m.waitForURL(origin+'/manager');await go(m,'/users');await m.waitForURL(origin+'/manager');
      assert.equal((await json('manager','/audit-logs')).status,403);assert.equal((await json('employee','/auth/users')).status,403);
    });
    await step('Browser logout revokes copied stale cookie and re-login recovers original cashier receipt',async()=>{
      const actor=actors.employee,p=actor.page;await go(p,'/pos');
      const cookie=(await actor.context.cookies(origin+'/api')).find(c=>c.name==='tgp_session');assert(cookie);secrets.push(cookie.value);
      await p.getByRole('button',{name:'Sign out',exact:true}).click();await p.waitForURL(origin+'/login');
      const stale=await actor.context.request.get(origin+'/api/auth/me',{headers:{Cookie:cookie.name+'='+cookie.value}});assert.equal(stale.status(),401);
      await shot(p,'batch6-revoked-session');const user=manifest.users.find(u=>u.label==='employee');
      await p.getByLabel('Username',{exact:true}).fill(user.username);await p.getByLabel('Password',{exact:true}).fill(user.password);await p.getByRole('button',{name:'Sign in',exact:true}).click();await p.waitForURL(origin+'/employee');
      const recovered=await json('employee','/pos/sales/'+receipt.sale_id);assert.equal(recovered.status,200);assert.equal(recovered.body.data.receipt_no,receipt.receipt_no);assert.equal(Number(recovered.body.data.total_amount),224);
      const stillStale=await actor.context.request.get(origin+'/api/auth/me',{headers:{Cookie:cookie.name+'='+cookie.value}});assert.equal(stillStale.status(),401);
      assert.equal((await json('employee','/auth/me')).status,200);await shot(p,'batch6-relogin');
      assert.equal(results.runtimeErrors.length,0);assert.equal(results.externalRequests.length,0);assert(results.httpErrors.every(e=>e.path==='/api/auth/me'&&e.status===401));
    });
    await step('Within-category rankings, exact filtered Excel/PDF exports and recorded-vs-within-date stock',async()=>{
      const p=actors.admin.page;await go(p,'/reports');await p.getByLabel('Report',{exact:true}).selectOption('best-selling');await p.getByRole('columnheader',{name:'Rank in category',exact:true}).waitFor();
      await p.getByLabel('Category (exact current label)').fill('Test only');await p.getByRole('button',{name:'Apply / refresh',exact:true}).click();await p.getByRole('cell',{name:'UAT FEFO medicine',exact:true}).waitFor();await p.getByRole('cell',{name:'PHP 224.00',exact:true}).waitFor();await shot(p,'batch7-category-rank');
      for(const [format,label]of [['xlsx','Export Excel (.xlsx)'],['pdf','Export PDF']]){
        const pending=p.waitForEvent('download');await p.getByRole('button',{name:label,exact:true}).click();const file=await pending;const destination=join(manifest.runDir,'downloads','tgp-best-selling.'+format);await file.saveAs(destination);
        if(format==='xlsx'){
          const book=new ExcelJS.Workbook();await book.xlsx.readFile(destination);const rows=[];book.getWorksheet('Report').eachRow(row=>rows.push(row.values.slice(1)));assert(rows.some(row=>row[0]==='Test only'&&row[1]==='1'&&row[3]==='UAT FEFO medicine'&&row[5]==='224.00'));
        }else{
          const {readFile}=await import('node:fs/promises');const task=getDocument({data:new Uint8Array(await readFile(destination)),useSystemFonts:true});const doc=await task.promise;
          try{let text='';for(let i=1;i<=doc.numPages;i++)text+=(await(await doc.getPage(i)).getTextContent()).items.map(item=>item.str).join(' ');assert(text.includes('category_rank: 1'));assert(text.includes('sales_amount: 224.00'));}finally{await task.destroy();}
        }
      }
      await p.getByLabel('Report',{exact:true}).selectOption('slow-moving');await p.getByRole('cell',{name:'UAT threshold unset',exact:true}).waitFor();await shot(p,'batch7-slow-rank');
      const product=(await json('employee','/products?q=UAT%20FEFO')).body.data[0];assert.equal(product.qty_on_hand,'68');assert.equal(product.within_date_qty,'62');assert.equal(product.expired_or_today_qty,'6');assert(!Object.hasOwn(product,'cost_price'));
      await go(p,'/products');await p.getByText('Within-date (expiry only): 62',{exact:true}).waitFor();await shot(p,'batch7-expiry-stock');
    });
    await step('Admin browser-local notification preferences persist without suppressing safety alerts or changing other roles',async()=>{
      const p=actors.admin.page;await go(p,'/notifications');await p.getByRole('heading',{name:'Notification preferences',exact:true}).waitFor();
      const checkbox=p.getByRole('checkbox',{name:'Upcoming-expiry dashboard reminders',exact:true});assert.equal(await checkbox.isChecked(),true);await checkbox.uncheck();await p.reload();assert.equal(await p.getByRole('checkbox',{name:'Upcoming-expiry dashboard reminders',exact:true}).isChecked(),false);await shot(p,'batch7-notification-preferences');
      await go(p,'/admin');await p.getByRole('heading',{name:'Needs your attention',exact:true}).waitFor();await p.getByText('UAT threshold unset is running low',{exact:true}).waitFor();assert.equal(await p.getByText('UAT FEFO medicine · Batch UAT-EARLIEST',{exact:true}).count(),0);
      await go(p,'/alerts');await p.getByRole('button',{name:/^Upcoming expiry \(/}).click();await p.getByText('UAT-EARLIEST',{exact:true}).waitFor();await shot(p,'batch7-safety-alerts-retained');
      const preferences=await p.evaluate(()=>JSON.parse(localStorage.getItem('tgp.dashboard-reminders.v1.103')));assert.deepEqual(preferences,{version:1,low_stock:true,upcoming_expiry:false});
      await go(p,'/notifications');await p.getByRole('checkbox',{name:'Upcoming-expiry dashboard reminders',exact:true}).check();
      const m=actors.manager.page;await go(m,'/notifications');await m.waitForURL(origin+'/manager');const e=actors.employee.page;await go(e,'/notifications');await e.waitForURL(origin+'/employee');
      assert.equal(results.runtimeErrors.length,0);assert.equal(results.externalRequests.length,0);assert(results.httpErrors.every(error=>error.path==='/api/auth/me'&&error.status===401));
    });
    results.outcome={receipt:receipt.receipt_no,saleId:receipt.sale_id,adjustment:adjustment.adjustment_id,rejectedAdjustment:rejectedAdjustment.adjustment_id,rejectedReturn:pendingReturn.return_id,acceptedReturn:acceptedReturn.return_id,disposition:disposition.disposition_id,cashSaleAmount:'224.00',originalBatchFinalQuantity:4};
    console.log(JSON.stringify({browser:results.browser,browserStepsPassed:results.steps.length,screenshots:results.screenshots.length,runtimeErrors:results.runtimeErrors.length,results:join(manifest.runDir,'browser-results.json')}));
  }finally{await persist();await browser.close();}
}
