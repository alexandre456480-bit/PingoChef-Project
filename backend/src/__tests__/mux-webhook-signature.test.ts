import { createHmac, generateKeyPairSync } from 'crypto';
import { decode, verify, type JwtPayload } from 'jsonwebtoken';
import type { VideoConfig } from '../config/video.config';
import { OfficialMuxVideoProvider } from '../services/mux-video.service';

const webhookSecret = 'mux-webhook-test-secret';
const config: VideoConfig = {
  muxTokenId: 'token-id',
  muxTokenSecret: 'token-secret',
  muxWebhookSigningSecret: webhookSecret,
  muxSigningKeyId: 'signing-key',
  muxSigningPrivateKey: 'private-key',
  playbackTokenTtlSeconds: 120,
  playbackRateLimit: 20,
  playbackRateWindowSeconds: 60,
  ipHashSecret: 'i'.repeat(32),
  reconciliationSecret: 'r'.repeat(32),
  allowedUploadOrigins: ['https://app.example.com'],
  muxTestMode: true,
  maxDurationSeconds: 15,
  maxUploadBytes: 50 * 1024 * 1024,
  uploadUrlTtlSeconds: 900,
  dailyUploadLimit: 20,
  maxPendingUploads: 3,
  uploadRateLimit: 5,
  uploadRateWindowSeconds: 900,
  reconciliationBatchSize: 50,
  webhookClaimStaleSeconds: 300
};

describe('official Mux webhook cryptographic verification', () => {
  const provider = new OfficialMuxVideoProvider(config);
  const rawBody = JSON.stringify({
    id: 'event-signed-test',
    type: 'video.asset.ready',
    data: { id: 'asset-signed-test', object: { type: 'asset' } }
  });

  it('accepts a correctly signed raw payload', async () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac('sha256', webhookSecret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

    await expect(provider.verifyAndUnwrapWebhook(rawBody, {
      'mux-signature': `t=${timestamp},v1=${signature}`
    })).resolves.toMatchObject({
      id: 'event-signed-test',
      type: 'video.asset.ready'
    });
  });

  it('rejects a modified or falsely signed payload', async () => {
    const timestamp = Math.floor(Date.now() / 1000);
    await expect(provider.verifyAndUnwrapWebhook(rawBody, {
      'mux-signature': `t=${timestamp},v1=${'0'.repeat(64)}`
    })).rejects.toThrow();
  });

  it('creates a playback JWT that cryptographically expires after the requested TTL', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const signingProvider = new OfficialMuxVideoProvider({
      ...config,
      muxSigningPrivateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
    });

    const issuedAt = Math.floor(Date.now() / 1000);
    const token = await signingProvider.signPlaybackToken('signed-playback-id', 30);
    const claims = decode(token) as JwtPayload;

    expect(claims.sub).toBe('signed-playback-id');
    expect(claims.exp).toBeDefined();
    expect(claims.exp).toBeGreaterThanOrEqual(issuedAt + 30);
    expect(claims.exp).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + 30);
    expect(() => verify(token, publicKey, { clockTimestamp: claims.exp! + 1 })).toThrow(
      'jwt expired'
    );
  });
});
