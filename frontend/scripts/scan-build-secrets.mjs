import { readdir, readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const buildRoot = resolve('dist');
const textExtensions = new Set(['.js', '.mjs', '.cjs', '.html', '.css', '.json', '.map', '.txt']);
const forbidden = [
  /MUX_TOKEN_SECRET/,
  /MUX_PRIVATE_KEY/,
  /MUX_SIGNING_PRIVATE_KEY/,
  /MUX_SIGNING_KEY_ID/,
  /MUX_WEBHOOK_SIGNING_SECRET/,
  /SUPABASE_SERVICE_ROLE_KEY/,
  /-----BEGIN (?:RSA )?PRIVATE KEY-----/,
  /mux-signature\s*[:=]/i
];

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  }));
  return nested.flat();
}

const files = (await filesUnder(buildRoot)).filter(file => textExtensions.has(extname(file)));
const findings = [];
for (const file of files) {
  const content = await readFile(file, 'utf8');
  for (const pattern of forbidden) {
    if (pattern.test(content)) findings.push(`${file}: ${pattern}`);
  }
}

if (findings.length > 0) {
  console.error('Potential backend secret material found in the frontend build:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exitCode = 1;
} else {
  console.log(`Secret scan passed across ${files.length} frontend build files.`);
}
