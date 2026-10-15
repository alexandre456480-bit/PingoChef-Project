import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export const migrationDirectory = resolve(import.meta.dirname, '../../supabase/migrations');
const run=promisify(execFile);
export async function migrationSql(file) {
  if(!/^\d{14}_[a-z0-9_]+\.sql$/.test(file))throw new Error('Invalid migration name');
  return readMigration(file);
}
async function readMigration(file) {
  if(process.env.MIGRATIONS_FROM_GIT_INDEX==='true')return (await run('git',['show',`:supabase/migrations/${file}`],{cwd:resolve(migrationDirectory,'../..'),windowsHide:true,maxBuffer:4*1024*1024})).stdout;
  return readFile(join(migrationDirectory,file),'utf8');
}
export async function checkedMigrations() {
  const files = process.env.MIGRATIONS_FROM_GIT_INDEX==='true'
    ? (await run('git',['ls-files','--','supabase/migrations/*.sql'],{cwd:resolve(migrationDirectory,'../..'),windowsHide:true})).stdout.trim().split(/\r?\n/).filter(Boolean).map(p=>p.split('/').pop()).sort()
    : (await readdir(migrationDirectory)).filter(f => f.endsWith('.sql')).sort();
  const manifest = JSON.parse(await readMigration('manifest.json'));
  if (JSON.stringify(files) !== JSON.stringify(manifest.map(m => m.file))) throw new Error('Migration manifest/order mismatch');
  const hashes = new Set(), versions = new Set();
  for (const entry of manifest) {
    if (!/^\d{14}_[a-z0-9_]+\.sql$/.test(entry.file)) throw new Error('Invalid migration filename');
    const sql = await migrationSql(entry.file);
    const hash = createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex');
    const version = entry.file.slice(0,14);
    if (entry.sha256 !== hash || hashes.has(hash) || versions.has(version)) throw new Error(`Migration checksum/duplicate: ${entry.file}`);
    if (/CREATE\s+INDEX\s+CONCURRENTLY/i.test(sql) && /\bBEGIN\s*;/i.test(sql)) throw new Error('Concurrent index inside transaction');
    hashes.add(hash); versions.add(version);
  }
  return manifest;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.log(`OK ${ (await checkedMigrations()).length } ordered migrations/checksums`);
}
