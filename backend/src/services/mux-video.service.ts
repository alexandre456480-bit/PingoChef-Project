import Mux from '@mux/ts';
import type { UnwrapWebhookEvent } from '@mux/ts/resources/webhooks/webhooks';
import type { Upload } from '@mux/ts/resources/video/uploads';
import type { Asset } from '@mux/ts/resources/video/assets';
import { VideoConfig, loadVideoConfig } from '../config/video.config';

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

export interface MuxVideoProvider {
  createDirectUpload(input: CreateDirectUploadInput): Promise<CreatedDirectUpload>;
  verifyAndUnwrapWebhook(rawBody: string, headers: Record<string, unknown>): Promise<UnwrapWebhookEvent>;
  deleteAsset(assetId: string): Promise<void>;
  cancelUpload(uploadId: string): Promise<void>;
  retrieveUpload(uploadId: string): Promise<Upload>;
  retrieveAsset(assetId: string): Promise<Asset>;
  listRecentUploads(limit: number): Promise<ProviderUploadRecord[]>;
  signPlaybackToken(playbackId: string, ttlSeconds: number): Promise<string>;
  isNotFoundError(error: unknown): boolean;
  isUploadNotCancellableError(error: unknown): boolean;
}

export class OfficialMuxVideoProvider implements MuxVideoProvider {
  private readonly client: Mux;

  constructor(private readonly config: VideoConfig) {
    this.client = new Mux({
      tokenId: config.muxTokenId,
      tokenSecret: config.muxTokenSecret,
      webhookSecret: config.muxWebhookSigningSecret,
      jwtSigningKey: config.muxSigningKeyId,
      jwtPrivateKey: config.muxSigningPrivateKey
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

  verifyAndUnwrapWebhook(
    rawBody: string,
    headers: Record<string, unknown>
  ): Promise<UnwrapWebhookEvent> {
    return this.client.webhooks.unwrap(rawBody, headers as any, this.config.muxWebhookSigningSecret);
  }

  async deleteAsset(assetId: string): Promise<void> {
    await this.client.video.assets.delete(assetId);
  }

  async cancelUpload(uploadId: string): Promise<void> {
    await this.client.video.uploads.cancel(uploadId);
  }

  retrieveUpload(uploadId: string): Promise<Upload> {
    return this.client.video.uploads.retrieve(uploadId);
  }

  retrieveAsset(assetId: string): Promise<Asset> {
    return this.client.video.assets.retrieve(assetId);
  }

  async listRecentUploads(limit: number): Promise<ProviderUploadRecord[]> {
    const page = await this.client.video.uploads.list({ limit });
    return page.data.map(upload => {
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

  signPlaybackToken(playbackId: string, ttlSeconds: number): Promise<string> {
    return this.client.jwt.signPlaybackId(playbackId, {
      type: 'video',
      expiration: `${ttlSeconds}s`
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
