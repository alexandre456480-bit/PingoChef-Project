import Mux from '@mux/ts';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export function restrictionSettings(env) {
  const domains = [...new Set((env.MUX_PLAYBACK_ALLOWED_DOMAINS || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean))].sort();
  if (!domains.length || domains.length > 10 || domains.some(domain =>
    !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(domain)
    || /(^|\.)(localhost|local|test|invalid)$/.test(domain))) throw new Error('Explicit official DNS domains required (max 10, no wildcards/localhost)');
  return { referrer: { allowed_domains: domains, allow_no_referrer: false },
    user_agent: { allow_high_risk_user_agent: false, allow_no_user_agent: false } };
}

async function main() {
  if (process.env.DEPLOYMENT_ENV !== 'staging' || process.env.VERCEL_ENV === 'production') throw new Error('Staging-only tool; production must be configured through its reviewed release runbook');
  const settings = restrictionSettings(process.env);
  const apply = process.argv.includes('--apply');
  if (!apply) { console.log(JSON.stringify({ mode: 'DRY_RUN', domains: settings.referrer.allowed_domains.length, assetsToMigrate: 0, highRiskAgentsAllowed: false })); return; }
  if (!process.env.MUX_TOKEN_ID || !process.env.MUX_TOKEN_SECRET) throw new Error('Staging Mux credentials required');
  const mux = new Mux({ tokenId: process.env.MUX_TOKEN_ID, tokenSecret: process.env.MUX_TOKEN_SECRET, maxRetries: 0, timeout: 8000 });
  let id = process.env.MUX_PLAYBACK_RESTRICTION_ID;
  if (!id) {
    const restrictions = await mux.video.playbackRestrictions.list({ limit: 100 });
    if (restrictions.data.length >= 100) throw new Error('Set an explicit restriction ID before applying');
    const match = restrictions.data.find(row =>
      JSON.stringify([...row.referrer.allowed_domains].sort()) === JSON.stringify(settings.referrer.allowed_domains)
      && row.referrer.allow_no_referrer === false && row.user_agent.allow_high_risk_user_agent === false && row.user_agent.allow_no_user_agent === false);
    id = match?.id || (await mux.video.playbackRestrictions.create(settings)).id;
  } else {
    await mux.video.playbackRestrictions.retrieve(id);
    await mux.video.playbackRestrictions.updateReferrer(id, settings.referrer);
    await mux.video.playbackRestrictions.updateUserAgent(id, settings.user_agent);
  }
  // Restriction ID is configuration, not a credential. Never print token IDs/secrets.
  console.log(JSON.stringify({ mode: 'APPLY_STAGING', restrictionId: id, assetsModified: 0, domains: settings.referrer.allowed_domains.length }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => { console.error('Mux restriction configuration failed; verify staging settings and credentials. No credential values logged.'); process.exitCode = 1; });
}
