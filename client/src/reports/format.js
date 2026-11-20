export function php(value) {
  if(value===null || value===undefined)return 'Unavailable';
  const text=String(value);
  if(!/^-?\d+(\.\d+)?$/.test(text))return 'Unavailable';
  const [whole,fraction='']=text.split('.');
  return `PHP ${whole.replace(/\B(?=(\d{3})+(?!\d))/g,',')}.${fraction.padEnd(2,'0')}`;
}
export function manilaDates(now=new Date()) {
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(part=>[part.type,part.value]));
  const today=`${parts.year}-${parts.month}-${parts.day}`;
  const monday=new Date(today+'T00:00:00Z');monday.setUTCDate(monday.getUTCDate()-(monday.getUTCDay()+6)%7);
  return {today,monday:monday.toISOString().slice(0,10)};
}
