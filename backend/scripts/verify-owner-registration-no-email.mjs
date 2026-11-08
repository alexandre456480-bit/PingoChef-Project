import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

// Run at the forward migration boundary to exercise already-pending identities.
export async function verifyOwnerRegistrationNoEmail(pool, sql) {
  const ids = [randomUUID(), randomUUID(), randomUUID()];
  const emails = ids.map(id => `${id}@registration.local.test`);
  for (const email of emails.slice(0, 2)) {
    await pool.query("SELECT start_owner_registration($1,'Owner','Business',$2,NULL,'FREE',NULL)", [email, `pending-${email.slice(0, 12)}`]);
  }
  for (let i = 0; i < ids.length; i++) {
    await pool.query("INSERT INTO auth.users(id,email,encrypted_password,raw_app_meta_data,recovery_token) VALUES($1,$2,'untouched-password','{\"owner_email_verification_required\":true}','untouched-recovery')", [ids[i], emails[i]]);
  }
  await pool.query('INSERT INTO admin_identities(user_id) VALUES($1)', [ids[1]]);
  assert.equal((await pool.query('SELECT owner_email_verification_required($1) required', [ids[0]])).rows[0].required, true);
  await pool.query(sql);
  const rows = (await pool.query('SELECT id,email_confirmed_at,encrypted_password,recovery_token,raw_app_meta_data FROM auth.users WHERE id=ANY($1::uuid[])', [ids])).rows;
  assert.ok(rows.find(r => r.id === ids[0]).email_confirmed_at);
  for (const id of ids.slice(1)) assert.equal(rows.find(r => r.id === id).email_confirmed_at, null);
  for (const row of rows) {
    assert.equal(row.encrypted_password, 'untouched-password');
    assert.equal(row.recovery_token, 'untouched-recovery');
  }
  assert.equal((await pool.query('SELECT count(*)::int count FROM owner_email_verifications WHERE user_id=ANY($1::uuid[]) AND verified_at IS NOT NULL', [ids])).rows[0].count, 0);
  assert.equal((await pool.query('SELECT owner_email_verification_required($1) required', [ids[0]])).rows[0].required, false);
  for (const signature of ['reserve_owner_email_code(text)', 'activate_owner_email_code(uuid,uuid)', 'take_owner_email_code_attempt(text)', 'complete_owner_email_verification(uuid,uuid)']) {
    for (const role of ['anon', 'authenticated', 'service_role']) {
      assert.equal((await pool.query("SELECT has_function_privilege($1,$2,'EXECUTE') allowed", [role, signature])).rows[0].allowed, false);
    }
  }
  const intent = (await pool.query("SELECT start_owner_registration($1,'Owner','Business','no-email-policy',NULL,'FREE',NULL) id", [`${randomUUID()}@registration.local.test`])).rows[0].id;
  assert.equal((await pool.query('SELECT email_verification_required FROM registration_intents WHERE id=$1', [intent])).rows[0].email_verification_required, false);
  await pool.query('DELETE FROM registration_intents WHERE id=$1 OR email=ANY($2::text[])', [intent, emails]);
  await pool.query('DELETE FROM admin_identities WHERE user_id=$1', [ids[1]]);
  await pool.query('DELETE FROM auth.users WHERE id=ANY($1::uuid[])', [ids]);
  console.log('OK no-email migration releases pending owners only, preserves secrets and retires code RPCs without fabricating proof');
}
