import { VideoConfigurationError } from './video.config';

function integer(env: NodeJS.ProcessEnv, name: string, fallback: number, min = 1, max = 10000): number {
  const value = Number(env[name]?.trim() || fallback);
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new VideoConfigurationError(`Invalid ${name}`);
  return value;
}

export function loadVideoSecurityConfig(env: NodeJS.ProcessEnv = process.env) {
  for (const key of ['VIDEO_AUTO_CIRCUIT_BREAKER_ENABLED', 'VIDEO_PLAYBACK_GLOBAL_KILL_SWITCH']) {
    if (env[key] && !['true', 'false'].includes(env[key]!)) throw new VideoConfigurationError(`Invalid ${key}`);
  }
  const businessLimit = integer(env, 'VIDEO_PLAYBACK_BUSINESS_LIMIT', 6000);
  const softThreshold = integer(env, 'VIDEO_CIRCUIT_SOFT_THRESHOLD', 1500);
  const hardThreshold = integer(env, 'VIDEO_CIRCUIT_HARD_THRESHOLD', 9000);
  if (softThreshold >= hardThreshold || hardThreshold < businessLimit) throw new VideoConfigurationError('Invalid video circuit thresholds');
  return {
    globalKillSwitch: env.VIDEO_PLAYBACK_GLOBAL_KILL_SWITCH === 'true',
    webhookLimit: integer(env, 'VIDEO_WEBHOOK_RATE_LIMIT', 10000),
    sessionTtlSeconds: integer(env, 'VIDEO_ANONYMOUS_SESSION_TTL_SECONDS', 1800, 300, 3600),
    // Passed only by the BFF; these are operational budgets, never commercial plan quotas.
    policy: {
      windowSeconds: integer(env, 'VIDEO_PLAYBACK_RATE_WINDOW_SECONDS', 60, 10, 3600),
      sessionLimit: integer(env, 'VIDEO_PLAYBACK_RATE_LIMIT', 20, 1, 300),
      burstLimit: integer(env, 'VIDEO_PLAYBACK_BURST_LIMIT', 8, 1, 300),
      ipLimit: integer(env, 'VIDEO_PLAYBACK_IP_LIMIT', 1200),
      businessLimit,
      mediaLimit: integer(env, 'VIDEO_PLAYBACK_MEDIA_LIMIT', 3000),
      globalLimit: integer(env, 'VIDEO_PLAYBACK_GLOBAL_LIMIT', 10000),
      softThreshold, hardThreshold,
      hardDenials: integer(env, 'VIDEO_CIRCUIT_HARD_DENIALS', 1500),
      blockSeconds: integer(env, 'VIDEO_CIRCUIT_BLOCK_SECONDS', 300, 30, 3600),
      autoCircuit: env.VIDEO_AUTO_CIRCUIT_BREAKER_ENABLED !== 'false',
      uploadLimit: integer(env, 'VIDEO_UPLOAD_RATE_LIMIT', 5, 1, 1000),
      uploadWindow: integer(env, 'VIDEO_UPLOAD_RATE_WINDOW_SECONDS', 900, 60, 86400),
      uploadDailyLimit: integer(env, 'VIDEO_DAILY_UPLOAD_LIMIT', 20),
    }
  };
}

export type VideoSecurityConfig = ReturnType<typeof loadVideoSecurityConfig>;
