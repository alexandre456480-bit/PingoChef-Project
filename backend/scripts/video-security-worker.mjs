// Local-only integration worker. Never loads .env or accepts a remote database.
import pg from 'pg';
let input='';for await (const chunk of process.stdin) input+=chunk;
const {config,args}=JSON.parse(input);
if(config.host!=='127.0.0.1'||config.database!=='postgres')throw new Error('Local PostgreSQL only');
const pool=new pg.Pool({...config,max:4});
try {
  const results=await Promise.all(Array.from({length:50},async()=>{
    const {rows}=await pool.query('SELECT consume_video_security_budget($1,$2,$3,$4,$5,$6,$7,$8,$9) value',args);
    return rows[0].value;
  }));
  process.stdout.write(JSON.stringify({allowed:results.filter(r=>r.allowed).length}));
} finally {await pool.end();}
