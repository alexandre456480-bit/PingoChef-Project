import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function verifyPublicMenuReads(pool) {
  const client = await pool.connect();
  const [owner, other, business, otherBusiness, visible, hidden, available, unavailable, hiddenItem, otherItem] = Array.from({length:10}, () => randomUUID());
  try {
    await client.query('BEGIN');
    await client.query('INSERT INTO auth.users(id,email) VALUES($1,$2),($3,$4)', [owner,`${owner}@local.test`,other,`${other}@local.test`]);
    await client.query("INSERT INTO profiles(id,full_name) VALUES($1,'Visibility owner'),($2,'Other owner')",[owner,other]);
    await client.query("INSERT INTO businesses(id,owner_user_id,name,slug,status) VALUES($1::uuid,$2,'Public visibility',$1::uuid::text,'ACTIVE'),($3::uuid,$4,'Private visibility',$3::uuid::text,'ACTIVE')",[business,owner,otherBusiness,other]);
    await client.query('UPDATE business_account_state SET is_published=true WHERE business_id=$1',[business]);
    await client.query("INSERT INTO categories(id,business_id,name,is_active) VALUES($1,$2,'Visible',true),($3,$2,'Hidden',false)",[visible,business,hidden]);
    await client.query("INSERT INTO menu_items(id,business_id,category_id,name,price,is_available) VALUES($1,$2,$3,'Available',10,true),($4,$2,$3,'Unavailable',10,false),($5,$2,$6,'Hidden category',10,true)",[available,business,visible,unavailable,hiddenItem,hidden]);
    const category = (await client.query("INSERT INTO categories(business_id,name) VALUES($1,'Other') RETURNING id",[otherBusiness])).rows[0].id;
    await client.query("INSERT INTO menu_items(id,business_id,category_id,name,price) VALUES($1,$2,$3,'Unpublished company',10)",[otherItem,otherBusiness,category]);

    for (const [role, user, expected] of [
      ['anon',null,[available]],
      ['authenticated',other,[available,otherItem]],
      ['authenticated',owner,[available,unavailable,hiddenItem]],
    ]) {
      await client.query(`SET LOCAL ROLE ${role}`);
      await client.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify(user ? {sub:user,iat:Math.floor(Date.now()/1000)+1} : {})]);
      const rows = await client.query('SELECT id FROM menu_items WHERE business_id=ANY($1::uuid[])',[ [business,otherBusiness] ]);
      assert.deepEqual(rows.rows.map(r=>r.id).sort(),expected.sort(),`${role}: public visibility and owner isolation`);
      await client.query('RESET ROLE');
    }
    await client.query('SET LOCAL ROLE authenticated');
    await client.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:owner,iat:Math.floor(Date.now()/1000)+1})]);
    assert.equal((await client.query("UPDATE menu_items SET name='Owner still edits hidden items' WHERE id=$1",[hiddenItem])).rowCount,1);
    assert.equal((await client.query("UPDATE menu_items SET name='Forbidden' WHERE id=$1",[otherItem])).rowCount,0);
    const canUnpublish = "SELECT has_function_privilege(current_user,'public.unpublish_business_menu(uuid,uuid)','EXECUTE') AS allowed";
    const unpublish = 'SELECT public.unpublish_business_menu($1,$2) AS ok';
    const eligibility = 'SELECT public.business_is_publicly_eligible($1) AS visible';
    assert.equal((await client.query(canUnpublish)).rows[0].allowed, false);
    await client.query('SET LOCAL ROLE service_role');
    assert.equal((await client.query(unpublish,[business,other])).rows[0].ok, false);
    assert.equal((await client.query(eligibility,[business])).rows[0].visible, true);
    for (let attempt = 0; attempt < 2; attempt++)
      assert.equal((await client.query(unpublish,[business,owner])).rows[0].ok, true);
    assert.equal((await client.query(eligibility,[business])).rows[0].visible, false);
    await client.query('SET LOCAL ROLE anon');
    assert.equal((await client.query(canUnpublish)).rows[0].allowed, false);
    assert.equal((await client.query('SELECT id FROM menu_items WHERE id=$1',[available])).rowCount, 0);
    await client.query('SET LOCAL ROLE service_role');
    assert.equal((await client.query('SELECT public.publish_business_menu($1,$2) AS ok',[business,owner])).rows[0].ok, true);
    assert.equal((await client.query(eligibility,[business])).rows[0].visible, true);
    console.log('OK public catalogue RLS: unavailable/hidden/unpublished denied, owner read/write and tenant isolation preserved');
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
}
