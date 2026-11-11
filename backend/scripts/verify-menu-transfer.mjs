import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function verifyMenuTransfer(pool) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const owner = randomUUID(), other = randomUUID(), source = randomUUID(), target = randomUUID(), category = randomUUID(), item = randomUUID();
    for (const id of [owner, other]) {
      await c.query('INSERT INTO auth.users(id,email_confirmed_at) VALUES($1,now())', [id]);
      await c.query("INSERT INTO public.profiles(id,full_name) VALUES($1,'Transfer test')", [id]);
    }
    for (const [business, user] of [[source, owner], [target, other]])
      await c.query("INSERT INTO public.businesses(id,owner_user_id,name,slug,status) VALUES($1,$2,'Source menu',$1::uuid::text,'ACTIVE')", [business, user]);
    await c.query("UPDATE public.businesses SET logo_url=$2 WHERE id=$1", [source, 'data:image/png;base64,' + 'A'.repeat(600000)]);
    await c.query("UPDATE public.businesses SET welcome_bg_accent_color='#FFB800' WHERE id=$1", [source]);
    await c.query("INSERT INTO public.categories(id,business_id,name) VALUES($1,$2,'Category')", [category, source]);
    await c.query('INSERT INTO public.design_settings(business_id,custom_config) VALUES($1,$2)', [source,
      { hero_banners: ['/assets/banner.webp'], category_hero_configs: { [category]: { enabled: true, banners: ['/assets/category.webp'] } } }]);
    await c.query("INSERT INTO public.menu_items(id,business_id,category_id,name,price) VALUES($1,$2,$3,'Product',10)", [item, source, category]);
    const rpc = async (sql, values) => (await c.query(sql, values)).rows[0].data;
    const start = async (business, user, kind, parts = 1) => rpc('SELECT public.menu_transfer_start($1,$2,$3,$4) data', [business, user, kind, parts]);
    const chunk = async (business, user, transfer, index, content = null) => rpc('SELECT public.menu_transfer_chunk($1,$2,$3,$4,$5) data', [business, user, transfer, index, content]);
    const rejected = async (fn, pattern) => {
      await c.query('SAVEPOINT invalid_transfer');
      await assert.rejects(fn(), pattern);
      await c.query('ROLLBACK TO SAVEPOINT invalid_transfer');
    };
    const exported = await start(source, owner, 'export');
    assert.equal(exported.parts, 2);
    assert.equal(exported.summary.items, 1);
    const text = (await Promise.all(Array.from({ length: exported.parts }, (_, i) => chunk(source, owner, exported.id, i)))).join('');
    const doc = JSON.parse(text);
    assert.equal(doc.business.welcome_bg_accent_color, '#FFB800');
    assert.equal(doc.business.logo_url.length, 600022);
    for (const key of ['id', 'owner_user_id', 'slug', 'status']) assert.equal(key in doc.business, false);
    assert.equal('likesCount' in doc.items[0], false);
    await rejected(() => chunk(target, other, exported.id, 0), /TRANSFER_NOT_FOUND/);
    await rejected(() => start(source, other, 'export'), /ACCOUNT_NOT_ACTIVE/);
    await c.query('SET LOCAL ROLE authenticated');
    await rejected(() => start(source, owner, 'export'), /permission denied/);
    await rejected(() => c.query('SELECT * FROM public.menu_transfers'), /permission denied/);
    await c.query('RESET ROLE');

    const staged = await start(target, other, 'import');
    await chunk(target, other, staged.id, 0, '{}');
    await chunk(target, other, staged.id, 0, '{}'); // retry is idempotent
    await rejected(() => chunk(target, other, staged.id, 0, '{"changed":true}'), /INVALID_TRANSFER/);
    const cat = randomUUID(); doc.categories[0].id = cat; doc.items[0].id = randomUUID(); doc.items[0].categoryId = cat;
    doc.design.custom_config.category_hero_configs = { [cat]: { enabled: true, banners: ['/assets/category.webp'] } };
    const apply = async (payload, catalog = true, id = staged.id) => rpc('SELECT public.menu_transfer_apply($1,$2,$3,$4,$5) data', [target, other, id, payload, catalog]);
    const excessive = structuredClone(doc);
    excessive.items = Array.from({ length: 11 }, () => ({ ...doc.items[0], id: randomUUID() }));
    await rejected(() => apply(excessive), /IMPORT_PLAN_LIMIT/);
    assert.equal((await c.query('SELECT count(*) FROM public.menu_items WHERE business_id=$1', [target])).rows[0].count, '0');
    assert.equal((await apply(doc)).imported, true);
    assert.equal((await c.query('SELECT welcome_bg_accent_color FROM public.businesses WHERE id=$1',[target])).rows[0].welcome_bg_accent_color,'#FFB800');
    assert.equal((await apply(doc)).imported, true); // no duplicate inserts
    assert.equal((await c.query('SELECT count(*) FROM public.menu_items WHERE business_id=$1', [target])).rows[0].count, '1');
    const state = (await c.query('SELECT owner_user_id,slug FROM public.businesses WHERE id=$1', [target])).rows[0];
    assert.equal(state.owner_user_id, other); assert.equal(state.slug, target);
    assert.deepEqual((await c.query('SELECT custom_config FROM public.design_settings WHERE business_id=$1', [target])).rows[0].custom_config, doc.design.custom_config);
    assert.equal((await c.query('SELECT count(*) FROM public.menu_items WHERE business_id=$1', [source])).rows[0].count, '1');

    const second = await start(target, other, 'import'); await chunk(target, other, second.id, 0, '{}');
    const broken = structuredClone(doc); broken.business.name = 'Should roll back';
    broken.categories[0].id = randomUUID(); broken.items[0].categoryId = broken.categories[0].id; broken.items[0].id = randomUUID();
    broken.items[0].price = -1;
    await rejected(() => apply(broken, true, second.id), /check constraint/);
    assert.equal((await c.query('SELECT id FROM public.menu_items WHERE business_id=$1', [target])).rows[0].id, doc.items[0].id);

    await c.query("INSERT INTO public.product_media(business_id,menu_item_id,media_type,source,provider,storage_object_path,status) VALUES($1,$2,'image','storage','supabase','owned/image.png','ready')", [target, doc.items[0].id]);
    await rejected(() => apply(doc, true, second.id), /MENU_HAS_MEDIA/);
    doc.business.name = 'Appearance only';
    doc.design.custom_config.category_hero_configs = {};
    assert.equal((await apply(doc, false, second.id)).catalog, false);
    assert.equal((await c.query('SELECT id FROM public.menu_items WHERE business_id=$1', [target])).rows[0].id, doc.items[0].id);
    assert.deepEqual((await c.query('SELECT custom_config FROM public.design_settings WHERE business_id=$1', [target])).rows[0].custom_config.category_hero_configs,
      { [cat]: { enabled: true, banners: ['/assets/category.webp'] } });

    const legacy = structuredClone(doc); delete legacy.business.welcome_bg_accent_color;
    const legacyTransfer = await start(target, other, 'import'); await chunk(target, other, legacyTransfer.id, 0, '{}');
    await apply(legacy, false, legacyTransfer.id);
    assert.equal((await c.query('SELECT welcome_bg_accent_color FROM public.businesses WHERE id=$1', [target])).rows[0].welcome_bg_accent_color, '#FFB800');

    await c.query("UPDATE public.menu_transfers SET expires_at=now()-interval '1 second' WHERE id=$1", [exported.id]);
    await rejected(() => chunk(source, owner, exported.id, 0), /TRANSFER_NOT_FOUND/);
    await c.query('SELECT public.maintain_shared_security_state()');
    assert.equal((await c.query('SELECT count(*) FROM public.menu_transfers WHERE id=$1', [exported.id])).rows[0].count, '0');
    console.log('OK menu transfer: chunking, retries, atomic rollback, tenant isolation, private buffers, capacity, media protection, expiry and cleanup');
  } finally { await c.query('ROLLBACK'); c.release(); }
}
