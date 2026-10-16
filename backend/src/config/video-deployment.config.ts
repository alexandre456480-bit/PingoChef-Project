import { createPrivateKey } from 'node:crypto';
import { loadVideoConfig, VideoConfigurationError } from './video.config';
import { loadVideoSecurityConfig } from './video-security.config';

export function validateVideoDeploymentEnvironment(env: NodeJS.ProcessEnv): void {
  if (env.NODE_ENV !== 'production') return;
  // Menu-only installations can have no video credentials. Video endpoints always fail closed.
  if (!env.MUX_TOKEN_ID && env.VIDEO_SECURITY_ENABLED !== 'true') return;
  const config = loadVideoConfig(env);
  loadVideoSecurityConfig(env);
  if (!config.muxPlaybackRestrictionId && (env.VIDEO_REQUIRE_PLAYBACK_RESTRICTION !== 'false' || env.DEPLOYMENT_ENV === 'production')) {
    throw new VideoConfigurationError('MUX_PLAYBACK_RESTRICTION_ID is required; staging compatibility exception must be explicit');
  }
  if (config.muxPlaybackRestrictionId && !/^[a-zA-Z0-9]{1,255}$/.test(config.muxPlaybackRestrictionId)) throw new VideoConfigurationError('Invalid MUX_PLAYBACK_RESTRICTION_ID');
  if (!env.CRON_SECRET || env.CRON_SECRET.length < 32) throw new VideoConfigurationError('CRON_SECRET is required for video maintenance');
  try {
    const pem = config.muxSigningPrivateKey.includes('BEGIN') ? config.muxSigningPrivateKey : Buffer.from(config.muxSigningPrivateKey, 'base64');
    const key = createPrivateKey(pem);
    if (key.asymmetricKeyType !== 'rsa') throw new Error();
  } catch { throw new VideoConfigurationError('Invalid MUX_SIGNING_PRIVATE_KEY'); }
}
