import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import {fileURLToPath} from 'node:url';

// Explicit allowlist: beneficiary identifiers, names and free-text return reasons
// are never included. Decimal monetary strings stay exact, including above 2^53.
export const reportColumns={
  exchanges:['exchange_id','receipt_no','business_time','return_value','replacement_value','additional_cash','tender','change_due','replacement_units'],
  sales:['period_start','transactions','reviewed','unreviewed','sales_amount'],
  products:['name','category','units','transactions','sales_amount'],
  transactions:['receipt_no','business_time','cashier','item_count','sales_amount','cash_tendered','change_due','return_requests','benefit_type','gross_amount','discount_amount','vat_removed_amount','vat_amount'],
  categories:['current_category','units','transactions','sales_amount'],
  'best-selling':['current_category','category_rank','product_id','name','units','sales_amount'],
  'slow-moving':['current_category','category_rank','product_id','name','units','sales_amount'],
  returns:['return_id','receipt_no','quantity','decision_state','received_quantity','recorded_time'],
  'low-stock':['name','qty_on_hand','within_date_qty','expired_or_today_qty','reorder_level'],
  'near-expiry':['product_name','batch_no','expiry_date','qty_on_hand'],
  valuation:['expiry_group','batches','unverified_batches','cost_value'],
  profit:['sales_amount','cost_amount','gross_profit','gross_margin_percent','unverified_lines','lines'],
};
export function safeSpreadsheetText(value){
  const text=String(value??'Unavailable');
  return /^[\s\u0000-\u001f]*[=+\-@]/.test(text)?"'"+text:text;
}
export async function generateReportExport(kind,format,result,filters){
  const columns=reportColumns[kind];
  if(!columns)throw new Error('Unsupported export');
  const rows=kind==='profit'?[result]:result.data??[];
  const summary=Object.entries(result).filter(([key,value])=>!['data','page','limit'].includes(key)&&value!==undefined&&typeof value!=='object');
  const notes=[`TGP Pharmacy - ${kind}`,`Filters: ${JSON.stringify(filters)}`,
    'PHP amounts are exact decimal text. Times use Asia/Manila; return recorded dates are dates.',
    'Cash sales are not reversed by return requests or acceptance. Replacement value and return value applied are not additional cash. Exchange tax/revenue adjustments are not implied.',
    'Categories are current catalog categories. Slow-moving means units <= selected max_units in the selected period.',
    'Category ranks use reconciled units: descending for best-selling (positive units), ascending for slow-moving (including zero). Ties share a dense rank; no revenue-based score is inferred.',
    'Recorded inventory includes expired/today stock. Within-date quantity is an expiry-only measure, excludes expired/today and is unavailable for uncertain quantity/expiry; it is not quarantine certification.',
    'Cost/profit figures are estimates using verified batch costs; unavailable costs are withheld. Not net profit. Discounted-sale profit estimates remain unavailable pending an approved accounting basis.'];
  if(format==='xlsx'){
    const book=new ExcelJS.Workbook();book.creator='TGP Pharmacy';
    const sheet=book.addWorksheet('Report');
    for(const note of notes)sheet.addRow([safeSpreadsheetText(note)]);
    sheet.addRow([]);sheet.addRow(columns);
    for(const row of rows)sheet.addRow(columns.map(key=>safeSpreadsheetText(row[key])));
    const totals=book.addWorksheet('Summary');totals.addRow(['Measure','Value']);
    for(const [key,value]of summary)totals.addRow([key,safeSpreadsheetText(value)]);
    for(const page of book.worksheets){page.getRow(1).font={bold:true};page.columns.forEach(column=>{column.width=25});}
    return Buffer.from(await book.xlsx.writeBuffer());
  }
  if(format!=='pdf')throw new Error('Unsupported export format');
  const doc=new PDFDocument({size:'A4',margin:36,info:{Title:`TGP Pharmacy ${kind}`}});
  const chunks=[];const completed=new Promise((resolve,reject)=>{doc.on('data',chunk=>chunks.push(chunk));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject)});
  const printable=value=>String(value??'Unavailable').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g,' ');
  doc.font(fileURLToPath(new URL('../assets/fonts/NotoSans.ttf',import.meta.url))).fontSize(10);
  for(const note of notes)doc.text(printable(note)).moveDown(0.5);
  for(const row of rows){
    if(doc.y>690)doc.addPage();
    for(const key of columns)doc.text(`${key}: ${printable(row[key])}`,{width:520});
    doc.moveDown();
  }
  doc.moveDown().text('Summary');for(const[key,value]of summary)doc.text(`${key}: ${printable(value)}`);
  doc.end();return completed;
}
