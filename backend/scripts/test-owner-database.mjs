// Real local PostgreSQL, no .env or remote database URL. Complete migration chain.
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { resolve, join, sep } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import pg from 'pg';
import { verifyOwnerDatabase } from './verify-owner-database.mjs';
import { verifyMenuAnalytics } from './verify-menu-analytics.mjs';
import { verifyQrSecurity } from './verify-qr-security.mjs';
import { benchmarkAnalyticsIndex } from './benchmark-analytics-index.mjs';
import { verifyPerformanceDatabase } from './verify-performance-database.mjs';
import { checkedMigrations,migrationSql } from './check-migrations.mjs';
import { verifyImageStorage } from './verify-image-storage.mjs';
import { verifyIndexRecovery } from './verify-index-recovery.mjs';

const root = resolve(import.meta.dirname, '../..');
const toolsRoot = resolve(root, '.tools');
await mkdir(toolsRoot, { recursive: true });
const directory = await mkdtemp(join(toolsRoot, 'owner-db-'));
if (!directory.startsWith(toolsRoot + sep)) throw new Error('Invalid local test directory');
const dataDirectory = join(directory, 'data');
const platform = process.platform === 'win32' ? 'windows' : process.platform;
const binaries = await import(`@embedded-postgres/${platform}-${process.arch}`);
const run = promisify(execFile);
const password = randomBytes(32).toString('hex');
const passwordFile = join(directory, 'password');
await writeFile(passwordFile, password, { mode: 0o600 });
const port = await new Promise((accept, reject) => {
  const server = createServer(); server.once('error', reject);
  server.listen(0, '127.0.0.1', () => { const value = server.address().port; server.close(() => accept(value)); });
});
const config = { host: '127.0.0.1', port, user: 'postgres', password, database: 'postgres', connectionTimeoutMillis: 5000 };
let started = false, pool;
try {
  await run(binaries.initdb, ['-D', dataDirectory, '-U', 'postgres', `--pwfile=${passwordFile}`,
    '--auth=scram-sha-256', '--encoding=UTF8', '--locale=C'], { windowsHide: true, timeout: 30000 });
  const processHandle = spawn(binaries.postgres, ['-D', dataDirectory, '-h', '127.0.0.1', '-p', String(port)], { windowsHide: true });
  await new Promise((accept, reject) => {
    const timer = setTimeout(() => reject(new Error('Local PostgreSQL startup timeout')), 30000);
    processHandle.on('error', reject);
    processHandle.on('exit', code => { if (!started) reject(new Error(`Local PostgreSQL exited ${code}`)); });
    processHandle.stderr.on('data', value => {
      if (value.toString().includes('ready to accept connections')) { started = true; clearTimeout(timer); accept(); }
    });
  });
  pool = new pg.Pool({ ...config, max: 12 });
  await pool.query(`
    CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
    CREATE SCHEMA auth; CREATE SCHEMA extensions;
    -- Minimal Supabase Storage catalog contract; object HTTP API is not emulated.
    CREATE SCHEMA storage;
    CREATE TABLE storage.buckets(id text PRIMARY KEY,name text NOT NULL,public boolean DEFAULT false,file_size_limit bigint,allowed_mime_types text[]);
    CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text REFERENCES storage.buckets(id),name text,UNIQUE(bucket_id,name));
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT USAGE ON SCHEMA storage TO anon,authenticated,service_role;
    GRANT ALL ON storage.objects TO anon,authenticated,service_role;
    CREATE TABLE auth.users(id uuid PRIMARY KEY, email text UNIQUE, email_confirmed_at timestamptz, created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(), instance_id uuid, aud text, role text, encrypted_password text,
      raw_app_meta_data jsonb DEFAULT '{}', raw_user_meta_data jsonb DEFAULT '{}', confirmation_token text, recovery_token text,
      email_change text, email_change_token_new text, last_sign_in_at timestamptz);
    CREATE TABLE auth.sessions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE);
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),auth.jwt()->>'sub'),'')::uuid $$;
    GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon,authenticated,service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon,authenticated,service_role;
  `);
  for (const {file} of await checkedMigrations()) {
    // The optional synthetic benchmark needs the pre-index schema.
    if (file === '20261014010000_analytics_product_trend_index.sql') await benchmarkAnalyticsIndex(pool);
    try { await pool.query(await migrationSql(file)); }
    catch (error) { throw new Error(`Migration ${file}: ${error.message}`, { cause: error }); }
  }
  console.log(`OK full migration chain (PostgreSQL 16; source: ${process.env.MIGRATIONS_FROM_GIT_INDEX==='true'?'Git index':'working tree'})`);
  for (const file of ['20261014000000_performance_read_paths.sql', '20261014010000_analytics_product_trend_index.sql']) {
    await pool.query(await migrationSql(file));
  }
  const index = await pool.query("SELECT indisvalid,indisready FROM pg_index WHERE indexrelid='public.analytics_product_trend_idx'::regclass");
  if (!index.rows[0]?.indisvalid || !index.rows[0]?.indisready) throw new Error('Invalid performance index');
  // Reproduce the observed partial deployment, then rerun the repair twice.
  await pool.query(`ALTER TABLE public.registration_intents DROP COLUMN plan_selection_intent_id,
    DROP COLUMN terms_version, DROP COLUMN terms_accepted_at`);
  const registrationRepair = await migrationSql('20261012000000_repair_free_registration.sql');
  await pool.query(registrationRepair);
  await pool.query(registrationRepair);
  console.log('OK partial registration schema repair and repeated application');
  await verifyOwnerDatabase(pool);
  await verifyMenuAnalytics(pool);
  await verifyQrSecurity(pool);
  await verifyPerformanceDatabase(pool);
  await verifyImageStorage(pool);
  await verifyIndexRecovery(pool);
} finally {
  if (pool) await pool.end();
  if (started) await run(binaries.pg_ctl, ['-D', dataDirectory, '-m', 'fast', '-w', 'stop'], { windowsHide: true, timeout: 30000 });
  // Only the verified, freshly created test directory under this workspace's .tools.
  if (directory.startsWith(toolsRoot + sep)) await rm(directory, { recursive: true, force: true, maxRetries: 8, retryDelay: 200 });
}
