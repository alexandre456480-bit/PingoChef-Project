import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function verifyTemplateMigration(pool, sql) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const businesses = [];
    const config = { enable_cart: false, enable_likes: true, home_icons: { home: '2d-star', combo: null },
      hero_banners: ['https://example.test/cover.webp'], hero_scope: 'home_only',
      category_hero_configs: { drinks: { enabled: false, banners: [] } },
      intro_card: { enabled: true, title: 'Da casa', description: 'Texto do cliente' } };
    const blocks = [{ id: 'categories', type: 'categories', enabled: true, position: 0 },
      { id: 'hero', type: 'hero', enabled: false, position: 4 }];
    for (const key of ['minimal', 'modern', 'premium', 'dark', 'showcase', 'brand-cover', 'editorial-arc', 'curve-panels']) {
      const owner = randomUUID();
      await client.query('INSERT INTO auth.users(id) VALUES($1)', [owner]);
      await client.query("INSERT INTO profiles(id,full_name) VALUES($1,'Template migration')", [owner]);
      const id = randomUUID(); businesses.push(id);
      await client.query('INSERT INTO businesses(id,owner_user_id,name,slug) VALUES($1::uuid,$2,$3,$1::uuid::text)', [id, owner, key]);
      await client.query(`INSERT INTO design_settings(business_id,template_key,palette,font_heading,font_body,home_blocks,custom_config)
        VALUES($1,$2,$3,'Oswald','Source Sans 3',$4,$5)`, [id, key, { key: 'custom', colors: { primary: '#123456' } },
        JSON.stringify([...blocks, { id: key, type: 'template_variant', enabled: false, position: 8 }]),
        { ...config, template_variant: key }]);
    }
    const signature = 'public.admin_dashboard_report(timestamptz,timestamptz,text,text,timestamptz,timestamptz)';
    const reportBefore = (await client.query('SELECT proacl,prosecdef FROM pg_proc WHERE oid=$1::regprocedure', [signature])).rows[0];
    await client.query(sql.replace(/^BEGIN;|^COMMIT;/gm, ''));
    // Reapplication must also be safe after template_id has been removed.
    await client.query(sql.replace(/^BEGIN;|^COMMIT;/gm, ''));
    const rows = (await client.query('SELECT template_key,palette,font_heading,font_body,home_blocks,custom_config FROM design_settings WHERE business_id=ANY($1::uuid[])', [businesses])).rows;
    assert.equal(rows.length, 8);
    for (const row of rows) {
      assert.equal(row.template_key, 'default');
      assert.deepEqual(row.palette, { key: 'custom', colors: { primary: '#123456' } });
      assert.equal(row.font_heading, 'Oswald'); assert.equal(row.font_body, 'Source Sans 3');
      assert.deepEqual(row.home_blocks, blocks); assert.deepEqual(row.custom_config, config);
    }
    await client.query('SAVEPOINT invalid_key');
    await assert.rejects(client.query("UPDATE design_settings SET template_key='modern' WHERE business_id=$1", [businesses[0]]), /check constraint/);
    await client.query('ROLLBACK TO SAVEPOINT invalid_key');
    assert.equal((await client.query("SELECT count(*)::int n FROM information_schema.columns WHERE table_schema='public' AND table_name='design_settings' AND column_name='template_id'")).rows[0].n, 0);
    const reportAfter = (await client.query('SELECT proacl,prosecdef FROM pg_proc WHERE oid=$1::regprocedure', [signature])).rows[0];
    assert.deepEqual(reportAfter, reportBefore);
    const report = (await client.query('SELECT pg_get_functiondef($1::regprocedure) body', [signature])).rows[0].body;
    assert.match(report, /GROUP BY template_key/); assert.doesNotMatch(report, /template_id/);
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
  await pool.query(sql);
  console.log('OK template migration: all 8 legacy keys, personalization preserved, repeatability, constraint and report privileges');
}

export async function verifyAdditionalTemplate(pool, sql, templateKey) {
  await pool.query(sql);
  await pool.query(sql);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const owner = randomUUID(), business = randomUUID();
    await client.query('INSERT INTO auth.users(id) VALUES($1)', [owner]);
    await client.query("INSERT INTO profiles(id,full_name) VALUES($1,'Centered template')", [owner]);
    await client.query("INSERT INTO businesses(id,owner_user_id,name,slug) VALUES($1,$2,'Centered template',$3)", [business, owner, business]);
    const previousKey = templateKey === 'pixel' ? 'signature-cover' : templateKey === 'signature-cover' ? 'brand-hero' : templateKey === 'brand-hero' ? 'arched-cover' : templateKey === 'arched-cover' ? 'centered-cover' : 'default';
    await client.query('INSERT INTO design_settings(business_id,custom_config,template_key) VALUES($1,$2,$3)', [business, { enable_cart: false, home_icons: { home: null } }, previousKey]);
    const before = (await client.query('SELECT template_key,custom_config FROM design_settings WHERE business_id=$1', [business])).rows[0];
    assert.equal(before.template_key, previousKey);
    await client.query(sql.replace(/^BEGIN;|^COMMIT;/gm, ''));
    assert.deepEqual((await client.query('SELECT template_key,custom_config FROM design_settings WHERE business_id=$1', [business])).rows[0], before);
    await client.query("UPDATE design_settings SET template_key=$2 WHERE business_id=$1", [business, templateKey]);
    const saved = (await client.query('SELECT template_key,custom_config FROM design_settings WHERE business_id=$1', [business])).rows[0];
    assert.equal(saved.template_key, templateKey); assert.deepEqual(saved.custom_config, before.custom_config);
    await client.query('SAVEPOINT unknown_template');
    await assert.rejects(client.query("UPDATE design_settings SET template_key='unknown' WHERE business_id=$1", [business]), /check constraint/);
    await client.query('ROLLBACK TO SAVEPOINT unknown_template');
  } finally { await client.query('ROLLBACK'); client.release(); }
  console.log(`OK ${templateKey}: opt-in, persistence, repeatability, default and personalization unchanged, unknown keys rejected`);
}
