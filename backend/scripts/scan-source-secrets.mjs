import { readFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';

// Prints paths and rule names only, never credential values. Does not read .env files.
const root = resolve(import.meta.dirname, '../..');
const rules = {
  private_key: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  github_token: /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/,
  aws_key: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
  database_password: /(?:postgres(?:ql)?|mongodb(?:\+srv)?):\/\/[^\s/:]+:[^\s@]+@/i,
  supabase_secret: /\bsb_secret_[A-Za-z0-9_-]{20,}/,
  privileged_jwt: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{20,}/,
};
let count = 0, failed = false;
async function scan(path) {
  for (const entry of await readdir(path, { withFileTypes:true })) {
    if (['node_modules','dist','.git','.tools','.angular','.agents','.codex','.aws','playwright-report','test-results'].includes(entry.name) || (entry.name.startsWith('.env')&&entry.name!=='.env.example')) continue;
    const file = join(path,entry.name);
    if (entry.isDirectory()) await scan(file);
    else if (entry.name==='.env.example'||/\.(?:sql|json|ts|mjs|md|ya?ml)$/.test(entry.name)) {
      const value = await readFile(file,'utf8'); count++;
      for (const [rule,pattern] of Object.entries(rules)) if (pattern.test(value)) {
        console.error(JSON.stringify({file:file.slice(root.length+1),rule})); failed=true;
      }
    }
  }
}
await scan(root);
console.log(JSON.stringify({scanned:count,passed:!failed}));
if (failed) process.exitCode=1;
