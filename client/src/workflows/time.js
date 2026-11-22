export function workflowTime(value){
  if(typeof value!=='string'||!/(Z|[+-]\d{2}:\d{2})$/.test(value)||!Number.isFinite(Date.parse(value)))return 'Not recorded'
  return new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Manila',dateStyle:'medium',timeStyle:'medium',hour12:false}).format(new Date(value))
}
