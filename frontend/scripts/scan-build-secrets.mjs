import { readdir, readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { parseEnv } from 'node:util';

const buildRoot = resolve('dist');
const textExtensions = new Set(['.js', '.mjs', '.cjs', '.html', '.css', '.json', '.map', '.txt']);
const forbidden = [
  /MUX_TOKEN_SECRET/,
  /MUX_PRIVATE_KEY/,
  /MUX_SIGNING_PRIVATE_KEY/,
  /MUX_SIGNING_KEY_ID/,
  /MUX_WEBHOOK_SIGNING_SECRET/,
  /SUPABASE_SERVICE_ROLE_KEY/,
  /OWNER_SESSION_ENCRYPTION_KEY/,
  /ANALYTICS_HASH_SECRET/,
  /INVITATION_HASH_SECRET/,
  /ADMIN_LOGIN_HASH_SECRET/,
  /INTERNAL_JOBS_SECRET/,
  /ACTIVATION_TOKEN_SECRET/,
  /VIDEO_IP_HASH_SECRET/,
  /VIDEO_RECONCILIATION_SECRET/,
  /LIKE_HASH_SECRET/,
  /-----BEGIN (?:(?:RSA|EC|OPENSSH|ENCRYPTED) )?PRIVATE KEY-----/,
  /sb_secret_[A-Za-z0-9_-]{20,}/,
  /mux-signature\s*[:=]/i,
];

// Compare known private values without loading them into the Angular build or printing them.
// CI may provide scanner-only environment values; local checks also read the ignored backend .env.
const privateNames = new Set([
  'SUPABASE_SERVICE_ROLE_KEY',
  'OWNER_SESSION_ENCRYPTION_KEY',
  'ANALYTICS_HASH_SECRET',
  'INVITATION_HASH_SECRET',
  'ADMIN_LOGIN_HASH_SECRET',
  'INTERNAL_JOBS_SECRET',
  'ACTIVATION_TOKEN_SECRET',
  'VIDEO_IP_HASH_SECRET',
  'VIDEO_RECONCILIATION_SECRET',
  'LIKE_HASH_SECRET',
  'MUX_TOKEN_ID',
  'MUX_TOKEN_SECRET',
  'MUX_SIGNING_KEY_ID',
  'MUX_SIGNING_PRIVATE_KEY',
  'MUX_PRIVATE_KEY',
  'MUX_WEBHOOK_SIGNING_SECRET',
]);
let localEnvironment = {};
try {
  localEnvironment = parseEnv(await readFile(resolve('../backend/.env'), 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const knownPrivateValues = Object.entries({ ...localEnvironment, ...process.env })
  .filter(
    ([name, value]) => privateNames.has(name) && typeof value === 'string' && value.length >= 16,
  )
  .map(([name, value]) => ({ name, variants: [value, JSON.stringify(value).slice(1, -1)] }));

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? filesUnder(path) : [path];
    }),
  );
  return nested.flat();
}

const files = (await filesUnder(buildRoot)).filter((file) => textExtensions.has(extname(file)));
const findings = [];
for (const file of files) {
  const content = await readFile(file, 'utf8');
  for (const { name, variants } of knownPrivateValues) {
    if (variants.some((value) => content.includes(value)))
      findings.push(`${file}: private value ${name}`);
  }
  for (const pattern of forbidden) {
    if (pattern.test(content)) findings.push(`${file}: ${pattern}`);
  }
  for (const jwt of content.matchAll(
    /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  )) {
    try {
      const claims = JSON.parse(Buffer.from(jwt[0].split('.')[1], 'base64url').toString('utf8'));
      if (
        claims.role === 'service_role' ||
        claims.role === 'authenticated' ||
        claims.aud === 'authenticated'
      )
        findings.push(`${file}: embedded private JWT`);
    } catch {
      /* Ignore non-JWT matches; never print matched material. */
    }
  }
}

if (findings.length > 0) {
  console.error('Potential backend secret material found in the frontend build:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exitCode = 1;
} else {
  console.log(
    `Secret scan passed across ${files.length} frontend build files; ${knownPrivateValues.length} known private values checked without disclosure.`,
  );
}
