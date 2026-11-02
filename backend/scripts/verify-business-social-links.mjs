import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function verifyBusinessSocialLinks(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const owner = randomUUID(), other = randomUUID(), business = randomUUID();
    for (const id of [owner, other]) {
      await client.query('INSERT INTO auth.users(id,email_confirmed_at) VALUES($1,now())', [id]);
      await client.query("INSERT INTO public.profiles(id,full_name) VALUES($1,'Social links test')", [id]);
    }
    await client.query("INSERT INTO public.businesses(id,owner_user_id,name,slug,status) VALUES($1,$2,'Social links',$1::uuid::text,'ACTIVE')", [business, owner]);
    assert.deepEqual((await client.query('SELECT social_links FROM public.businesses WHERE id=$1', [business])).rows[0].social_links, []);
    const links = [{ platform: 'instagram', url: 'https://instagram.com/pingo' }, { platform: 'other', label: 'Site', url: 'https://pingochef.com.br/' }];
    await client.query("SELECT set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: owner, iat: Math.floor(Date.now()/1000)+1 })]);
    await client.query('SET LOCAL ROLE authenticated');
    await client.query('UPDATE public.businesses SET social_links=$2 WHERE id=$1', [business, JSON.stringify(links)]);
    assert.deepEqual((await client.query('SELECT social_links FROM public.businesses WHERE id=$1', [business])).rows[0].social_links, links);
    await client.query('RESET ROLE');
    await client.query("SELECT set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: other, iat: Math.floor(Date.now()/1000)+1 })]);
    await client.query('SET LOCAL ROLE authenticated');
    assert.equal((await client.query("UPDATE public.businesses SET social_links='[]' WHERE id=$1", [business])).rowCount, 0);
    await client.query('RESET ROLE');
    for (const invalid of [null, {}, [{ platform: 'other', url: 'javascript:alert(1)' }],
      [{ platform: 'instagram', url: 'https://instagram.com.evil.com/' }],
      [{ platform: 'other', url: 'https://127.0.0.1/' }], [{ platform: 'other', url: 'https://user@pingochef.com.br/' }],
      [{ platform: 'other', url: 'https://pingochef.com.br:444/' }],
      [{ platform: 'other', url: 'https://pingochef.com.br', label: '<script>' }],
      [{ platform: 'instagram', url: 'https://instagram.com/pingo', extra: true }],
      [links[0], links[0]], Array(11).fill(links[0])]) {
      await client.query('SAVEPOINT invalid_social_link');
      await assert.rejects(client.query('UPDATE public.businesses SET social_links=$2 WHERE id=$1', [business, JSON.stringify(invalid)]), /check constraint/);
      await client.query('ROLLBACK TO SAVEPOINT invalid_social_link');
    }
    await client.query("UPDATE public.businesses SET social_links='[]' WHERE id=$1", [business]);
    console.log('OK social links: empty default, owner persistence, tenant isolation, database URL/shape/limit validation and removal');
  } finally { await client.query('ROLLBACK'); client.release(); }
}
