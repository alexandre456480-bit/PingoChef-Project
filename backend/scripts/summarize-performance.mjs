import { createInterface } from 'node:readline';

// Offline log export only. Strict labels and field projection discard sensitive extras.
const areas=['auth','admin','categories','subcategories','items','design','public','business','analytics','qr','internal','webhooks','health','other'];
const endpoints=new Set(areas.map(a=>`/api/v1/${a}`));
for(const [area,paths] of Object.entries({auth:['me','login','logout','logout-all','register','recover','reset-password'],business:['publish'],items:['reorder'],analytics:['options','rankings','product-trends','qr','export.csv'],public:['menu/:slug','other']}))
  for(const path of paths) endpoints.add(`/api/v1/${area}/${path}`);
const metrics=['duration_ms','auth_ms','database_ms','database_calls','external_ms','external_calls'];
const groups=new Map();let rejected=0,totalSamples=0;
for await(const line of createInterface({input:process.stdin,crlfDelay:Infinity})) {
  if(line.length>16384){rejected++;continue;}
  let row;try{row=JSON.parse(line);}catch{continue;}
  if(row?.event!=='request_performance')continue;
  if(!endpoints.has(row.endpoint)||!['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'].includes(row.method)
    ||!Number.isInteger(row.status)||row.status<100||row.status>599
    ||metrics.some(k=>!Number.isFinite(row[k])||row[k]<0||row[k]>3600000||(k.endsWith('_calls')&&!Number.isInteger(row[k])))) {rejected++;continue;}
  const key=`${row.method} ${row.endpoint} ${row.status}`;
  // Global cap bounds memory as well as per-group cardinality.
  if(!groups.has(key)){if(groups.size>=300){rejected++;continue;}groups.set(key,[]);}
  const values=groups.get(key);
  if(values.length>=10000 || totalSamples>=100000){rejected++;continue;}
  values.push(metrics.map(k=>row[k]));
  totalSamples++;
}
const rows=[...groups].map(([endpoint,values])=>({endpoint,samples:values.length,
  metrics:Object.fromEntries(metrics.map((name,index)=>{
    const sorted=values.map(v=>v[index]).sort((a,b)=>a-b);
    const p=q=>sorted[Math.ceil(sorted.length*q)-1]??null;
    return [name,{p50:p(.5),p95:p(.95),p99:p(.99)}];
  }))}));
console.log(JSON.stringify({rows,rejected,sample_cap_per_group:10000,total_sample_cap:100000},null,2));
