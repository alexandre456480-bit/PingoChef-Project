import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export async function verifyOwnerDatabase(pool) {
  let checks = 0;
  const query = (sql, values) => pool.query(sql, values);
  const value = async (sql, values) => (await query(sql, values)).rows[0]?.value;
  async function check(name, action) { await action(); checks++; console.log(`OK ${name}`); }
  const asOwner = async (id, sql, values) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN'); await client.query('SET LOCAL ROLE authenticated');
      await client.query("SELECT set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: id, iat: Math.floor(Date.now()/1000)+1 })]);
      const result = await client.query(sql, values); await client.query('COMMIT'); return result;
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  };
  const user=randomUUID(), otherUser=randomUUID(), admin=randomUUID(), business=randomUUID(), otherBusiness=randomUUID(), category=randomUUID();
  await query('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES ($1,$2,now()),($3,$4,now()),($5,$6,now())',
    [user,'owner@local.test',otherUser,'other@local.test',admin,'admin@local.test']);
  await query("INSERT INTO profiles(id,full_name) VALUES($1,'Owner'),($2,'Other')",[user,otherUser]);
  await query('INSERT INTO admin_identities(user_id) VALUES($1)',[admin]);
  await query("INSERT INTO businesses(id,owner_user_id,name,slug,status) VALUES($1,$2,'Owner','owner-local','ACTIVE'),($3,$4,'Other','other-local','ACTIVE')",[business,user,otherBusiness,otherUser]);
  await query("INSERT INTO categories(id,business_id,name) VALUES($1,$2,'Main')",[category,business]);
  await check('automatic active Free subscription without provider',async()=>{
    assert.equal(await value("SELECT count(*)::int value FROM subscriptions s JOIN plans p ON p.id=s.plan_id WHERE p.code='FREE' AND s.status='active' AND provider IS NULL"),2);
  });
  await check('session RPC accepts the JWT issue time and removes the old signature',async()=>{
    assert.equal(await value("SELECT count(*)::int value FROM pg_proc WHERE proname='create_owner_session' AND pronamespace='public'::regnamespace AND pronargs=8"),1);
    assert.equal(await value("SELECT count(*)::int value FROM pg_proc WHERE proname='create_owner_session' AND pronamespace='public'::regnamespace AND pronargs=7"),0);
    assert.equal(await value("SELECT create_owner_session($1,$2,'owner','diagnostic',now()-interval '2 minutes',now()-interval '1 minute',NULL,$3) value",[randomBytes(32).toString('hex'),user,Math.floor(Date.now()/1000)]),false);
  });
  await check('exact plan matrix',async()=>{
    const expected={FREE:[10,4,1,false,false,false,false,false],BASIC:[30,10,7,true,false,false,false,false],MEDIUM:[70,25,25,true,true,false,true,true],PRO:[150,40,40,true,true,true,true,true]};
    for(const [code,values] of Object.entries(expected)){
      const snapshot=await value('SELECT jsonb_object_agg(e.feature_key,e.value) value FROM plan_entitlements e JOIN plans p ON p.id=e.plan_id WHERE p.code=$1',[code]);
      assert.deepEqual(['MAX_PRODUCTS','MAX_CATEGORIES','MAX_VIDEOS','ANALYTICS_BASIC','ANALYTICS_ADVANCED','ANALYTICS_EXPORT','QR_GENERATOR','QR_CUSTOMIZATION'].map(key=>snapshot[key]),values);
    }
  });
  await check('owner cannot write subscription or access sessions, intents and admin RPC',async()=>{
    await assert.rejects(asOwner(user,"UPDATE subscriptions SET plan_id=(SELECT id FROM plans WHERE code='PRO') WHERE business_id=$1",[business]),/permission denied/);
    for(const table of ['owner_sessions','registration_intents','owner_auth_attempts']) await assert.rejects(asOwner(user,`SELECT * FROM ${table}`),/permission denied/);
    await assert.rejects(asOwner(user,'SELECT admin_assign_business_plan($1,$2,$3,$4)',[admin,business,'PRO','test']),/permission denied/);
  });
  await check('one owner one business constraint',async()=>{
    await assert.rejects(query("INSERT INTO businesses(owner_user_id,name,slug,status) VALUES($1,'Duplicate','duplicate-local','ACTIVE')",[user]),/businesses_owner_user_id_unique/);
  });
  await check('Free category five and product eleven rejected',async()=>{
    for(let i=0;i<3;i++)await asOwner(user,'INSERT INTO categories(business_id,name) VALUES($1,$2)',[business,`Cat ${i}`]);
    await assert.rejects(asOwner(user,"INSERT INTO categories(business_id,name) VALUES($1,'Overflow')",[business]),error=>error.message==='LIMIT_EXCEEDED'&&JSON.parse(error.detail).limit===4);
    for(let i=0;i<10;i++)await asOwner(user,'INSERT INTO menu_items(business_id,category_id,name,price) VALUES($1,$2,$3,10)',[business,category,`Item ${i}`]);
    await assert.rejects(asOwner(user,"INSERT INTO menu_items(business_id,category_id,name,price) VALUES($1,$2,'Overflow',10)",[business,category]),error=>error.message==='LIMIT_EXCEEDED'&&JSON.parse(error.detail).used===10);
  });
  await check('two independent concurrent transactions at 9/10 finish at 10',async()=>{
    await query("DELETE FROM menu_items WHERE business_id=$1 AND name='Item 9'",[business]);
    const results=await Promise.allSettled([1,2].map(i=>asOwner(user,'INSERT INTO menu_items(business_id,category_id,name,price) VALUES($1,$2,$3,10)',[business,category,`Concurrent ${i}`])));
    assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
    assert.equal(results.find(result=>result.status==='rejected').reason.message,'LIMIT_EXCEEDED');
    assert.equal(await value('SELECT count(*)::int value FROM menu_items WHERE business_id=$1',[business]),10);
  });
  const products=(await query('SELECT id FROM menu_items WHERE business_id=$1 ORDER BY created_at',[business])).rows;
  const insertVideo=(item,name)=>query("INSERT INTO product_media(business_id,menu_item_id,media_type,source,status,mux_upload_id,aspect_ratio) VALUES($1,$2,'video','mux','waiting',$3,'16:9') RETURNING id",[business,item,name]);
  await check('Free second video rejected',async()=>{
    await insertVideo(products[0].id,'local-upload-first');
    await assert.rejects(insertVideo(products[1].id,'local-upload-second'),error=>error.message==='LIMIT_EXCEEDED'&&JSON.parse(error.detail).resource==='videos');
  });
  await check('concurrent video reservations cannot occupy two Free slots',async()=>{
    await query('DELETE FROM product_media WHERE business_id=$1',[business]);
    const results=await Promise.allSettled([insertVideo(products[0].id,'local-concurrent-1'),insertVideo(products[1].id,'local-concurrent-2')]);
    assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
  });
  await check('audited admin assignment; downgrade preserves content and blocks new records',async()=>{
    await assert.rejects(query('SELECT admin_assign_business_plan($1,$2,$3,$4)',[admin,business,'PRO',null]),/Reason required/);
    assert.equal(await value('SELECT admin_assign_business_plan($1,$2,$3,$4) value',[admin,business,'BASIC','beta test']),true);
    for(let i=0;i<3;i++)await asOwner(user,'INSERT INTO menu_items(business_id,category_id,name,price) VALUES($1,$2,$3,10)',[business,category,`Extra ${i}`]);
    await query('SELECT admin_assign_business_plan($1,$2,$3,$4)',[admin,business,'FREE','beta concluded']);
    assert.equal(await value('SELECT count(*)::int value FROM menu_items WHERE business_id=$1',[business]),13);
    await asOwner(user,"UPDATE menu_items SET name='Edited after downgrade' WHERE id=$1",[products[0].id]);
    await assert.rejects(asOwner(user,"INSERT INTO menu_items(business_id,category_id,name,price) VALUES($1,$2,'Blocked',10)",[business,category]),/LIMIT_EXCEEDED/);
    assert.equal(await value("SELECT count(*)::int value FROM admin_audit_log WHERE actor_user_id=$1 AND action='PLAN_ASSIGNED'",[admin]),2);
  });
  await check('tenant isolation and composite relationship constraints',async()=>{
    assert.equal((await asOwner(user,"UPDATE businesses SET name='Compromised' WHERE id=$1",[otherBusiness])).rowCount,0);
    const otherCategory=(await query("INSERT INTO categories(business_id,name) VALUES($1,'Other') RETURNING id",[otherBusiness])).rows[0].id;
    await query('SELECT admin_assign_business_plan($1,$2,$3,$4)',[admin,business,'BASIC','relationship test']);
    await assert.rejects(asOwner(user,"INSERT INTO menu_items(business_id,category_id,name,price) VALUES($1,$2,'Cross tenant',10)",[business,otherCategory]),/menu_items_category_tenant_fk/);
    await assert.rejects(asOwner(user,"INSERT INTO categories(business_id,name) VALUES($1,'Intrusion')",[otherBusiness]),/row-level security/);
  });
  await check('subscription removal cannot leave a surviving business',async()=>{
    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      await client.query('DELETE FROM subscription_events WHERE business_id=$1',[business]);
      await client.query('DELETE FROM subscriptions WHERE business_id=$1',[business]);
      await assert.rejects(client.query('COMMIT'),/Business requires a subscription/);
    }finally{await client.query('ROLLBACK');client.release();}
  });
  await check('shared subscription trigger repair prevents missing record fields while retaining the mandatory subscription guard',async()=>{
    const uid=randomUUID(),bid=randomUUID();
    await query("INSERT INTO auth.users(id,email) VALUES($1,'trigger-repair@local.test')",[uid]);
    await query("INSERT INTO profiles(id,full_name) VALUES($1,'Trigger Repair Owner')",[uid]);
    // Reproduce the deployed CASE expression: PostgreSQL resolves fields in both
    // branches, even when businesses has no OLD.business_id column.
    await query(`CREATE OR REPLACE FUNCTION public.assert_business_subscription() RETURNS trigger
      LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
      DECLARE v_id uuid; BEGIN
        v_id:=CASE WHEN TG_TABLE_NAME='businesses' THEN NEW.id ELSE OLD.business_id END;
        IF EXISTS(SELECT 1 FROM public.businesses WHERE id=v_id)
          AND NOT EXISTS(SELECT 1 FROM public.subscriptions WHERE business_id=v_id) THEN
          RAISE EXCEPTION 'Business requires a subscription';
        END IF; RETURN NULL;
      END $$`);
    const insert="INSERT INTO businesses(id,owner_user_id,name,slug,status) VALUES($1,$2,'Trigger Repair','trigger-repair','ACTIVE')";
    await assert.rejects(query(insert,[bid,uid]),e=>e.code==='42703'&&e.message.includes('business_id'));
    assert.equal(await value('SELECT count(*)::int value FROM businesses WHERE id=$1',[bid]),0);
    const migration=await readFile(new URL('../../supabase/migrations/20261012020000_repair_business_subscription_trigger.sql',import.meta.url),'utf8');
    await query(migration);await query(migration);
    await query(insert,[bid,uid]);
    assert.equal(await value("SELECT count(*)::int value FROM subscriptions WHERE business_id=$1 AND status='active'",[bid]),1);
    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      await client.query('DELETE FROM subscription_events WHERE business_id=$1',[bid]);
      await client.query('DELETE FROM subscriptions WHERE business_id=$1',[bid]);
      await assert.rejects(client.query('COMMIT'),/Business requires a subscription/);
    }finally{await client.query('ROLLBACK');client.release();}
  });
  await check('public PRO denied; existing email cannot be rebound',async()=>{
    await assert.rejects(query('SELECT start_owner_registration($1,$2,$3,$4,$5,$6,$7)',['new@local.test','New Owner','New Business','new-local',null,'PRO',null]),/PAID_PLAN_UNAVAILABLE/);
    assert.equal(await value('SELECT start_owner_registration($1,$2,$3,$4,$5,$6,$7) value',['owner@local.test','New Owner','New Business','duplicate-email',null,'FREE',null]),null);
  });
  await check('unverified identity provisions immediately; forged intent denied; concurrent provisioning is idempotent',async()=>{
    const id=await value('SELECT start_owner_registration($1,$2,$3,$4,$5,$6,$7) value',['new@local.test','New Owner','New Business','new-local',null,'FREE',null]);
    const uid=randomUUID();await query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[uid,'new@local.test']);
    assert.equal(await value('SELECT bind_owner_registration($1,$2) value',[id,uid]),true);
    await assert.rejects(query('SELECT provision_owner_account($1,$2)',[uid,randomUUID()]),/INVALID_REGISTRATION_INTENT/);
    const outputs=await Promise.all([value('SELECT provision_owner_account($1,$2) value',[uid,id]),value('SELECT provision_owner_account($1,$2) value',[uid,id])]);
    assert.ok(outputs[0]);assert.equal(outputs[0],outputs[1]);
    assert.equal(await value('SELECT count(*)::int value FROM businesses WHERE owner_user_id=$1',[uid]),1);
    assert.equal(await value('SELECT p.code value FROM subscriptions s JOIN plans p ON p.id=s.plan_id WHERE s.business_id=$1',[outputs[0]]),'FREE');
  });
  await check('tampered paid intent fails closed during provisioning',async()=>{
    const id=await value('SELECT start_owner_registration($1,$2,$3,$4,$5,$6,$7) value',['tamper@local.test','Tamper Owner','Tamper Business','tamper-local',null,'FREE',null]);
    const uid=randomUUID();await query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[uid,'tamper@local.test']);
    await query('SELECT bind_owner_registration($1,$2)',[id,uid]);
    await query("UPDATE registration_intents SET selected_plan_id=(SELECT id FROM plans WHERE code='PRO') WHERE id=$1",[id]);
    await query('UPDATE auth.users SET email_confirmed_at=now() WHERE id=$1',[uid]);
    await assert.rejects(query('SELECT provision_owner_account($1,$2)',[uid,id]),/PAID_PLAN_UNAVAILABLE/);
  });
  await check('shared session refresh lease and atomic revocation',async()=>{
    const hash=randomBytes(32).toString('hex');
    await query("SELECT create_owner_session($1,$2,'owner','ciphertext',now()+interval '10 seconds',now()+interval '1 hour',NULL)",[hash,user]);
    const leases=await Promise.all([value('SELECT claim_owner_session_refresh($1) value',[hash]),value('SELECT claim_owner_session_refresh($1) value',[hash])]);
    assert.equal(leases.filter(Boolean).length,1);
    await query('SELECT revoke_owner_sessions($1,NULL)',[user]);
    assert.equal(await value("SELECT complete_owner_session_refresh($1,$2,'newcipher',now()+interval '1 hour') value",[hash,leases.find(Boolean)]),false);
    assert.equal(await value('SELECT encrypted_tokens value FROM owner_sessions WHERE session_hash=$1',[hash]),'');
  });
  await check('persistent login quota holds under twelve concurrent requests',async()=>{
    const hash=randomBytes(32).toString('hex');
    const attempts=await Promise.all(Array.from({length:12},()=>value("SELECT reserve_owner_auth_attempt('login',$1,10,900) value",[hash])));
    assert.equal(attempts.filter(Boolean).length,10);
  });
  await check('revocation cutoff prevents late creation with an old Auth token',async()=>{
    const hash=randomBytes(32).toString('hex');
    assert.equal(await value("SELECT create_owner_session($1,$2,'owner','ciphertext',now()+interval '1 hour',now()+interval '1 hour',NULL,$3) value",
      [hash,user,Math.floor(Date.now()/1000)-60]),false);
  });
  await check('bulk insert cannot exceed product capacity or commit a partial batch',async()=>{
    await query('SELECT admin_assign_business_plan($1,$2,$3,$4)',[admin,business,'FREE','bulk quota test']);
    await query('DELETE FROM menu_items WHERE business_id=$1 AND id NOT IN (SELECT id FROM menu_items WHERE business_id=$1 ORDER BY id LIMIT 9)',[business]);
    await assert.rejects(asOwner(user,"INSERT INTO menu_items(business_id,category_id,name,price) VALUES($1,$2,'Bulk 1',10),($1,$2,'Bulk 2',10)",[business,category]),/LIMIT_EXCEEDED/);
    assert.equal(await value('SELECT count(*)::int value FROM menu_items WHERE business_id=$1',[business]),9);
  });
  await check('invitation registration shares immediate Free provisioning and cannot reserve twice',async()=>{
    const email='invited@local.test',hash=randomBytes(32).toString('hex');
    await query('INSERT INTO customer_invitations(email,code_hash,created_by,expires_at) VALUES($1,$2,$3,now()+interval \'1 day\')',[email,hash,admin]);
    const args=[email,'Invited Owner','Invited Business','invited-local',null,'FREE',hash];
    const ids=await Promise.all([value('SELECT start_owner_registration($1,$2,$3,$4,$5,$6,$7) value',args),value('SELECT start_owner_registration($1,$2,$3,$4,$5,$6,$7) value',args)]);
    assert.equal(ids.filter(Boolean).length,1);const uid=randomUUID();
    await query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[uid,email]);
    await query('SELECT bind_owner_registration($1,$2)',[ids.find(Boolean),uid]);
    await query('UPDATE auth.users SET email_confirmed_at=now() WHERE id=$1',[uid]);
    const bid=await value('SELECT provision_owner_account($1,$2) value',[uid,ids.find(Boolean)]);assert.ok(bid);
    assert.equal(await value('SELECT status value FROM customer_invitations WHERE code_hash=$1',[hash]),'CONSUMED');
  });
  await check('bound registration provisions immediately and interrupted binding can be resumed',async()=>{
    const uid=randomUUID(),email='partial@local.test';
    const id=await value('SELECT start_owner_registration($1,$2,$3,$4,$5,$6,$7) value',[email,'Partial Owner','Partial Business','partial-local',null,'FREE',null]);
    await query('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,now())',[uid,email]);
    assert.equal(await value('SELECT bind_owner_registration($1,$2) value',[id,uid]),true);
    assert.ok(await value('SELECT provision_owner_account($1,$2) value',[uid,id]));
    const uid2=randomUUID(),email2='unbound@local.test';
    await value('SELECT start_owner_registration($1,$2,$3,$4,$5,$6,$7) value',[email2,'Unbound Owner','Unbound Business','unbound-local',null,'FREE',null]);
    await query('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,now())',[uid2,email2]);
    assert.ok(await value('SELECT resume_owner_registration($1,$2,$3,$4,$5) value',[uid2,'Unbound Owner','Unbound Business','unbound-resumed',null]));
  });
  await check('actual video upload RPC reserves one Free slot with two concurrent requests',async()=>{
    await query('DELETE FROM product_media WHERE business_id=$1',[business]);
    const current=(await query('SELECT id FROM menu_items WHERE business_id=$1 LIMIT 2',[business])).rows;
    const ip=randomBytes(32).toString('hex');
    const results=await Promise.allSettled(current.map(row=>query("SELECT * FROM reserve_video_upload($1,$2,$3,$4,1024,'video/mp4',20,3,5,900,'16:9',NULL)",[business,user,row.id,ip])));
    assert.equal(results.filter(result=>result.status==='fulfilled'&&result.value.rows[0].reserved_media_id).length,1);
    assert.equal(results.find(result=>result.status==='rejected').reason.message,'LIMIT_EXCEEDED');
  });
  await check('commercial draft is private, Free only, expires and is consumed once concurrently',async()=>{
    for(const table of ['owner_plan_intents','owner_account_audit'])await assert.rejects(asOwner(user,`SELECT * FROM ${table}`),/permission denied/);
    await assert.rejects(query("INSERT INTO owner_plan_intents(plan_code) VALUES('PRO')"),/check constraint/);
    const draft=(await query("INSERT INTO owner_plan_intents(plan_code) VALUES('FREE') RETURNING id")).rows[0].id;
    const consume=()=>query("UPDATE owner_plan_intents SET consumed_at=now(),terms_version='2026-10' WHERE id=$1 AND consumed_at IS NULL AND expires_at>now() RETURNING id",[draft]);
    assert.equal((await Promise.all([consume(),consume()])).reduce((n,r)=>n+r.rowCount,0),1);
    const expired=(await query("INSERT INTO owner_plan_intents(plan_code,expires_at) VALUES('FREE',now()-interval '1 day') RETURNING id")).rows[0].id;
    assert.equal((await query('UPDATE owner_plan_intents SET consumed_at=now() WHERE id=$1 AND expires_at>now() RETURNING id',[expired])).rowCount,0);
  });
  await check('selected Free registration stores consent atomically and rejects duplicate concurrent consumption',async()=>{
    const selection=await value("INSERT INTO owner_plan_intents(plan_code) VALUES('FREE') RETURNING id value");
    const args=[selection,'selected@local.test','Selected Owner','Selected Business','selected-local',null,null];
    const start=()=>value('SELECT start_selected_owner_registration($1,$2,$3,$4,$5,$6,$7) value',args);
    const results=await Promise.allSettled([start(),start()]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
    assert.equal(results.find(r=>r.status==='rejected').reason.message,'PLAN_INTENT_EXPIRED');
    const registration=(await query('SELECT * FROM registration_intents WHERE id=$1',[results.find(r=>r.status==='fulfilled').value])).rows[0];
    assert.equal(registration.plan_selection_intent_id,selection);
    assert.equal(registration.terms_version,'2026-10');assert.ok(registration.terms_accepted_at);
    assert.equal(await value('SELECT consumed_at=terms_accepted_at value FROM owner_plan_intents s JOIN registration_intents i ON i.plan_selection_intent_id=s.id WHERE s.id=$1',[selection]),true);
    await assert.rejects(asOwner(user,'SELECT start_selected_owner_registration($1,$2,$3,$4,$5,$6,$7)',args),/permission denied/);
  });
  await check('registration write failure rolls back selection consumption and allows retry',async()=>{
    const selection=await value("INSERT INTO owner_plan_intents(plan_code) VALUES('FREE') RETURNING id value");
    const args=[selection,'retry-selected@local.test','Retry Owner','Retry Business','INVALID SLUG',null,null];
    await assert.rejects(query('SELECT start_selected_owner_registration($1,$2,$3,$4,$5,$6,$7)',args),/check constraint/);
    assert.equal(await value('SELECT consumed_at value FROM owner_plan_intents WHERE id=$1',[selection]),null);
    assert.equal(await value('SELECT count(*)::int value FROM registration_intents WHERE email=$1',[args[1]]),0);
    args[4]='retry-selected';
    assert.ok(await value('SELECT start_selected_owner_registration($1,$2,$3,$4,$5,$6,$7) value',args));
    const expired=await value("INSERT INTO owner_plan_intents(plan_code,expires_at) VALUES('FREE',now()-interval '1 second') RETURNING id value");
    args[0]=expired;
    await assert.rejects(query('SELECT start_selected_owner_registration($1,$2,$3,$4,$5,$6,$7)',args),/PLAN_INTENT_EXPIRED/);
  });
  await check('repair releases only old interrupted public drafts and preserves identities, consent and awaiting email',async()=>{
    const ids=[];
    for(const kind of ['orphan','recent','identity','consent','bound']){
      const email=`repair-${kind}@local.test`;
      const id=await value('SELECT start_owner_registration($1,$2,$3,$4,NULL,\'FREE\',NULL) value',[email,'Repair Owner','Repair Business',`repair-${kind}`]);
      ids.push(id);
      if(['identity','bound'].includes(kind)){
        const uid=randomUUID();await query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[uid,email]);
        if(kind==='bound')await query('SELECT bind_owner_registration($1,$2)',[id,uid]);
      }
      if(kind!=='recent')await query("UPDATE registration_intents SET created_at=now()-interval '31 minutes' WHERE id=$1",[id]);
      if(kind==='consent')await query("UPDATE registration_intents SET terms_accepted_at=now(),terms_version='2026-10' WHERE id=$1",[id]);
      await query("INSERT INTO owner_plan_intents(plan_code,consumed_at) SELECT 'FREE',created_at-interval '1 second' FROM registration_intents WHERE id=$1",[id]);
    }
    await query(await readFile(new URL('../../supabase/migrations/20261012000000_repair_free_registration.sql',import.meta.url),'utf8'));
    for(const [index,expected] of ['EXPIRED','PENDING','PENDING','PENDING','READY'].entries()){
      assert.equal(await value('SELECT status value FROM registration_intents WHERE id=$1',[ids[index]]),expected);
    }
    assert.equal(await value("SELECT count(*)::int value FROM auth.users WHERE email IN ('repair-identity@local.test','repair-bound@local.test')"),2);
    assert.ok(await value('SELECT start_owner_registration($1,$2,$3,$4,NULL,\'FREE\',NULL) value',['repair-orphan@local.test','Repair Owner','Repair Business','repair-orphan-retry']));
  });
  await check('removal migration repairs duplicate unbound legacy drafts and rolls back conflicts between bound registrations',async()=>{
    const migration=await readFile(new URL('../../supabase/migrations/20261012010000_remove_owner_email_verification.sql',import.meta.url),'utf8');
    const client=await pool.connect(),uid=randomUUID();
    const insert=async(email,status,bound,consent,age)=>{
      const id=randomUUID();
      await client.query("INSERT INTO registration_intents(id,email,selected_plan_id,source,full_name,business_name,slug,status,auth_user_id,terms_accepted_at,created_at) VALUES($1,$2,(SELECT id FROM plans WHERE code='FREE'),'PUBLIC','Duplicate Owner','Duplicate Business','duplicate-repair',$3,$4,$5,now()-($6*interval '1 hour'))",[id,email,status,bound,consent?new Date():null,age]);
      return id;
    };
    const status=async(id)=>(await client.query('SELECT status FROM registration_intents WHERE id=$1',[id])).rows[0]?.status;
    try{
      // Reproduce an older/partial schema that allowed a PENDING draft alongside AWAITING_EMAIL.
      await client.query('BEGIN');
      await client.query('DROP INDEX registration_intents_email_pending_idx; DROP INDEX registration_intents_user_pending_idx');
      await client.query("ALTER TABLE registration_intents DROP CONSTRAINT registration_intents_status_check; ALTER TABLE registration_intents ADD CONSTRAINT registration_intents_status_check CHECK(status IN ('PENDING','READY','AWAITING_EMAIL','EXPIRED','COMPLETED'))");
      await client.query("INSERT INTO auth.users(id,email) VALUES($1,'duplicate-bound@local.test')",[uid]);
      const bound=await insert('duplicate-bound@local.test','AWAITING_EMAIL',uid,true,2);
      const orphan=await insert('duplicate-bound@local.test','PENDING',null,false,1);
      const consent=await insert('duplicate-consent@local.test','PENDING',null,true,2);
      const noConsent=await insert('duplicate-consent@local.test','PENDING',null,false,1);
      const older=await insert('duplicate-latest@local.test','PENDING',null,false,2);
      const latest=await insert('duplicate-latest@local.test','PENDING',null,false,1);
      await client.query('COMMIT');
      await client.query(migration);await client.query(migration);
      for(const id of [orphan,noConsent,older])assert.equal(await status(id),'EXPIRED');
      assert.equal(await status(bound),'READY');
      for(const id of [consent,latest])assert.equal(await status(id),'PENDING');
      assert.equal((await client.query('SELECT count(*)::int n FROM registration_intents WHERE id=ANY($1::uuid[])',[[bound,orphan,consent,noConsent,older,latest]])).rows[0].n,6);
      assert.equal((await client.query('SELECT count(*)::int n FROM auth.users WHERE id=$1',[uid])).rows[0].n,1);
      await assert.rejects(client.query("INSERT INTO registration_intents(email,selected_plan_id,source,full_name,business_name,slug) VALUES('duplicate-bound@local.test',(SELECT id FROM plans WHERE code='FREE'),'PUBLIC','Other Owner','Other Business','duplicate-blocked')"),e=>e.code==='23505');
      // Bound conflicts must abort the entire migration, including draft cleanup.
      await client.query('BEGIN');
      await client.query('DROP INDEX registration_intents_email_pending_idx; DROP INDEX registration_intents_user_pending_idx');
      const conflict=await insert('duplicate-bound@local.test','READY',uid,true,1);
      const rollbackDraft=await insert('duplicate-consent@local.test','PENDING',null,false,3);
      await client.query('COMMIT');
      await assert.rejects(client.query(migration),/Conflicting bound registration intents/);
      await client.query('ROLLBACK');
      assert.equal(await status(conflict),'READY');assert.equal(await status(rollbackDraft),'PENDING');
      await client.query('DELETE FROM registration_intents WHERE id=ANY($1::uuid[])',[[conflict,rollbackDraft]]);
      await client.query(migration);
    }finally{await client.query('ROLLBACK');client.release();}
  });
  await check('removal migration releases existing owner identities without changing admins, unrelated users or recovery tokens',async()=>{
    const legacyOwner=randomUUID(),legacyAdmin=randomUUID(),unrelated=randomUUID();
    await query("INSERT INTO auth.users(id,email,confirmation_token,recovery_token) VALUES($1,'legacy-owner@local.test','old-confirm','keep-recovery'),($2,'legacy-admin@local.test','admin-confirm','admin-recovery'),($3,'unrelated@local.test','other-confirm','other-recovery')",[legacyOwner,legacyAdmin,unrelated]);
    await query('INSERT INTO admin_identities(user_id) VALUES($1)',[legacyAdmin]);
    await query("INSERT INTO profiles(id,full_name) VALUES($1,'Legacy')",[legacyOwner]);
    await query("INSERT INTO businesses(owner_user_id,name,slug,status) VALUES($1,'Legacy','legacy-transition','ACTIVE')",[legacyOwner]);
    const migration=await readFile(new URL('../../supabase/migrations/20261012010000_remove_owner_email_verification.sql',import.meta.url),'utf8');
    await query(migration);await query(migration);
    const owner=(await query('SELECT email_confirmed_at,confirmation_token,recovery_token FROM auth.users WHERE id=$1',[legacyOwner])).rows[0];
    assert.ok(owner.email_confirmed_at);assert.equal(owner.confirmation_token,'');assert.equal(owner.recovery_token,'keep-recovery');
    assert.equal(await value('SELECT email_confirmed_at value FROM auth.users WHERE id=$1',[legacyAdmin]),null);
    assert.equal(await value('SELECT email_confirmed_at value FROM auth.users WHERE id=$1',[unrelated]),null);
    assert.equal(await value('SELECT confirmation_token value FROM auth.users WHERE id=$1',[legacyAdmin]),'admin-confirm');
    assert.equal(await value("SELECT count(*)::int value FROM auth.users WHERE email IN ('repair-identity@local.test','repair-bound@local.test') AND email_confirmed_at IS NOT NULL"),2);
    assert.equal(await value("SELECT create_owner_session($1,$2,'owner','ciphertext',now()+interval '1 hour',now()+interval '1 hour',NULL,NULL) value",[randomBytes(32).toString('hex'),unrelated]),true);
    assert.equal(await value("SELECT create_owner_session($1,$2,'owner','ciphertext',now()+interval '1 hour',now()+interval '1 hour',NULL,NULL) value",[randomBytes(32).toString('hex'),legacyAdmin]),false);
  });
  await check('identity creation failure releases only its own selected draft and retains bound registrations',async()=>{
    const selection=await value("INSERT INTO owner_plan_intents(plan_code) VALUES('FREE') RETURNING id value");
    const args=[selection,'failed-identity@local.test','Failed Owner','Failed Business','failed-identity',null,null];
    const id=await value('SELECT start_selected_owner_registration($1,$2,$3,$4,$5,$6,$7) value',args);
    await query('SELECT abandon_owner_registration($1)',[id]);
    assert.equal(await value('SELECT consumed_at value FROM owner_plan_intents WHERE id=$1',[selection]),null);
    const retry=await value('SELECT start_selected_owner_registration($1,$2,$3,$4,$5,$6,$7) value',args);
    const uid=randomUUID();await query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[uid,args[1]]);
    await query('SELECT bind_owner_registration($1,$2)',[retry,uid]);
    await query('SELECT abandon_owner_registration($1)',[retry]);
    assert.equal(await value('SELECT status value FROM registration_intents WHERE id=$1',[retry]),'READY');
    assert.ok(await value('SELECT consumed_at value FROM owner_plan_intents WHERE id=$1',[selection]));
  });
  await check('every plan rejects the next product, category and video at its exact limit',async()=>{
    for(const [code,limits] of Object.entries({FREE:[10,4,1],BASIC:[30,10,7],MEDIUM:[70,25,25],PRO:[150,40,40]})){
      const uid=randomUUID(),bid=randomUUID(),cid=randomUUID();
      await query('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,now())',[uid,code.toLowerCase()+'-capacity@local.test']);
      await query('INSERT INTO profiles(id,full_name) VALUES($1,$2)',[uid,code+' Owner']);
      await query("INSERT INTO businesses(id,owner_user_id,name,slug,status) VALUES($1,$2,$3,$4,'ACTIVE')",[bid,uid,code,code.toLowerCase()+'-capacity']);
      if(code!=='FREE')await query('SELECT admin_assign_business_plan($1,$2,$3,$4)',[admin,bid,code,'exact quota test']);
      await query("INSERT INTO categories(id,business_id,name) VALUES($1,$2,'First')",[cid,bid]);
      await query("INSERT INTO categories(business_id,name) SELECT $1,'Category '||n FROM generate_series(2,$2) n",[bid,limits[1]]);
      await assert.rejects(query("INSERT INTO categories(business_id,name) VALUES($1,'Overflow')",[bid]),e=>e.message==='LIMIT_EXCEEDED'&&JSON.parse(e.detail).limit===limits[1]);
      await query("INSERT INTO menu_items(business_id,category_id,name,price) SELECT $1,$2,'Product '||n,10 FROM generate_series(1,$3) n",[bid,cid,limits[0]]);
      await assert.rejects(query("INSERT INTO menu_items(business_id,category_id,name,price) VALUES($1,$2,'Overflow',10)",[bid,cid]),e=>e.message==='LIMIT_EXCEEDED'&&JSON.parse(e.detail).limit===limits[0]);
      const items=(await query('SELECT id FROM menu_items WHERE business_id=$1 ORDER BY id',[bid])).rows;
      for(let i=0;i<limits[2];i++)await query("INSERT INTO product_media(business_id,menu_item_id,media_type,source,status,mux_upload_id,aspect_ratio) VALUES($1,$2,'video','mux','waiting',$3,'16:9')",[bid,items[i].id,code+'-quota-'+i]);
      await assert.rejects(query("INSERT INTO product_media(business_id,menu_item_id,media_type,source,status,mux_upload_id,aspect_ratio) VALUES($1,$2,'video','mux','waiting',$3,'16:9')",[bid,items[limits[2]].id,code+'-overflow']),e=>e.message==='LIMIT_EXCEEDED'&&JSON.parse(e.detail).limit===limits[2]);
    }
  });
  await check('owner deletion enters existing lifecycle, unpublishes, audits and revokes sessions atomically',async()=>{
    await assert.rejects(asOwner(otherUser,'SELECT owner_schedule_account_deletion($1,$2)',[otherUser,otherBusiness]),/permission denied/);
    await assert.rejects(query('SELECT owner_schedule_account_deletion($1,$2)',[otherUser,business]),/OWNER_CONFIRMATION_REQUIRED/);
    for(let i=0;i<2;i++)await query("INSERT INTO owner_sessions(session_hash,user_id,scope,encrypted_tokens,token_expires_at,expires_at) VALUES($1,$2,'owner','encrypted',now()+interval '1 hour',now()+interval '8 hours')",[randomBytes(32).toString('hex'),otherUser]);
    await query('INSERT INTO auth.sessions(user_id) VALUES($1)',[otherUser]);
    const due=await value('SELECT owner_schedule_account_deletion($1,$2) value',[otherUser,otherBusiness]);
    assert.ok(new Date(due).getTime()>Date.now()+29*86400000);
    assert.equal(await value('SELECT lifecycle_status value FROM business_account_state WHERE business_id=$1',[otherBusiness]),'PENDING_DELETION');
    assert.equal(await value('SELECT business_is_publicly_eligible($1) value',[otherBusiness]),false);
    assert.equal(await value('SELECT count(*)::int value FROM owner_sessions WHERE user_id=$1 AND revoked_at IS NULL',[otherUser]),0);
    assert.equal(await value('SELECT count(*)::int value FROM auth.sessions WHERE user_id=$1',[otherUser]),0);
    assert.equal(await value("SELECT count(*)::int value FROM owner_account_audit WHERE user_id=$1 AND action='DELETION_SCHEDULED'",[otherUser]),1);
    assert.equal(await value('SELECT count(*)::int value FROM businesses WHERE id=$1',[otherBusiness]),1);
    await value('SELECT owner_schedule_account_deletion($1,$2) value',[otherUser,otherBusiness]);
    assert.equal(await value('SELECT count(*)::int value FROM owner_account_audit WHERE user_id=$1',[otherUser]),1);
  });
  console.log(`Database checks passed: ${checks}; local data discarded.`);
}
