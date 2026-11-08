import assert from 'node:assert/strict';

export async function verifyVideoContractRepair(pool, sql) {
  await pool.query("UPDATE video_security_state SET state='HARD_BLOCK',manual_until=now()+interval '1 hour' WHERE scope='global'");
  await pool.query(sql);
  assert.equal((await pool.query("SELECT state FROM video_security_state WHERE scope='global'")).rows[0].state, 'HARD_BLOCK');
  // Reproduce the deployed database: original video subsystem exists, hardening is absent.
  await pool.query(`
    DROP TABLE video_security_state,video_usage_daily,video_provider_usage_daily,video_abuse_events,video_maintenance_state CASCADE;
    ALTER TABLE product_media DROP COLUMN upload_idempotency_hash;
    DROP FUNCTION consume_video_security_budget(text,uuid,uuid,text,text,boolean,uuid,text,jsonb);
    DROP FUNCTION reserve_video_upload_secure(jsonb);
  `);
  await pool.query(sql);
  assert.equal((await pool.query("SELECT to_regprocedure('public.consume_video_security_budget(text,uuid,uuid,text,text,boolean,uuid,text,jsonb)') IS NOT NULL ready")).rows[0].ready, true);
  // A partial repair must also be safe and must not reset an operator's circuit block.
  await pool.query("UPDATE video_security_state SET state='SOFT_ALERT' WHERE scope='global'");
  await pool.query('DROP FUNCTION consume_video_security_budget(text,uuid,uuid,text,text,boolean,uuid,text,jsonb)');
  await pool.query(sql);
  assert.equal((await pool.query("SELECT state FROM video_security_state WHERE scope='global'")).rows[0].state, 'SOFT_ALERT');
  await pool.query("UPDATE video_security_state SET state='NORMAL',manual_until=NULL WHERE scope='global'");
  for (const role of ['anon','authenticated']) {
    assert.equal((await pool.query("SELECT has_function_privilege($1,'public.consume_video_security_budget(text,uuid,uuid,text,text,boolean,uuid,text,jsonb)','EXECUTE') allowed", [role])).rows[0].allowed, false);
  }
  console.log('OK video contract repair: complete/partial missing schema restored, repeatable, operator blocks preserved and browser RPC denied');
}
