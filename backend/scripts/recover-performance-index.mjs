import { readFile } from 'node:fs/promises';
import pg from 'pg';

// Call only with one dedicated connection, outside any transaction wrapper.
export async function verifyPerformanceIndex(client, { repair=false }={}) {
  const inspect=()=>client.query(`SELECT i.indisvalid,i.indisready,i.indisunique,c.relname,
    n.nspname,t.relname table_name,pg_get_indexdef(i.indexrelid) definition
    FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_class t ON t.oid=i.indrelid WHERE i.indexrelid=to_regclass('public.analytics_product_trend_idx')`);
  await client.query("SELECT pg_advisory_lock(hashtextextended('performance-index-maintenance',0))");
  try {
    const row=(await inspect()).rows[0];
    const expected="CREATE INDEX analytics_product_trend_idx ON public.analytics_dimensions_daily USING btree (business_id, dimension_key, day) WHERE ((dimension = 'product'::text) AND (event_name = 'PRODUCT_VIEW'::text))";
    if (row && (row.nspname!=='public' || row.table_name!=='analytics_dimensions_daily' || row.indisunique
      || row.definition.replace(/\s+/g,' ')!==expected)) throw new Error('Unexpected index definition; manual review required');
    if (row && (!row.indisvalid || !row.indisready)) {
      if (!repair) throw new Error('Invalid index; controlled recovery required');
      await client.query('DROP INDEX CONCURRENTLY public.analytics_product_trend_idx');
    }
    if (!row || !row.indisvalid || !row.indisready) {
      if (!repair) throw new Error('Missing index');
      await client.query(await readFile(new URL('../../supabase/migrations/20261014010000_analytics_product_trend_index.sql',import.meta.url),'utf8'));
    }
    const final=(await inspect()).rows[0];
    if (!final?.indisvalid || !final?.indisready) throw new Error('Index remains invalid');
    return {valid:true,ready:true};
  } finally { await client.query("SELECT pg_advisory_unlock(hashtextextended('performance-index-maintenance',0))"); }
}
if (process.argv[1]?.endsWith('recover-performance-index.mjs')) {
  // Production recovery is deliberately a separate DBA action described in the runbook.
  if (process.env.DEPLOYMENT_ENV!=='staging' || !process.env.STAGING_DATABASE_URL
    || !process.env.EXPECTED_SUPABASE_PROJECT_REF || !process.env.PRODUCTION_SUPABASE_PROJECT_REF
    || process.env.EXPECTED_SUPABASE_PROJECT_REF===process.env.PRODUCTION_SUPABASE_PROJECT_REF) throw new Error('Explicit isolated staging required');
  const url=new URL(process.env.STAGING_DATABASE_URL);
  const expected=process.env.EXPECTED_SUPABASE_PROJECT_REF;
  if (!((url.hostname===`db.${expected}.supabase.co` && url.username==='postgres')
    || (url.hostname.endsWith('.pooler.supabase.com') && url.username===`postgres.${expected}`))) throw new Error('Staging DB identity mismatch');
  const client=new pg.Client({connectionString:url.href,ssl:{rejectUnauthorized:true},connectionTimeoutMillis:5000});
  try {await client.connect();console.log(await verifyPerformanceIndex(client,{repair:process.argv.includes('--repair-invalid')}));}
  catch {console.error('Index check/recovery failed; inspect securely in DBA console');process.exitCode=1;}
  finally {await client.end();}
}
