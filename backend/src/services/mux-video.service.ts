import Mux from '@mux/ts';
import type { UnwrapWebhookEvent } from '@mux/ts/resources/webhooks/webhooks';
import type { Upload } from '@mux/ts/resources/video/uploads';
import type { Asset } from '@mux/ts/resources/video/assets';
import { VideoConfig, loadVideoConfig } from '../config/video.config';
import { measuredFetch } from './request-performance.service';

export interface CreateDirectUploadInput {
  corsOrigin: string;
  timeoutSeconds: number;
  mediaId: string;
  testMode: boolean;
}

export interface CreatedDirectUpload {
  id: string;
  url: string;
  timeoutSeconds: number;
}

export interface ProviderUploadRecord {
  id: string;
  status: 'waiting' | 'asset_created' | 'errored' | 'cancelled' | 'timed_out';
  assetId: string | null;
  mediaId: string | null;
  timeoutSeconds: number;
}

export interface ProviderAssetRecord { id: string; mediaId: string | null; createdAt: number; }
export interface ProviderDeliveryRecord { assetId: string; deliveredSeconds: number; }

export interface MuxVideoProvider {
  createDirectUpload(input: CreateDirectUploadInput): Promise<CreatedDirectUpload>;
  verifyAndUnwrapWebhook(rawBody: string, headers: Record<string, unknown>): Promise<UnwrapWebhookEvent>;
  deleteAsset(assetId: string): Promise<void>;
  cancelUpload(uploadId: string): Promise<void>;
  retrieveUpload(uploadId: string): Promise<Upload>;
  retrieveAsset(assetId: string): Promise<Asset>;
  listRecentUploads(limit: number, page?: number): Promise<ProviderUploadRecord[]>;
  listAssetsPage?(limit: number, page: number): Promise<ProviderAssetRecord[]>;
  listDeliveryUsage?(start: number, end: number, page: number): Promise<ProviderDeliveryRecord[]>;
  signPlaybackToken(playbackId: string, ttlSeconds: number): Promise<string>;
  isNotFoundError(error: unknown): boolean;
  isUploadNotCancellableError(error: unknown): boolean;
}

export class OfficialMuxVideoProvider implements MuxVideoProvider {
  private readonly client: Mux;

  constructor(private readonly config: VideoConfig) {
    this.client = new Mux({
      fetch: measuredFetch('external'),
      tokenId: config.muxTokenId,
      tokenSecret: config.muxTokenSecret,
      webhookSecret: config.muxWebhookSigningSecret,
      jwtSigningKey: config.muxSigningKeyId,
      jwtPrivateKey: config.muxSigningPrivateKey,
      timeout: 8000, maxRetries: 0
    });
  }

  async createDirectUpload(input: CreateDirectUploadInput): Promise<CreatedDirectUpload> {
    const upload = await this.client.video.uploads.create({
      cors_origin: input.corsOrigin,
      timeout: input.timeoutSeconds,
      test: input.testMode,
      new_asset_settings: {
        playback_policies: ['signed'],
        passthrough: `pingo-media:${input.mediaId}`,
        max_resolution_tier: '1080p',
        video_quality: 'basic',
        test: input.testMode
      }
    });

    if (!upload.url) {
      throw new Error('Mux não retornou uma URL de Direct Upload.');
    }

    return {
      id: upload.id,
      url: upload.url,
      timeoutSeconds: upload.timeout
    };
  }

  async verifyAndUnwrapWebhook(
    rawBody: string,
    headers: Record<string, unknown>
  ): Promise<UnwrapWebhookEvent> {
    const event = await this.client.webhooks.unwrap(rawBody, headers as any, this.config.muxWebhookSigningSecret);
    const timestamp = Number(/(?:^|,)\s*t=(\d+)/.exec(String(headers['mux-signature'] || ''))?.[1]);
    if (!Number.isSafeInteger(timestamp) || timestamp > Math.floor(Date.now() / 1000) + 300) throw new Error('Invalid webhook timestamp');
    return event;
  }

  async deleteAsset(assetId: string): Promise<void> {
    await this.client.video.assets.delete(assetId);
  }

  async cancelUpload(uploadId: string): Promise<void> {
    await this.client.video.uploads.cancel(uploadId);
  }

  retrieveUpload(uploadId: string): Promise<Upload> {
    return this.client.video.uploads.retrieve(uploadId, { timeout: 8000, maxRetries: 0 });
  }

  retrieveAsset(assetId: string): Promise<Asset> {
    return this.client.video.assets.retrieve(assetId, { timeout: 8000, maxRetries: 0 });
  }

  async listRecentUploads(limit: number, page = 1): Promise<ProviderUploadRecord[]> {
    const result = await this.client.video.uploads.list({ limit, page });
    return result.data.map(upload => {
      const passthrough = upload.new_asset_settings?.passthrough;
      return {
        id: upload.id,
        status: upload.status,
        assetId: upload.asset_id ?? null,
        mediaId: passthrough?.startsWith('pingo-media:')
          ? passthrough.slice('pingo-media:'.length)
          : null,
        timeoutSeconds: upload.timeout
      };
    });
  }

  async listAssetsPage(limit: number, page: number): Promise<ProviderAssetRecord[]> {
    const result = await this.client.video.assets.list({ limit, page });
    return result.data.map(asset => ({ id: asset.id, createdAt: Number(asset.created_at),
      mediaId: asset.passthrough?.startsWith('pingo-media:') ? asset.passthrough.slice('pingo-media:'.length) : null }));
  }

  async listDeliveryUsage(start: number, end: number, page: number): Promise<ProviderDeliveryRecord[]> {
    const result = await this.client.video.deliveryUsage.list({ timeframe: [String(start), String(end)], limit: 100, page });
    return result.data.map(row => ({ assetId: row.asset_id, deliveredSeconds: row.delivered_seconds }));
  }

  signPlaybackToken(playbackId: string, ttlSeconds: number): Promise<string> {
    return this.client.jwt.signPlaybackId(playbackId, {
      type: 'video',
      expiration: `${ttlSeconds}s`,
      ...(this.config.muxPlaybackRestrictionId ? {
        params: { playback_restriction_id: this.config.muxPlaybackRestrictionId }
      } : {})
    });
  }

  isNotFoundError(error: unknown): boolean {
    return error instanceof Mux.APIError && error.status === 404;
  }

  isUploadNotCancellableError(error: unknown): boolean {
    return error instanceof Mux.APIError && [400, 404, 409, 422].includes(error.status ?? 0);
  }
}

let singleton: MuxVideoProvider | undefined;

export function getMuxVideoProvider(): MuxVideoProvider {
  if (!singleton) {
    singleton = new OfficialMuxVideoProvider(loadVideoConfig());
  }
  return singleton;
}
