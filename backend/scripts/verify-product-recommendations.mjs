import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function verifyProductRecommendations(pool) {
  const owner = randomUUID(), other = randomUUID(), business = randomUUID(), foreign = randomUUID();
  const cat = randomUUID(), foreignCat = randomUUID(), trigger = randomUUID(), targets = Array.from({ length: 5 }, () => randomUUID()), outsider = randomUUID();
  const c = await pool.connect();
  try {
    for (const id of [owner, other]) {
      await c.query('INSERT INTO auth.users(id,email_confirmed_at) VALUES($1,now())', [id]);
      await c.query("INSERT INTO public.profiles(id,full_name) VALUES($1,'Recommendation test')", [id]);
    }
    for (const [id, user] of [[business, owner], [foreign, other]])
      await c.query("INSERT INTO public.businesses(id,owner_user_id,name,slug,status) VALUES($1,$2,'Recommendations',$1::uuid::text,'ACTIVE')", [id, user]);
    for (const [id, biz] of [[cat, business], [foreignCat, foreign]]) await c.query("INSERT INTO public.categories(id,business_id,name) VALUES($1,$2,'Category')", [id, biz]);
    for (const id of [trigger, ...targets]) await c.query("INSERT INTO public.menu_items(id,business_id,category_id,name,price) VALUES($1,$2,$3,'Product',20)", [id, business, cat]);
    await c.query("INSERT INTO public.menu_items(id,business_id,category_id,name,price) VALUES($1,$2,$3,'Foreign product',10)", [outsider, foreign, foreignCat]);
    const save = (ids, actor = owner) => c.query('SELECT public.replace_product_recommendations($1,$2,$3,$4)', [business, actor, trigger, ids]);
    await save(targets.slice(0, 3));
    const list = async () => (await c.query('SELECT public.product_recommendation_list($1) data', [business])).rows[0].data;
    assert.deepEqual((await list())[0].recommendedProductIds, targets.slice(0, 3));
    for (const ids of [[trigger], [targets[0], targets[0]], targets.slice(0, 4), [outsider], [null]]) {
      await assert.rejects(save(ids), /INVALID_RECOMMENDATIONS|INVALID_RESOURCE_RELATIONSHIP/);
      assert.deepEqual((await list())[0].recommendedProductIds, targets.slice(0, 3));
    }
    await assert.rejects(save([], other), /ACCOUNT_NOT_ACTIVE/);
    await assert.rejects(c.query('INSERT INTO public.product_recommendations(business_id,trigger_product_id,recommended_product_id,position) VALUES($1,$2,$3,1)', [business, targets[0], outsider]), /foreign key constraint/);
    await assert.rejects(c.query('INSERT INTO public.product_recommendations(business_id,trigger_product_id,recommended_product_id,position) VALUES($1,$2,$2,1)', [business, trigger]), /check constraint/);
    await assert.rejects(c.query('INSERT INTO public.product_recommendations(business_id,trigger_product_id,recommended_product_id,position) VALUES($1,$2,$3,4)', [business, trigger, targets[4]]), /check constraint/);
    await c.query('BEGIN');
    const denied = async (sql, args) => {
      await c.query('SAVEPOINT denied_recommendation'); await assert.rejects(c.query(sql, args), /permission denied/);
      await c.query('ROLLBACK TO SAVEPOINT denied_recommendation');
    };
    await c.query("SELECT set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: owner, iat: Math.floor(Date.now()/1000)+1 })]);
    await c.query('SET LOCAL ROLE authenticated');
    assert.equal((await c.query('SELECT count(*) FROM public.product_recommendations')).rows[0].count, '3');
    await denied('SELECT public.replace_product_recommendations($1,$2,$3,$4)', [business, owner, trigger, []]);
    await denied('DELETE FROM public.product_recommendations');
    await c.query('RESET ROLE');
    await c.query("SELECT set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: other, iat: Math.floor(Date.now()/1000)+1 })]);
    await c.query('SET LOCAL ROLE authenticated');
    assert.equal((await c.query('SELECT count(*) FROM public.product_recommendations')).rows[0].count, '0');
    await c.query('SET LOCAL ROLE anon'); await denied('SELECT * FROM public.product_recommendations');
    await c.query('ROLLBACK');
    const alternatives = [targets.slice(0, 3), targets.slice(2, 5)];
    await Promise.all(alternatives.map(ids => pool.query('SELECT public.replace_product_recommendations($1,$2,$3,$4)', [business, owner, trigger, ids])));
    const final = (await list())[0].recommendedProductIds;
    assert.equal(final.length, 3); assert.ok(alternatives.some(ids => JSON.stringify(ids) === JSON.stringify(final)));
    // Transfer wrappers preserve relationships atomically, including idempotent retries.
    const exported = (await c.query("SELECT public.menu_transfer_start($1,$2,'export',1) data", [business, owner])).rows[0].data;
    const archive = (await c.query("SELECT string_agg(x.part,'' ORDER BY x.ord)::jsonb data FROM public.menu_transfers t,jsonb_array_elements_text(t.parts) WITH ORDINALITY x(part,ord) WHERE t.id=$1", [exported.id])).rows[0].data;
    assert.deepEqual(archive.productRecommendations[0].recommendedProductIds, final);
    const idMap = new Map(archive.items.map(item => [item.id, randomUUID()])), importedCat = randomUUID();
    const imported = { ...archive, categories: archive.categories.map(row => ({ ...row, id: importedCat })),
      items: archive.items.map(row => ({ ...row, id: idMap.get(row.id), categoryId: importedCat })),
      productRecommendations: archive.productRecommendations.map(row => ({ triggerProductId: idMap.get(row.triggerProductId), recommendedProductIds: row.recommendedProductIds.map(id => idMap.get(id)) })) };
    const transfer = (await c.query("SELECT public.menu_transfer_start($1,$2,'import',1) data", [foreign, other])).rows[0].data;
    await c.query('SELECT public.menu_transfer_chunk($1,$2,$3,0,$4)', [foreign, other, transfer.id, '{}']);
    for (let attempt = 0; attempt < 2; attempt++) {
      await c.query('SELECT public.menu_transfer_apply($1,$2,$3,$4,true)', [foreign, other, transfer.id, imported]);
      assert.deepEqual((await c.query('SELECT public.product_recommendation_list($1) data', [foreign])).rows[0].data, imported.productRecommendations);
    }
    assert.deepEqual((await list())[0].recommendedProductIds, final);
    await c.query('DELETE FROM public.menu_items WHERE id=$1', [final[0]]);
    assert.equal((await list())[0].recommendedProductIds.length, 2);
    await c.query('DELETE FROM public.menu_items WHERE id=$1', [trigger]); assert.deepEqual(await list(), []);
    console.log('OK recommendations: tenant FKs, capacity checks, atomic/concurrent replacement, owner RLS, private RPCs, export/import retries and cascading deletes');
  } finally {
    try {
      await c.query('ROLLBACK');
      await c.query('BEGIN');
      await c.query('DELETE FROM public.subscription_events WHERE business_id=ANY($1::uuid[])', [[business, foreign]]);
      await c.query('DELETE FROM public.subscriptions WHERE business_id=ANY($1::uuid[])', [[business, foreign]]);
      await c.query('DELETE FROM public.businesses WHERE id=ANY($1::uuid[])', [[business, foreign]]);
      await c.query('DELETE FROM public.profiles WHERE id=ANY($1::uuid[])', [[owner, other]]);
      await c.query('DELETE FROM auth.users WHERE id=ANY($1::uuid[])', [[owner, other]]);
      await c.query('COMMIT');
    } catch (error) { await c.query('ROLLBACK'); throw error; }
    finally { c.release(); }
  }
}
