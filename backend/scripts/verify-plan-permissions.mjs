import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export async function verifyPlanPermissions(pool) {
  const c = await pool.connect();
  const owner = randomUUID(), admin = randomUUID(), business = randomUUID();
  try {
    await c.query('BEGIN');
    await c.query('INSERT INTO auth.users(id,email_confirmed_at) VALUES($1,now()),($2,now())', [owner, admin]);
    await c.query("INSERT INTO profiles(id,full_name) VALUES($1,'Plans test')", [owner]);
    await c.query('INSERT INTO admin_identities(user_id) VALUES($1)', [admin]);
    await c.query("INSERT INTO businesses(id,owner_user_id,name,slug,status) VALUES($1,$2,'Plans',$1::uuid::text,'ACTIVE')", [business, owner]);
    const category = (await c.query("INSERT INTO categories(business_id,name) VALUES($1,'Test') RETURNING id", [business])).rows[0].id;
    const item = (await c.query("INSERT INTO menu_items(business_id,category_id,name,price) VALUES($1,$2,'Test',10) RETURNING id", [business, category])).rows[0].id;
    await c.query("INSERT INTO design_settings(business_id,template_key) VALUES($1,'royal-palace')", [business]);
    const denied = async (sql, args, pattern) => {
      await c.query('SAVEPOINT denied_plan');
      await assert.rejects(c.query(sql, args), pattern);
      await c.query('ROLLBACK TO SAVEPOINT denied_plan');
    };
    const publish = 'SELECT publish_business_menu($1,$2) value';
    await denied(publish, [business, owner], /THEMATIC_TEMPLATE_REQUIRES_PLAN/);
    assert.equal((await c.query('SELECT template_key FROM design_settings WHERE business_id=$1', [business])).rows[0].template_key, 'royal-palace');
    await c.query("UPDATE design_settings SET template_key='liquid-glass' WHERE business_id=$1", [business]);
    assert.equal((await c.query(publish, [business, owner])).rows[0].value, true);
    const catalog = await readFile(new URL('../../frontend/src/app/constants/menu-templates.ts', import.meta.url), 'utf8');
    for (const block of catalog.split('}, {')) {
      const key = /key:\s*'([^']+)'/.exec(block)?.[1];
      if (!key) continue;
      assert.equal((await c.query('SELECT menu_template_is_thematic($1) value', [key])).rows[0].value,
        /category:\s*'thematic'/.test(block), `Template category mismatch: ${key}`);
    }
    for (const [plan, videos] of [['FREE', 0], ['BASIC', 5], ['MEDIUM', 15], ['PRO', 30]]) {
      await c.query('SELECT admin_assign_business_plan($1,$2,$3,$4)', [admin, business, plan, 'Plan permissions verification']);
      const e = (await c.query('SELECT business_entitlement_snapshot($1) value', [business])).rows[0].value.entitlements;
      assert.equal(e.MAX_VIDEOS, videos);
      assert.equal(e.VIDEO_UPLOAD, plan !== 'FREE');
      assert.equal(e.THEMATIC_TEMPLATES, plan !== 'FREE');
      await c.query("UPDATE design_settings SET template_key='royal-palace' WHERE business_id=$1", [business]);
      if (plan === 'FREE') await denied(publish, [business, owner], /THEMATIC_TEMPLATE_REQUIRES_PLAN/);
      else assert.equal((await c.query(publish, [business, owner])).rows[0].value, true);
    }
    await c.query("INSERT INTO product_media(business_id,menu_item_id,media_type,source,status,mux_upload_id,aspect_ratio) VALUES($1,$2,'video','mux','waiting','plans-downgrade','16:9')", [business, item]);
    await c.query("SELECT admin_assign_business_plan($1,$2,'FREE','Downgrade verification')", [admin, business]);
    assert.equal((await c.query('SELECT count(*)::int n FROM product_media WHERE business_id=$1', [business])).rows[0].n, 1);
    await denied(publish, [business, owner], /THEMATIC_TEMPLATE_REQUIRES_PLAN/);
    assert.equal((await c.query(publish, [business, admin])).rows[0].value, false);
    for (const role of ['anon', 'authenticated']) {
      assert.equal((await c.query("SELECT has_function_privilege($1,'public.publish_business_menu(uuid,uuid)','EXECUTE') value", [role])).rows[0].value, false);
    }
    console.log('OK plan permissions: exact videos, preview, publication, ownership, downgrade and private RPC');
  } finally { await c.query('ROLLBACK'); c.release(); }
}
