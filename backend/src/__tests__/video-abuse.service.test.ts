import { VideoAbuseService, VideoSecurityError, videoRequestIdentity, type VideoRateLimiter } from '../services/video-abuse.service';
import { loadVideoSecurityConfig } from '../config/video-security.config';
import { validateVideoDeploymentEnvironment } from '../config/video-deployment.config';
import { generateKeyPairSync } from 'node:crypto';

const identity = { sessionHash: 'a'.repeat(64), ipHash: 'b'.repeat(64) };
const access = { businessId: 'business', mediaId: 'media', playbackId: 'playback' };

describe('video abuse financial boundary', () => {
  it.each(['RATE_LIMITED', 'VIDEO_TEMPORARILY_UNAVAILABLE', 'MEDIA_NOT_AVAILABLE'])('denies %s from shared authority', async code => {
    const limiter: VideoRateLimiter = { consume: jest.fn().mockResolvedValue({ allowed: false, code, state: 'HARD_BLOCK' }) };
    await expect(new VideoAbuseService(limiter).authorizePlayback(access, identity)).rejects.toBeInstanceOf(VideoSecurityError);
  });
  it('never fails open on shared storage failure', async () => {
    const consume = jest.fn().mockRejectedValue(new Error('storage unavailable'));
    await expect(new VideoAbuseService({ consume }).authorizePlayback(access, identity)).rejects.toThrow();
    await expect(new VideoAbuseService({ consume }).authorizeUpload('business', 'owner', identity)).rejects.toThrow();
  });
  it('global environment stop never calls storage or authorizes another token', async () => {
    const consume = jest.fn();
    const config = loadVideoSecurityConfig({ VIDEO_PLAYBACK_GLOBAL_KILL_SWITCH: 'true' });
    await expect(new VideoAbuseService({ consume }, config).authorizePlayback(access, identity)).rejects.toMatchObject({ status: 503 });
    expect(consume).not.toHaveBeenCalled();
  });
  it('sends only server-resolved dimensions and bounded operational policy to PostgreSQL', async () => {
    const consume = jest.fn().mockResolvedValue({ allowed: true, code: 'OK', state: 'NORMAL' });
    await new VideoAbuseService({ consume }).authorizePlayback(access, identity);
    expect(consume).toHaveBeenCalledWith(expect.objectContaining({ p_business_id: 'business', p_media_id: 'media', p_playback_id: 'playback',
      p_session_hash: identity.sessionHash, p_ip_hash: identity.ipHash, p_preview: false }));
    expect(JSON.stringify(consume.mock.calls)).not.toMatch(/token|cookie|user.agent/i);
  });
  it('uses a short authenticated opaque cookie and daily HMACs without raw IP', () => {
    const before = process.env.VIDEO_IP_HASH_SECRET; process.env.VIDEO_IP_HASH_SECRET = 's'.repeat(32);
    try {
      const now = Date.parse('2026-10-15T12:00:00Z');
      const cookie = jest.fn(); const req = { headers: {}, ip: '192.0.2.20', socket: {} } as any;
      const first = videoRequestIdentity(req, { cookie } as any, now);
      const [name, value, options] = cookie.mock.calls[0];
      expect(options).toMatchObject({ httpOnly: true, sameSite: 'lax', maxAge: 1800000 });
      expect(JSON.stringify(first)).not.toContain('192.0.2.20');
      expect(first.ipHash).toHaveLength(64);
      req.headers.cookie = `${name}=${value}`; cookie.mockClear();
      expect(videoRequestIdentity(req, { cookie } as any, now)).toEqual(first);
      expect(cookie).not.toHaveBeenCalled();
      req.headers.cookie += 'tampered';
      expect(videoRequestIdentity(req, { cookie } as any, now).sessionHash).not.toBe(first.sessionHash);
      expect(videoRequestIdentity(req, { cookie } as any, now + 1801000).sessionHash).not.toBe(first.sessionHash);
    } finally { if (before === undefined) delete process.env.VIDEO_IP_HASH_SECRET; else process.env.VIDEO_IP_HASH_SECRET = before; }
  });
  it('rejects malformed config and validates video credentials/restrictions before enabling deployment', () => {
    expect(() => loadVideoSecurityConfig({ VIDEO_PLAYBACK_IP_LIMIT: 'NaN' })).toThrow();
    expect(() => loadVideoSecurityConfig({ VIDEO_CIRCUIT_SOFT_THRESHOLD: '9500' })).toThrow();
    expect(() => validateVideoDeploymentEnvironment({ NODE_ENV: 'production', VIDEO_SECURITY_ENABLED: 'true' })).toThrow();
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const env = { NODE_ENV: 'production', MUX_TOKEN_ID: 'fixture', MUX_TOKEN_SECRET: 'fixture', MUX_WEBHOOK_SIGNING_SECRET: 'fixture',
      MUX_SIGNING_KEY_ID: 'fixture', MUX_SIGNING_PRIVATE_KEY: privateKey.export({type:'pkcs8',format:'pem'}).toString(),
      VIDEO_IP_HASH_SECRET: 's'.repeat(32), VIDEO_RECONCILIATION_SECRET: 'r'.repeat(32),
      VIDEO_UPLOAD_ALLOWED_ORIGINS: 'https://staging.example.test', CRON_SECRET: 'c'.repeat(32) };
    expect(() => validateVideoDeploymentEnvironment(env)).toThrow('MUX_PLAYBACK_RESTRICTION_ID');
    expect(() => validateVideoDeploymentEnvironment({ ...env, MUX_PLAYBACK_RESTRICTION_ID: 'fixture' })).not.toThrow();
  });
});
