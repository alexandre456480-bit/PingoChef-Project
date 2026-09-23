import {
  loadVideoConfig,
  loadVideoLimits,
  resolveAllowedUploadOrigin
} from '../config/video.config';

const validEnv: NodeJS.ProcessEnv = {
  NODE_ENV: 'production',
  MUX_TOKEN_ID: 'mux-token-id',
  MUX_TOKEN_SECRET: 'mux-token-secret',
  MUX_WEBHOOK_SIGNING_SECRET: 'mux-webhook-secret',
  MUX_SIGNING_KEY_ID: 'mux-signing-key',
  MUX_SIGNING_PRIVATE_KEY: 'base64-private-key',
  VIDEO_IP_HASH_SECRET: 'i'.repeat(32),
  VIDEO_RECONCILIATION_SECRET: 'r'.repeat(32),
  VIDEO_UPLOAD_ALLOWED_ORIGINS: 'https://app.example.com'
};

describe('video configuration', () => {
  it('hard-caps file size at 50 MB and duration at 15 seconds', () => {
    expect(() => loadVideoLimits({
      VIDEO_MAX_UPLOAD_BYTES: String(50 * 1024 * 1024 + 1)
    })).toThrow('VIDEO_MAX_UPLOAD_BYTES');
    expect(() => loadVideoLimits({
      VIDEO_MAX_DURATION_SECONDS: '16'
    })).toThrow('VIDEO_MAX_DURATION_SECONDS');
  });

  it('hard-caps signed playback credentials at five minutes', () => {
    expect(() => loadVideoConfig({
      ...validEnv,
      VIDEO_PLAYBACK_TOKEN_TTL_SECONDS: '301'
    })).toThrow('VIDEO_PLAYBACK_TOKEN_TTL_SECONDS');
  });

  it('rejects wildcard and non-HTTPS upload origins in production', () => {
    expect(() => loadVideoConfig({
      ...validEnv,
      VIDEO_UPLOAD_ALLOWED_ORIGINS: '*'
    })).toThrow('wildcard');
    expect(() => loadVideoConfig({
      ...validEnv,
      VIDEO_UPLOAD_ALLOWED_ORIGINS: 'http://app.example.com'
    })).toThrow('HTTPS');
  });

  it('requires long independent HMAC and reconciliation secrets', () => {
    expect(() => loadVideoConfig({
      ...validEnv,
      VIDEO_IP_HASH_SECRET: 'short'
    })).toThrow('VIDEO_IP_HASH_SECRET');
  });

  it('accepts only an exact configured browser origin', () => {
    const config = loadVideoConfig(validEnv);
    expect(resolveAllowedUploadOrigin('https://app.example.com', config))
      .toBe('https://app.example.com');
    expect(() => resolveAllowedUploadOrigin('https://evil.example.com', config))
      .toThrow('não autorizada');
  });
});
