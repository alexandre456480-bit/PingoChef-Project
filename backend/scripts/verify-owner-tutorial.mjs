import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function verifyOwnerTutorial(pool) {
  const owner = randomUUID(), other = randomUUID();
  await pool.query('INSERT INTO auth.users(id) VALUES($1),($2)', [owner, other]);
  await pool.query("INSERT INTO profiles(id,full_name) VALUES($1,'Tutorial owner'),($2,'Other tutorial owner')", [owner, other]);
  const get = async id => (await pool.query('SELECT tutorial_status,tutorial_step,tutorial_version,tutorial_started_at,tutorial_finished_at FROM profiles WHERE id=$1', [id])).rows[0];
  assert.deepEqual(await get(owner), { tutorial_status: 'NOT_STARTED', tutorial_step: 'welcome', tutorial_version: 1,
    tutorial_started_at: null, tutorial_finished_at: null });
  await pool.query("UPDATE profiles SET tutorial_status='IN_PROGRESS',tutorial_step='products',tutorial_started_at=now() WHERE id=$1", [owner]);
  // Independent reads model a refresh/new browser, with no browser storage involved.
  assert.equal((await get(owner)).tutorial_step, 'products');
  assert.equal((await get(other)).tutorial_status, 'NOT_STARTED');
  await assert.rejects(pool.query("UPDATE profiles SET tutorial_status='PUBLISHED' WHERE id=$1", [owner]), /check constraint/);
  const client = await pool.connect();
  try {
    await client.query('BEGIN'); await client.query('SET LOCAL ROLE authenticated');
    await client.query("SELECT set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: owner })]);
    const response = await client.query('SELECT id FROM profiles WHERE id=$1', [other]);
    assert.equal(response.rowCount, 0);
    const write = await client.query("UPDATE profiles SET tutorial_status='SKIPPED' WHERE id=$1", [other]);
    assert.equal(write.rowCount, 0);
    await client.query('ROLLBACK');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
  console.log('OK tutorial profile defaults, persistence, validation and cross-owner RLS isolation');
}
