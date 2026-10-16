import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export async function verifyVideoSecurity(pool, localConfig) {
  const q = (sql, args) => pool.query(sql, args);
  const scalar = async (sql, args) => (await q(sql, args)).rows[0]?.value;
  const user = randomUUID(), other = randomUUID(), business = randomUUID(), businessB = randomUUID(), admin = randomUUID();
  await q('INSERT INTO auth.users(id,email) VALUES($1,$2),($3,$4),($5,$6)', [user, `${user}@video.test`, other, `${other}@video.test`, admin, `${admin}@video.test`]);
  await q("INSERT INTO profiles(id,full_name) VALUES($1,'Video owner'),($2,'Other owner')",[user,other]);
  await q('INSERT INTO admin_identities(user_id) VALUES($1)', [admin]);
  await q("INSERT INTO businesses(id,owner_user_id,name,slug,status) VALUES($1,$2,'Video A',$3,'ACTIVE'),($4,$5,'Video B',$6,'ACTIVE')",
    [business,user,`video-${business}`,businessB,other,`video-${businessB}`]);
  await q('UPDATE business_account_state SET is_published=true WHERE business_id=ANY($1::uuid[])',[[business,businessB]]);
  const category = (await q("INSERT INTO categories(business_id,name) VALUES($1,'Video') RETURNING id", [business])).rows[0].id;
  const items = [];
  for (let i=0;i<8;i++) items.push((await q('INSERT INTO menu_items(business_id,category_id,name,price,is_available) VALUES($1,$2,$3,10,true) RETURNING id',[business,category,`Video ${i}`])).rows[0].id);
  const policy = {windowSeconds:3600, sessionLimit:20, burstLimit:10000, ipLimit:1200, businessLimit:6000, mediaLimit:3000, globalLimit:10000,
    softThreshold:1500,hardThreshold:9000,hardDenials:1500,blockSeconds:300,autoCircuit:true,uploadLimit:5,uploadWindow:900,uploadDailyLimit:20};
  let media = randomUUID();
  const insertReady = async () => q("INSERT INTO product_media(id,business_id,menu_item_id,media_type,source,status,aspect_ratio,mux_asset_id,mux_playback_id,duration_seconds,is_published) VALUES($1,$2,$3,'video','mux','ready','16:9',$4,$5,8,true)",[media,business,items[0],`asset-${media}`,`play-${media}`]);
  await insertReady();
  const consume = async (changes = {}, policyChanges = {}) => scalar('SELECT consume_video_security_budget($1,$2,$3,$4,$5,$6,$7,$8,$9) value',
    [changes.endpoint||'playback', changes.businessId||business, changes.mediaId||media, changes.session||'a'.repeat(64), changes.ip||'b'.repeat(64),
      changes.preview||false,changes.ownerId||null,changes.playbackId||`play-${media}`,{...policy,...policyChanges}]);
  const reset = async () => {
    await q("DELETE FROM shared_request_quotas WHERE scope LIKE 'video-%'");
    await q("UPDATE video_security_state SET state='NORMAL',expires_at=NULL,manual_until=NULL");
  };
  assert.equal((await consume({businessId:businessB})).allowed,false);
  assert.equal((await consume({playbackId:'foreign-playback'})).allowed,false);
  await q('UPDATE business_account_state SET is_published=false WHERE business_id=$1',[business]);
  assert.equal((await consume()).code,'MEDIA_NOT_AVAILABLE');
  await q('UPDATE business_account_state SET is_published=true WHERE business_id=$1',[business]);
  await q('UPDATE product_media SET is_published=false WHERE id=$1',[media]);
  assert.equal((await consume()).allowed,false);
  assert.equal((await consume({preview:true})).allowed,true);
  await q('UPDATE product_media SET is_published=true WHERE id=$1',[media]);
  await q("SELECT set_business_lifecycle($1,$2,'SUSPENDED','video security test',30)",[admin,business]);
  assert.equal((await consume()).allowed,false);
  await q("SELECT set_business_lifecycle($1,$2,'ACTIVE','video security test',30)",[admin,business]);
  await reset();
  const concurrent = await Promise.all(Array.from({length:100},()=>consume()));
  assert.equal(concurrent.filter(r=>r.allowed).length,20);
  await reset();
  const thousand=(await q("SELECT consume_video_security_budget('playback',$1,$2,$3,$4,false,NULL,$5,$6) AS value FROM generate_series(1,1000)",
    [business,media,'a'.repeat(64),'b'.repeat(64),`play-${media}`,policy])).rows;
  assert.equal(thousand.filter(row=>row.value.allowed).length,20);
  console.log('OK video: 100 concurrent token authorizations share exactly 20 session slots');
  await reset();
  const ipFlood = await Promise.all(Array.from({length:100},(_,i)=>consume({session:randomBytes(32).toString('hex')} ,{ipLimit:30})));
  assert.equal(ipFlood.filter(r=>r.allowed).length,30);
  await reset();
  const mediaFlood = await Promise.all(Array.from({length:100},()=>consume({session:randomBytes(32).toString('hex'),ip:randomBytes(32).toString('hex')},{mediaLimit:25})));
  assert.equal(mediaFlood.filter(r=>r.allowed).length,25);
  await reset();
  const businessFlood = await Promise.all(Array.from({length:100},()=>consume({session:randomBytes(32).toString('hex')},{businessLimit:35})));
  assert.equal(businessFlood.filter(r=>r.allowed).length,35);
  await reset();
  const hard = await Promise.all(Array.from({length:100},()=>consume({}, {sessionLimit:3,softThreshold:10,hardThreshold:40,hardDenials:20,businessLimit:30})));
  assert.equal(hard.filter(r=>r.state==='SOFT_ALERT').length>0,true);
  assert.equal(hard.filter(r=>r.state==='HARD_BLOCK').length>0,true);
  assert.equal(await scalar("SELECT count(*)::int value FROM video_abuse_events WHERE business_id=$1 AND code='CIRCUIT_BREAKER_HARD'",[business]),1);
  assert.equal(await scalar('SELECT business_is_publicly_eligible($1) value',[business]),true);
  await assert.rejects(q("SELECT admin_set_video_security_state($1,$2,'NORMAL',300,'forbidden owner')",[user,business]),/Admin unauthorized/);
  await q("SELECT admin_set_video_security_state($1,$2,'NORMAL',300,'reviewed false positive')",[admin,business]);
  assert.equal(await scalar("SELECT count(*)::int value FROM admin_audit_log WHERE action='VIDEO_SECURITY_OVERRIDE' AND actor_user_id=$1",[admin]),1);
  await q("SELECT admin_set_video_security_state($1,NULL,'HARD_BLOCK',300,'global incident test')",[admin]);
  assert.equal((await consume()).allowed,false);
  assert.equal(await scalar('SELECT business_is_publicly_eligible($1) value',[business]),true);
  await reset();
  if(localConfig) {
    const worker = () => new Promise((resolve,reject)=>{
      const child = spawn(process.execPath,[fileURLToPath(new URL('./video-security-worker.mjs',import.meta.url))],{windowsHide:true,stdio:['pipe','pipe','pipe']});
      let out='',err='';child.stdout.on('data',s=>out+=s);child.stderr.on('data',s=>err+=s);child.on('error',reject);
      child.on('exit',code=>code===0?resolve(JSON.parse(out)):reject(new Error(`Video local worker failed: ${err}`)));
      child.stdin.end(JSON.stringify({config:localConfig,args:['playback',business,media,'c'.repeat(64),'d'.repeat(64),false,null,`play-${media}`,policy]}));
    });
    const results = await Promise.all([worker(),worker()]);
    assert.equal(results.reduce((sum,r)=>sum+r.allowed,0),20);
    console.log('OK video: two independent Node processes / one PostgreSQL share the same quota');
  }
  await reset();
  await q('DELETE FROM product_media WHERE business_id=$1',[business]);
  const reservation = index => ({businessId:business,userId:user,menuItemId:items[index%items.length],ipHash:'f'.repeat(64),
    declaredFileSizeBytes:1024,declaredMimeType:'video/mp4',aspectRatio:'16:9',replacesMediaId:null,dailyLimit:1000,pendingLimit:100,rateLimit:1000,rateWindowSeconds:900});
  const reserve = input => scalar('SELECT reserve_video_upload_secure($1) value',[input]);
  const reservations = await Promise.allSettled(Array.from({length:100},(_,i)=>reserve(reservation(i))));
  assert.equal(reservations.filter(r=>r.status==='fulfilled'&&r.value.mediaId).length,1);
  assert.equal(await scalar("SELECT count(*)::int value FROM product_media WHERE business_id=$1 AND status='waiting'",[business]),1);
  await q('DELETE FROM product_media WHERE business_id=$1',[business]);
  await q('DELETE FROM video_upload_attempts WHERE business_id=$1',[business]);
  const idem = {...reservation(0),idempotencyHash:'e'.repeat(64)};
  const same = await Promise.all(Array.from({length:100},()=>reserve(idem)));
  assert.equal(new Set(same.map(r=>r.mediaId)).size,1);
  assert.equal(same.filter(r=>!r.reused).length,1);
  assert.equal((await reserve({...idem,menuItemId:items[1]})).denialCode,'IDEMPOTENCY_CONFLICT');
  assert.equal((await reserve({...reservation(0),userId:other})).denialCode,'BUSINESS_NOT_AUTHORIZED');
  await q('DELETE FROM product_media WHERE business_id=$1',[business]);
  await q('DELETE FROM video_upload_attempts WHERE business_id=$1',[business]);
  await q("SELECT admin_assign_business_plan($1,$2,'PRO','pending quota test')",[admin,business]);
  const pending = await Promise.all(Array.from({length:100},(_,i)=>reserve({...reservation(i),pendingLimit:3})));
  assert.equal(pending.filter(r=>r.mediaId).length,3);
  assert.equal(pending.some(r=>r.denialCode==='PENDING_UPLOAD_LIMIT_REACHED'),true);
  const uploadAttempts = await Promise.all(Array.from({length:100},()=>consume({endpoint:'upload',ownerId:user})));
  assert.equal(uploadAttempts.filter(r=>r.allowed).length,5);
  console.log('OK video: concurrent commercial capacity, pending quota, intent attempts and idempotency');
  const token1=randomUUID(),token2=randomUUID();
  const claims=await Promise.all([token1,token2].map(t=>scalar('SELECT claim_video_maintenance($1,240) value',[t])));
  assert.equal(claims.filter(Boolean).length,1);
  const winner=claims[0]?token1:token2, loser=claims[0]?token2:token1;
  assert.equal(await scalar('SELECT finish_video_maintenance($1,2,2) value',[loser]),false);
  assert.equal(await scalar('SELECT finish_video_maintenance($1,2,2) value',[winner]),true);
  const event=`video-event-${randomUUID()}`;
  const webhookClaims=await Promise.all(Array.from({length:100},()=>scalar("SELECT claim_mux_webhook_event($1,'video.asset.ready','fixture',300) value",[event])));
  assert.equal(webhookClaims.filter(Boolean).length,1);
  await q("SELECT finish_mux_webhook_event($1,'failed','TEMPORARY_FAILURE')",[event]);
  assert.equal(await scalar("SELECT claim_mux_webhook_event($1,'video.asset.ready','fixture',300) value",[event]),true);
  await q("SELECT finish_mux_webhook_event($1,'processed',NULL)",[event]);
  assert.equal(await scalar("SELECT claim_mux_webhook_event($1,'video.asset.ready','fixture',300) value",[event]),false);
  for(const role of ['anon','authenticated']) {
    assert.equal(await scalar("SELECT has_function_privilege($1,'public.consume_video_security_budget(text,uuid,uuid,text,text,boolean,uuid,text,jsonb)','EXECUTE') value",[role]),false);
    assert.equal(await scalar("SELECT has_table_privilege($1,'public.video_security_state','UPDATE') value",[role]),false);
  }
  const report=await scalar('SELECT admin_video_security_report(1,1) value');
  assert.equal(report.measurement,'ESTIMATED');assert.equal(report.events.length>0,true);
  await q('INSERT INTO shared_request_quotas VALUES($1,$2,now()-interval \'3 days\',1)',['video-retention','9'.repeat(64)]);
  await q('SELECT maintain_video_security_state()');
  assert.equal(await scalar("SELECT count(*)::int value FROM shared_request_quotas WHERE scope='video-retention'"),0);
  console.log('OK video: eligibility/cross-tenant, global kill, audited override, leases, RLS, report and retention');
}
