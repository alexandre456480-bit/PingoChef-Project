import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { stagingConfig } from '../../frontend/scripts/create-staging-config.mjs';
import { checkedMigrations } from './check-migrations.mjs';
import { restrictionSettings } from './configure-mux-playback-restriction.mjs';

const run=(script,input='',env={})=>spawnSync(process.execPath,[fileURLToPath(new URL(script,import.meta.url))],{
  input,encoding:'utf8',env:{SystemRoot:process.env.SystemRoot,NODE_ENV:'test',...env},timeout:10000});
test('official migration manifest is complete, ordered and unique',async()=>assert.equal((await checkedMigrations()).length,39));
test('staging proxy preserves headers but cannot point to production',()=>{
  const base={headers:[{source:'/(.*)',headers:[{key:'security',value:'keep'}]}],rewrites:[{source:'/api/:path*',destination:'https://production.example/api/:path*'},{source:'/(.*)',destination:'/index.html'}]};
  const safe=stagingConfig(base,'https://staging.example','https://production.example');
  assert.equal(safe.rewrites[0].destination,'https://staging.example/api/:path*');assert.deepEqual(safe.headers,base.headers);
  for(const url of ['https://production.example','http://staging.example','https://staging.example/path','https://name:password@staging.example'])
    assert.throws(()=>stagingConfig(base,url,'https://production.example'));
});
test('offline percentiles retain every performance metric and discard sensitive extras/labels',()=>{
  const row={event:'request_performance',method:'GET',endpoint:'/api/v1/items',status:200,
    duration_ms:10,auth_ms:2,database_ms:4,database_calls:3,external_ms:1,external_calls:1,
    email:'private@example.test',business_id:'tenant-secret',cookie:'secret-cookie'};
  const lines=[row,{...row,duration_ms:20},{...row,duration_ms:30},{...row,endpoint:'/api/v1/public/menu/private-slug'},
    {...row,endpoint:'/api/v1/items?token=secret'}, {...row,database_calls:-1},null];
  const result=run('./summarize-performance.mjs',lines.map(v=>JSON.stringify(v)).join('\n'));
  assert.equal(result.status,0,result.stderr);
  const output=JSON.parse(result.stdout);assert.equal(output.rows.length,1);assert.equal(output.rejected,3);
  assert.equal(output.rows[0].samples,3);assert.deepEqual(output.rows[0].metrics.duration_ms,{p50:20,p95:30,p99:30});
  assert.equal(Object.keys(output.rows[0].metrics).length,6);assert.doesNotMatch(result.stdout,/private|tenant-secret|cookie|email|token/);
});
test('operational write tools refuse production before opening any connection',()=>{
  for(const script of ['./backfill-private-images.mjs','./recover-performance-index.mjs']) {
    const result=run(script,'',{DEPLOYMENT_ENV:'production'});assert.notEqual(result.status,0);
    assert.match(result.stderr,/staging/i);
  }
});
test('Mux restrictions accept only explicit domains and deny missing referrer/high-risk UA',()=>{
  const settings=restrictionSettings({MUX_PLAYBACK_ALLOWED_DOMAINS:'stage.example.com,www.stage.example.com'});
  assert.equal(settings.referrer.allow_no_referrer,false);
  assert.equal(settings.user_agent.allow_high_risk_user_agent,false);
  for(const domains of ['*','*.example.com','localhost','https://example.com','example.com/path','127.0.0.1'])
    assert.throws(()=>restrictionSettings({MUX_PLAYBACK_ALLOWED_DOMAINS:domains}));
  const blocked=run('./configure-mux-playback-restriction.mjs','',{DEPLOYMENT_ENV:'production'});
  assert.notEqual(blocked.status,0);
  const dry=run('./configure-mux-playback-restriction.mjs','',{DEPLOYMENT_ENV:'staging',MUX_PLAYBACK_ALLOWED_DOMAINS:'stage.example.com'});
  assert.equal(dry.status,0,dry.stderr);assert.equal(JSON.parse(dry.stdout).mode,'DRY_RUN');
});
