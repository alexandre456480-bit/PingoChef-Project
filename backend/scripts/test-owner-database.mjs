// Real local PostgreSQL, no .env or remote database URL. Complete migration chain.
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, readdir, writeFile, rm, mkdir } from 'node:fs/promises';
import { resolve, join, sep } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import pg from 'pg';
import { verifyOwnerDatabase } from './verify-owner-database.mjs';
import { verifyMenuAnalytics } from './verify-menu-analytics.mjs';
import { verifyQrSecurity } from './verify-qr-security.mjs';

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
  const migrations = resolve(root, 'supabase/migrations');
  for (const file of (await readdir(migrations)).filter(file => file.endsWith('.sql')).sort()) {
    try { await pool.query(await readFile(join(migrations, file), 'utf8')); }
    catch (error) { throw new Error(`Migration ${file}: ${error.message}`, { cause: error }); }
  }
  console.log('OK full migration chain (PostgreSQL 16)');
  await verifyOwnerDatabase(pool);
  await verifyMenuAnalytics(pool);
  await verifyQrSecurity(pool);
} finally {
  if (pool) await pool.end();
  if (started) await run(binaries.pg_ctl, ['-D', dataDirectory, '-m', 'fast', '-w', 'stop'], { windowsHide: true, timeout: 30000 });
  // Only the verified, freshly created test directory under this workspace's .tools.
  if (directory.startsWith(toolsRoot + sep)) await rm(directory, { recursive: true, force: true, maxRetries: 8, retryDelay: 200 });
}
