const HARD_MAX_DURATION_SECONDS = 15;
const HARD_MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export const ALLOWED_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/webm'
] as const;

export const ALLOWED_VIDEO_EXTENSIONS = ['mp4', 'mov', 'webm'] as const;

export interface VideoLimitsConfig {
  maxDurationSeconds: number;
  maxUploadBytes: number;
  uploadUrlTtlSeconds: number;
  dailyUploadLimit: number;
  maxPendingUploads: number;
  uploadRateLimit: number;
  uploadRateWindowSeconds: number;
  reconciliationBatchSize: number;
  webhookClaimStaleSeconds: number;
}

export interface VideoPlaybackConfig {
  muxSigningKeyId: string;
  muxSigningPrivateKey: string;
  playbackTokenTtlSeconds: number;
  playbackRateLimit: number;
  playbackRateWindowSeconds: number;
}

export interface VideoConfig extends VideoLimitsConfig, VideoPlaybackConfig {
  muxTokenId: string;
  muxTokenSecret: string;
  muxWebhookSigningSecret: string;
  ipHashSecret: string;
  reconciliationSecret: string;
  allowedUploadOrigins: string[];
  muxTestMode: boolean;
}

export class VideoConfigurationError extends Error {
  readonly code = 'VIDEO_CONFIGURATION_ERROR';
  readonly status = 503;

  constructor(message: string) {
    super(message);
    this.name = 'VideoConfigurationError';
  }
}

function positiveInteger(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  options: { min?: number; max?: number } = {}
): number {
  const raw = env[name];
  const parsed = raw === undefined || raw.trim() === '' ? fallback : Number(raw);
  const min = options.min ?? 1;
  const max = options.max ?? Number.MAX_SAFE_INTEGER;

  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new VideoConfigurationError(
      `${name} deve ser um inteiro entre ${min} e ${max}.`
    );
  }

  return parsed;
}

function requiredSecret(env: NodeJS.ProcessEnv, name: string, minLength = 1): string {
  const value = env[name]?.trim();
  if (!value || value.length < minLength) {
    throw new VideoConfigurationError(`${name} não está configurada corretamente.`);
  }
  return value;
}

function requiredSecretWithAlias(
  env: NodeJS.ProcessEnv,
  name: string,
  alias: string
): string {
  const value = env[name]?.trim() || env[alias]?.trim();
  if (!value) throw new VideoConfigurationError(`${name} não está configurada corretamente.`);
  return value;
}

function parseAllowedOrigins(env: NodeJS.ProcessEnv): string[] {
  const raw = env.VIDEO_UPLOAD_ALLOWED_ORIGINS
    || env.FRONTEND_ORIGINS
    || 'http://localhost:4200,http://127.0.0.1:4200';

  const origins = Array.from(new Set(
    raw.split(',')
      .map(value => value.trim())
      .filter(Boolean)
      .map(value => {
        if (value === '*') {
          throw new VideoConfigurationError(
            'VIDEO_UPLOAD_ALLOWED_ORIGINS não permite wildcard (*).'
          );
        }

        let parsed: URL;
        try {
          parsed = new URL(value);
        } catch {
          throw new VideoConfigurationError(
            'VIDEO_UPLOAD_ALLOWED_ORIGINS contém uma origem inválida.'
          );
        }

        if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== value.replace(/\/$/, '')) {
          throw new VideoConfigurationError(
            'VIDEO_UPLOAD_ALLOWED_ORIGINS deve conter somente origens HTTP(S), sem paths.'
          );
        }

        if (env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
          throw new VideoConfigurationError(
            'VIDEO_UPLOAD_ALLOWED_ORIGINS deve usar HTTPS em produção.'
          );
        }

        return parsed.origin;
      })
  ));

  if (origins.length === 0) {
    throw new VideoConfigurationError('Nenhuma origem de upload foi configurada.');
  }

  return origins;
}

export function loadVideoLimits(env: NodeJS.ProcessEnv = process.env): VideoLimitsConfig {
  return {
    maxDurationSeconds: positiveInteger(
      env,
      'VIDEO_MAX_DURATION_SECONDS',
      HARD_MAX_DURATION_SECONDS,
      { max: HARD_MAX_DURATION_SECONDS }
    ),
    maxUploadBytes: positiveInteger(
      env,
      'VIDEO_MAX_UPLOAD_BYTES',
      HARD_MAX_UPLOAD_BYTES,
      { max: HARD_MAX_UPLOAD_BYTES }
    ),
    uploadUrlTtlSeconds: positiveInteger(
      env,
      'VIDEO_UPLOAD_URL_TTL_SECONDS',
      900,
      { min: 60, max: 3600 }
    ),
    dailyUploadLimit: positiveInteger(env, 'VIDEO_DAILY_UPLOAD_LIMIT', 20, { max: 10000 }),
    maxPendingUploads: positiveInteger(env, 'VIDEO_MAX_PENDING_UPLOADS', 3, { max: 100 }),
    uploadRateLimit: positiveInteger(env, 'VIDEO_UPLOAD_RATE_LIMIT', 5, { max: 1000 }),
    uploadRateWindowSeconds: positiveInteger(
      env,
      'VIDEO_UPLOAD_RATE_WINDOW_SECONDS',
      900,
      { min: 60, max: 86400 }
    ),
    reconciliationBatchSize: positiveInteger(
      env,
      'VIDEO_RECONCILIATION_BATCH_SIZE',
      50,
      { max: 100 }
    ),
    webhookClaimStaleSeconds: positiveInteger(
      env,
      'VIDEO_WEBHOOK_CLAIM_STALE_SECONDS',
      300,
      { min: 30, max: 3600 }
    )
  };
}

export function loadVideoPlaybackConfig(
  env: NodeJS.ProcessEnv = process.env
): VideoPlaybackConfig {
  return {
    muxSigningKeyId: requiredSecretWithAlias(env, 'MUX_SIGNING_KEY_ID', 'MUX_SIGNING_KEY'),
    muxSigningPrivateKey: requiredSecretWithAlias(
      env,
      'MUX_SIGNING_PRIVATE_KEY',
      'MUX_PRIVATE_KEY'
    ),
    playbackTokenTtlSeconds: positiveInteger(
      env,
      'VIDEO_PLAYBACK_TOKEN_TTL_SECONDS',
      120,
      { min: 30, max: 300 }
    ),
    playbackRateLimit: positiveInteger(
      env,
      'VIDEO_PLAYBACK_RATE_LIMIT',
      20,
      { min: 1, max: 300 }
    ),
    playbackRateWindowSeconds: positiveInteger(
      env,
      'VIDEO_PLAYBACK_RATE_WINDOW_SECONDS',
      60,
      { min: 10, max: 3600 }
    )
  };
}

export function loadVideoConfig(env: NodeJS.ProcessEnv = process.env): VideoConfig {
  return {
    ...loadVideoLimits(env),
    ...loadVideoPlaybackConfig(env),
    muxTokenId: requiredSecret(env, 'MUX_TOKEN_ID'),
    muxTokenSecret: requiredSecret(env, 'MUX_TOKEN_SECRET'),
    muxWebhookSigningSecret: requiredSecret(env, 'MUX_WEBHOOK_SIGNING_SECRET'),
    ipHashSecret: requiredSecret(env, 'VIDEO_IP_HASH_SECRET', 32),
    reconciliationSecret: requiredSecret(env, 'VIDEO_RECONCILIATION_SECRET', 32),
    allowedUploadOrigins: parseAllowedOrigins(env),
    muxTestMode: env.MUX_TEST_MODE === 'true'
  };
}

export function resolveAllowedUploadOrigin(origin: string | undefined, config: VideoConfig): string {
  if (!origin) {
    const error = new Error('O header Origin é obrigatório para criar um upload pelo navegador.');
    Object.assign(error, { status: 403, code: 'UPLOAD_ORIGIN_REQUIRED' });
    throw error;
  }

  let normalized: string;
  try {
    normalized = new URL(origin).origin;
  } catch {
    const error = new Error('Origem de upload inválida.');
    Object.assign(error, { status: 403, code: 'UPLOAD_ORIGIN_FORBIDDEN' });
    throw error;
  }

  if (!config.allowedUploadOrigins.includes(normalized)) {
    const error = new Error('Origem não autorizada para upload de vídeo.');
    Object.assign(error, { status: 403, code: 'UPLOAD_ORIGIN_FORBIDDEN' });
    throw error;
  }

  return normalized;
}
