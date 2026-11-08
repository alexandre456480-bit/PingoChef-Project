// Read-only readiness probe. No upload, playback token, quota consumption or secret output.
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
dotenv.config({ quiet: true });
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing server-side Supabase configuration. Run from backend with its environment.');
  process.exit(1);
}
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false,autoRefreshToken:false}});
let failed = false;
for (const table of ['video_security_state','video_usage_daily','video_provider_usage_daily','video_abuse_events','video_maintenance_state']) {
  const {error} = await db.from(table).select('*').limit(0);
  console.log(`${table}: ${error ? 'UNAVAILABLE' : 'OK'}`);
  failed ||= !!error;
}
const column = await db.from('product_media').select('upload_idempotency_hash').limit(0);
console.log(`video idempotency column: ${column.error ? 'UNAVAILABLE' : 'OK'}`);
failed ||= !!column.error;
// Invalid input is rejected before any lock, counter update or metric write.
const {error} = await db.rpc('consume_video_security_budget', {p_endpoint:'readiness',p_business_id:null,p_media_id:null,
  p_session_hash:null,p_ip_hash:null,p_preview:false,p_owner_id:null,p_playback_id:null,p_policy:{}});
const ready = error?.code === 'P0001' && error.message === 'INVALID_VIDEO_SECURITY_INPUT';
console.log(`video security RPC: ${ready ? 'OK' : 'UNAVAILABLE'}`);
failed ||= !ready;
if (failed) console.error('Apply supabase/migrations/20261108000000_restore_video_security_contract.sql in the database SQL editor, then run this check again. Never bypass the security budget.');
process.exitCode = failed ? 1 : 0;
