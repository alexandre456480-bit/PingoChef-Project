import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function verifyBusinessOrders(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const owner = randomUUID(), other = randomUUID(), business = randomUUID();
    for (const id of [owner, other]) {
      await client.query('INSERT INTO auth.users(id,email_confirmed_at) VALUES($1,now())', [id]);
      await client.query("INSERT INTO public.profiles(id,full_name) VALUES($1,'Orders test')", [id]);
    }
    await client.query("INSERT INTO public.businesses(id,owner_user_id,name,slug,status) VALUES($1,$2,'Orders',$1::uuid::text,'ACTIVE')", [business, owner]);
    const settings = { enabled: true, channel: 'whatsapp', url: 'https://wa.me/5511999999999', button_text: 'Pedir agora' };
    assert.equal((await client.query('SELECT order_settings FROM public.businesses WHERE id=$1', [business])).rows[0].order_settings.enabled, false);
    await client.query("SELECT set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: owner, iat: Math.floor(Date.now()/1000)+1 })]);
    await client.query('SET LOCAL ROLE authenticated');
    assert.equal((await client.query('UPDATE public.businesses SET order_settings=$2 WHERE id=$1', [business, settings])).rowCount, 1);
    assert.deepEqual((await client.query('SELECT order_settings FROM public.businesses WHERE id=$1', [business])).rows[0].order_settings, settings);
    await client.query('RESET ROLE');
    await client.query("SELECT set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: other, iat: Math.floor(Date.now()/1000)+1 })]);
    await client.query('SET LOCAL ROLE authenticated');
    assert.equal((await client.query("UPDATE public.businesses SET order_settings=jsonb_set(order_settings,'{enabled}','false') WHERE id=$1", [business])).rowCount, 0);
    await client.query('RESET ROLE');
    for (const invalid of [null, {}, { ...settings, enabled: 'true' }, { ...settings, url: '' },
      { ...settings, url: 'javascript:alert(1)' }, { ...settings, url: 'https://wa.me.evil.com/5511999999999' },
      { ...settings, url: 'https://wa.me/message/ABC' }, { ...settings, url: 'https://api.whatsapp.com/send?phone=5511999999999&phone=5511888888888' },
      { ...settings, channel: 'ifood', url: 'https://ifood.com.br.evil.com/' },
      { ...settings, channel: 'other', url: 'https://user:pass@pedido.com.br/' },
      { ...settings, channel: 'other', url: 'https://127.0.0.1/' }, { ...settings, channel: 'other', url: 'https://intranet.local/' },
      { ...settings, button_text: '<script>' }, { ...settings, button_text: '' }, { ...settings, button_text: 'a'.repeat(41) },
      { ...settings, extra: true }]) {
      await client.query('SAVEPOINT invalid_order');
      await assert.rejects(client.query('UPDATE public.businesses SET order_settings=$2 WHERE id=$1', [business, invalid]), /check constraint|not-null constraint/);
      await client.query('ROLLBACK TO SAVEPOINT invalid_order');
    }
    for (const [channel, url] of [['whatsapp', 'https://api.whatsapp.com/send?phone=5511999999999&text=Oi'],
      ['ifood', 'https://www.ifood.com.br/delivery/pingo'], ['website', 'https://pedido.com.br'], ['delivery', 'https://delivery.com.br'], ['other', 'https://pedido.com.br']]) {
      await client.query('UPDATE public.businesses SET order_settings=$2 WHERE id=$1', [business, { ...settings, channel, url }]);
    }
    await client.query('UPDATE public.businesses SET order_settings=$2 WHERE id=$1', [business, { ...settings, enabled: false }]);
    console.log('OK orders: disabled default, persistence, owner RLS, tenant isolation, URL/channel/text/shape validation and disabling');
  } finally { await client.query('ROLLBACK'); client.release(); }
}
