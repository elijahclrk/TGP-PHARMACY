import {test} from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {generateReportExport,safeSpreadsheetText} from '../src/services/report-exports.js';
test('XLSX preserves exact money, escapes formulas and excludes beneficiary data',async()=>{
  const bytes=await generateReportExport('products','xlsx',{data:[{name:'  =HYPERLINK("bad")',category:'@attack',units:'1',transactions:1,sales_amount:'9007199254740993.01',customer_name:'SECRET NAME',senior_pwd_id:'SECRET ID'}],total:1},{from:'2026-01-01',to:'2026-01-02'});
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(bytes);
  const values=[];workbook.eachSheet(sheet=>sheet.eachRow(row=>row.eachCell(cell=>{assert.notEqual(cell.type,ExcelJS.ValueType.Formula);values.push(cell.value)})));
  assert(values.includes('9007199254740993.01'));assert(values.includes("'  =HYPERLINK(\"bad\")"));
  assert(!values.includes('SECRET NAME'));assert(!values.includes('SECRET ID'));
  for(const text of ['=1','+1','-1','@cmd','\t=1','\r@cmd'])assert.equal(safeSpreadsheetText(text),"'"+text);
});
test('PDF is readable, paginates and preserves report amounts/coverage without customer identity',async()=>{
  const bytes=await generateReportExport('transactions','pdf',{data:Array.from({length:45},(_,i)=>({receipt_no:'POS-'+i,business_time:'2026-11-21 12:00:00',cashier:'Peña ₱ α',sales_amount:'9007199254740993.01',cash_tendered:'9007199254740994.00',change_due:'0.99',return_requests:2,customer_name:'PRIVATE BENEFICIARY'})),excluded_records:3},{from:'2026-11-21',to:'2026-11-21'});
  const task=getDocument({data:new Uint8Array(bytes),useSystemFonts:true});const doc=await task.promise;
  try{assert(doc.numPages>1);let text='';for(let i=1;i<=doc.numPages;i++)text+=(await(await doc.getPage(i)).getTextContent()).items.map(x=>x.str).join(' ');
    assert(text.includes('9007199254740993.01'));assert(text.includes('POS-44'));assert(text.includes('excluded_records: 3'));assert(text.includes('Peña ₱ α'));assert(!text.includes('PRIVATE BENEFICIARY'));
  }finally{await task.destroy();}
});
