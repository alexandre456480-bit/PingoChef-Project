import type { AdminFilter } from './admin-api.service';

export const ADMIN_PRESETS = [
  ['today','Hoje'],['yesterday','Ontem'],['last7','Últimos 7 dias'],
  ['last30','Últimos 30 dias'],['thisMonth','Este mês'],['previousMonth','Mês anterior'],
  ['last3Months','Últimos 3 meses'],['last6Months','Últimos 6 meses'],
  ['thisYear','Este ano'],['previousYear','Ano anterior']
] as const;

type Parts = { year: number; month: number; day: number };
function parts(date: Date, timezone: string): Parts {
  const values = new Intl.DateTimeFormat('en-US', { timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const number = (key: string) => Number(values.find(value => value.type === key)?.value || 0);
  return { year: number('year'), month: number('month'), day: number('day') };
}
function localMidnight(input: Parts, timezone: string): Date {
  const expected = Date.UTC(input.year,input.month-1,input.day);
  let candidate = expected;
  for (let i = 0; i < 4; i++) {
    const actual = parts(new Date(candidate),timezone);
    const actualUtc = Date.UTC(actual.year,actual.month-1,actual.day);
    if (actualUtc === expected) break;
    candidate += expected - actualUtc;
  }
  // Resolve the local clock offset, including seasonal offset changes.
  const format = new Intl.DateTimeFormat('en-US',{ timeZone: timezone, hour:'2-digit',
    minute:'2-digit',second:'2-digit',hourCycle:'h23' });
  for (let i=0;i<3;i++) {
    const values = format.formatToParts(new Date(candidate));
    const number = (key:string) => Number(values.find(value=>value.type===key)?.value||0);
    const seconds = number('hour')*3600+number('minute')*60+number('second');
    if (!seconds) break;
    candidate -= seconds*1000;
  }
  return new Date(candidate);
}
function shiftDay(value: Parts, count: number): Parts {
  const shifted = new Date(Date.UTC(value.year,value.month-1,value.day+count));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth()+1, day: shifted.getUTCDate() };
}
function shiftMonth(value: Parts, count: number): Parts {
  const shifted = new Date(Date.UTC(value.year,value.month-1+count,1));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth()+1, day: 1 };
}
export function autoGranularity(from: Date, to: Date): AdminFilter['granularity'] {
  const days = (to.getTime()-from.getTime())/86400000;
  return days <= 2 ? 'hour' : days <= 45 ? 'day' : days <= 180 ? 'week' : days <= 730 ? 'month' : 'year';
}
export function presetFilter(preset='last30',timezone='America/Sao_Paulo',now=new Date()): AdminFilter {
  const today = parts(now,timezone);
  let start: Parts; let end: Parts;
  switch (preset) {
    case 'today': start=today;end=shiftDay(today,1);break;
    case 'yesterday': start=shiftDay(today,-1);end=today;break;
    case 'last7': start=shiftDay(today,-6);end=shiftDay(today,1);break;
    case 'thisMonth': start={...today,day:1};end=shiftDay(today,1);break;
    case 'previousMonth': start=shiftMonth(today,-1);end={...today,day:1};break;
    case 'last3Months': start=shiftMonth(today,-2);end=shiftDay(today,1);break;
    case 'last6Months': start=shiftMonth(today,-5);end=shiftDay(today,1);break;
    case 'thisYear': start={year:today.year,month:1,day:1};end=shiftDay(today,1);break;
    case 'previousYear': start={year:today.year-1,month:1,day:1};end={year:today.year,month:1,day:1};break;
    default: preset='last30';start=shiftDay(today,-29);end=shiftDay(today,1);
  }
  const from = localMidnight(start,timezone); const to = localMidnight(end,timezone);
  return { from:from.toISOString(),to:to.toISOString(),timezone,
    granularity:autoGranularity(from,to),comparison:'none',preset };
}
export function customFilter(mode:'day'|'month'|'year'|'range',first:string,last:string,
  timezone:string,comparison:AdminFilter['comparison']): AdminFilter {
  const parseDay=(value:string):Parts=>{
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Informe uma data válida.');
    const [year,month,day]=value.split('-').map(Number);
    const candidate=new Date(Date.UTC(year,month-1,day));
    if (candidate.getUTCFullYear()!==year||candidate.getUTCMonth()+1!==month||candidate.getUTCDate()!==day)
      throw new Error('Informe uma data válida.');
    return {year,month,day};
  };
  let start:Parts;let end:Parts;
  if(mode==='month') {
    if(!/^\d{4}-\d{2}$/.test(first)) throw new Error('Informe um mês válido.');
    start=parseDay(`${first}-01`);end=shiftMonth(start,1);
  } else if(mode==='year') {
    if(!/^\d{4}$/.test(first)) throw new Error('Informe um ano válido.');
    start={year:Number(first),month:1,day:1};end={year:start.year+1,month:1,day:1};
  } else {
    start=parseDay(first);end=shiftDay(parseDay(mode==='range'?last:first),1);
  }
  const from=localMidnight(start,timezone);
  let to=localMidnight(end,timezone);
  const tomorrow=localMidnight(shiftDay(parts(new Date(),timezone),1),timezone);
  if(to>tomorrow&&from<tomorrow) to=tomorrow;
  if(to<=from||to.getTime()-from.getTime()>730*86400000||to>tomorrow)
    throw new Error('O intervalo deve ser válido, até dois anos e sem datas futuras.');
  return {from:from.toISOString(),to:to.toISOString(),timezone,
    granularity:autoGranularity(from,to),comparison,preset:mode};
}
export function filterFromParams(params: Record<string,string|null>): AdminFilter {
  const base=presetFilter();
  const from=params['from'],to=params['to'];
  const timezone=params['timezone']||base.timezone;
  try { new Intl.DateTimeFormat('en-US',{timeZone:timezone}); } catch { return base; }
  if(!from||!to||!Number.isFinite(Date.parse(from))||!Number.isFinite(Date.parse(to))) return base;
  const first=new Date(from),last=new Date(to);
  if(last<=first||last.getTime()-first.getTime()>730*86400000||last.getTime()>Date.now()+86400000) return base;
  const granularity=['hour','day','week','month','year'].includes(params['granularity']||'')
    ? params['granularity'] as AdminFilter['granularity'] : autoGranularity(first,last);
  const spanDays=(last.getTime()-first.getTime())/86400000;
  const safeGranularity=(granularity==='hour'&&spanDays>2)||(granularity==='day'&&spanDays>90)
    ? autoGranularity(first,last):granularity;
  const comparison=['none','previous','year'].includes(params['comparison']||'')
    ? params['comparison'] as AdminFilter['comparison'] : 'none';
  return {from:first.toISOString(),to:last.toISOString(),timezone,granularity:safeGranularity,comparison,
    preset:params['preset']||'custom'};
}
export function periodLabel(filter:AdminFilter):string {
  const formatter=new Intl.DateTimeFormat('pt-BR',{timeZone:filter.timezone,day:'2-digit',month:'2-digit',year:'numeric'});
  return `${formatter.format(new Date(filter.from))} → ${formatter.format(new Date(new Date(filter.to).getTime()-1000))}`;
}
