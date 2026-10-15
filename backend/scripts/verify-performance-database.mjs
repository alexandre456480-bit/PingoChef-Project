import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function verifyPerformanceDatabase(pool) {
  const user = randomUUID(), other = randomUUID(), business = randomUUID(), otherBusiness = randomUUID();
  const category = randomUUID(), otherCategory = randomUUID(), item = randomUUID(), second = randomUUID();
  await pool.query("INSERT INTO auth.users(id,email) VALUES($1,'perf-owner@local.test'),($2,'perf-other@local.test')", [user, other]);
  await pool.query("INSERT INTO profiles(id,full_name) VALUES($1,'A'),($2,'B')", [user, other]);
  await pool.query("INSERT INTO businesses(id,owner_user_id,name,slug,status) VALUES($1,$2,'A','perf-owner','ACTIVE'),($3,$4,'B','perf-other','ACTIVE')", [business,user,otherBusiness,other]);
  await pool.query("INSERT INTO categories(id,business_id,name) VALUES($1,$2,'A'),($3,$4,'B')", [category,business,otherCategory,otherBusiness]);
  await pool.query("INSERT INTO menu_items(id,business_id,category_id,name,price) VALUES($1,$2,$3,'One',10),($4,$2,$3,'Two',10)", [item,business,category,second]);
  const asRole = async (role, actor, sql, args) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN'); await client.query(`SET LOCAL ROLE ${role}`); // test-owned fixed role names only
      await client.query("SELECT set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: actor, iat: Math.floor(Date.now()/1000) + 1 })]);
      const result = await client.query(sql,args); await client.query('COMMIT'); return result;
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  };
  const reorder = (actor, tenant, resource, orders) => asRole('authenticated', actor, 'SELECT reorder_business_menu($1,$2,$3::jsonb)', [tenant,resource,JSON.stringify(orders)]);
  await reorder(user,business,'products',[{id:item,displayOrder:7},{id:second,displayOrder:8}]);
  assert.deepEqual((await pool.query('SELECT display_order FROM menu_items WHERE id=ANY($1) ORDER BY display_order', [[item,second]])).rows.map(r=>r.display_order),[7,8]);
  await assert.rejects(reorder(other,business,'products',[{id:item,displayOrder:99}]),/REORDER_RESOURCE_NOT_FOUND|permission denied/);
  await assert.rejects(reorder(user,business,'categories',[{id:category,displayOrder:12},{id:otherCategory,displayOrder:99}]),/REORDER_RESOURCE_NOT_FOUND/);
  assert.equal((await pool.query('SELECT display_order FROM categories WHERE id=$1',[category])).rows[0].display_order,0);
  await assert.rejects(reorder(user,business,'products',[{id:item,displayOrder:1},{id:item,displayOrder:2}]),/INVALID_MENU_ORDER/);
  await assert.rejects(reorder(user,business,'businesses',[{id:business,displayOrder:1}]),/INVALID_MENU_ORDER/);
  await assert.rejects(reorder(user,business,'products',[{id:item,displayOrder:1,business_id:otherBusiness}]),/INVALID_MENU_ORDER/);
  await assert.rejects(asRole('anon',user,'SELECT reorder_business_menu($1,$2,$3)',[business,'products','[]']),/permission denied/);
  await Promise.all([reorder(user,business,'products',[{id:item,displayOrder:1},{id:second,displayOrder:2}]),reorder(user,business,'products',[{id:second,displayOrder:2},{id:item,displayOrder:1}])]);
  console.log('OK performance: batch reorder preserves owner RLS, denies IDOR/mass assignment/duplicates, rolls back mixed tenants and serializes concurrent batches');
  const report = (role='service_role', tenant=business, args={}) => asRole(role,user,
    "SELECT analytics_report($1,current_date,current_date,p_source=>$2,p_qr=>$3) result",[tenant,args.source||null,args.qr||null]);
  await assert.rejects(report(),/ANALYTICS_FORBIDDEN/);
  for (const role of ['anon','authenticated']) await assert.rejects(report(role),/permission denied/);
  await pool.query("UPDATE subscriptions SET plan_id=(SELECT id FROM plans WHERE code='BASIC') WHERE business_id=$1",[business]);
  const basic = (await report()).rows[0].result;
  assert.equal(basic.categories,null); assert.equal(basic.qr,null);
  await assert.rejects(report('service_role',business,{source:'qr'}),/ANALYTICS_FORBIDDEN/);
  await pool.query("UPDATE subscriptions SET plan_id=(SELECT id FROM plans WHERE code='PRO') WHERE business_id=$1",[business]);
  const pro = (await report()).rows[0].result;
  assert.deepEqual(pro.summary,(await pool.query("SELECT analytics_query($1,current_date,current_date,'summary') result",[business])).rows[0].result);
  assert.deepEqual(pro.viewed,{rows:[],total:0});
  const otherQr=randomUUID();
  await pool.query("INSERT INTO analytics_qr_refs(id,business_id,label) VALUES($1,$2,'Other')",[otherQr,otherBusiness]);
  await assert.rejects(report('service_role',business,{qr:otherQr}),/INVALID_ANALYTICS_RESOURCE/);
  await pool.query("UPDATE business_account_state SET lifecycle_status='SUSPENDED' WHERE business_id=$1",[business]);
  await assert.rejects(report(),/ANALYTICS_FORBIDDEN/);
  await assert.rejects(reorder(user,business,'products',[{id:item,displayOrder:9}]),/ACCOUNT_NOT_ACTIVE|REORDER_RESOURCE_NOT_FOUND/);
  console.log('OK performance: batched report denies Free/browser roles/Basic source/foreign QR/suspension and preserves legacy aggregates');
}
