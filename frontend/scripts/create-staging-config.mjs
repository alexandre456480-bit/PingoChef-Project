import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

export function stagingConfig(config, stagingOrigin, productionOrigin) {
  const origin = value => {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.href !== `${url.origin}/` || url.username || url.password) throw new Error('Explicit HTTPS origin required');
    return url;
  };
  const staging=origin(stagingOrigin), production=origin(productionOrigin);
  const current=new URL(config.rewrites.find(r=>r.source==='/api/:path*').destination);
  if (staging.hostname===production.hostname || staging.hostname===current.hostname) throw new Error('Staging cannot proxy production');
  return {...config,rewrites:config.rewrites.map(r=>r.source==='/api/:path*'?{...r,destination:`${staging.origin}/api/:path*`}:r)};
}
if (process.argv[1]?.endsWith('create-staging-config.mjs')) {
  const root=resolve(import.meta.dirname,'../..');
  const config=stagingConfig(JSON.parse(await readFile(resolve(root,'frontend/vercel.json'),'utf8')),
    process.env.STAGING_API_ORIGIN,process.env.PRODUCTION_API_ORIGIN);
  await mkdir(resolve(root,'.tools'),{recursive:true});
  await writeFile(resolve(root,'.tools/staging-vercel.json'),JSON.stringify(config,null,2)+'\n');
  console.log('Prepared .tools/staging-vercel.json; no deployment performed');
}
