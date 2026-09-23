import { createHmac } from 'crypto';
import { ALLOWED_VIDEO_MIME_TYPES, type VideoConfig } from '../config/video.config';
import type {
  OwnerMediaView,
  ProductMediaRecord,
  ProductMediaRepository
} from '../repositories/product-media.repository';
import type { MuxVideoProvider } from './mux-video.service';

export class VideoHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'VideoHttpError';
  }
}

export interface UploadIntentInput {
  businessId: string;
  userId: string;
  menuItemId: string;
  clientIp: string;
  corsOrigin: string;
  declaredFileSizeBytes: number;
  declaredMimeType: string;
}

export interface UploadIntentResult {
  mediaId: string;
  uploadUrl: string;
  expiresAt: string;
  maxFileSizeBytes: number;
  maxDurationSeconds: number;
}

export interface MuxWebhookEventLike {
  id: string;
  type: string;
  data?: {
    id?: string;
    upload_id?: string;
    asset_id?: string;
    duration?: number;
    status?: string;
    playback_ids?: Array<{ id: string; policy?: string }>;
  };
}

const DENIALS: Record<string, { status: number; message: string }> = {
  BUSINESS_NOT_AUTHORIZED: { status: 403, message: 'Estabelecimento não autorizado.' },
  PRODUCT_NOT_FOUND: { status: 404, message: 'Produto não encontrado.' },
  DAILY_UPLOAD_LIMIT_REACHED: { status: 429, message: 'Cota diária de vídeos atingida.' },
  PENDING_UPLOAD_LIMIT_REACHED: { status: 429, message: 'Há uploads demais em processamento.' },
  USER_UPLOAD_RATE_LIMITED: { status: 429, message: 'Muitas tentativas de upload.' },
  BUSINESS_UPLOAD_RATE_LIMITED: { status: 429, message: 'Muitas tentativas de upload.' },
  IP_UPLOAD_RATE_LIMITED: { status: 429, message: 'Muitas tentativas de upload.' },
  INVALID_UPLOAD_METADATA: { status: 400, message: 'Metadados do arquivo inválidos.' }
};

export class ProductVideoService {
  constructor(
    private readonly repository: ProductMediaRepository,
    private readonly mux: MuxVideoProvider,
    private readonly config: VideoConfig
  ) {}

  async createUploadIntent(input: UploadIntentInput): Promise<UploadIntentResult> {
    if (
      !Number.isSafeInteger(input.declaredFileSizeBytes)
      || input.declaredFileSizeBytes < 1
      || input.declaredFileSizeBytes > this.config.maxUploadBytes
    ) {
      throw new VideoHttpError(413, 'VIDEO_FILE_TOO_LARGE', 'O arquivo excede o limite permitido.');
    }
    if (!ALLOWED_VIDEO_MIME_TYPES.includes(input.declaredMimeType as any)) {
      throw new VideoHttpError(400, 'VIDEO_MIME_TYPE_NOT_ALLOWED', 'Tipo de vídeo não permitido.');
    }

    const ipHash = createHmac('sha256', this.config.ipHashSecret)
      .update(input.clientIp || 'unknown')
      .digest('hex');

    const reservation = await this.repository.reserveUpload({
      businessId: input.businessId,
      userId: input.userId,
      menuItemId: input.menuItemId,
      ipHash,
      declaredFileSizeBytes: input.declaredFileSizeBytes,
      declaredMimeType: input.declaredMimeType,
      dailyLimit: this.config.dailyUploadLimit,
      pendingLimit: this.config.maxPendingUploads,
      rateLimit: this.config.uploadRateLimit,
      rateWindowSeconds: this.config.uploadRateWindowSeconds
    });

    if (!reservation.mediaId) {
      const code = reservation.denialCode ?? 'UPLOAD_RESERVATION_DENIED';
      const denial = DENIALS[code] ?? { status: 403, message: 'Upload não autorizado.' };
      throw new VideoHttpError(denial.status, code, denial.message);
    }

    let createdUpload: Awaited<ReturnType<MuxVideoProvider['createDirectUpload']>> | undefined;
    try {
      createdUpload = await this.mux.createDirectUpload({
        corsOrigin: input.corsOrigin,
        timeoutSeconds: this.config.uploadUrlTtlSeconds,
        mediaId: reservation.mediaId,
        testMode: this.config.muxTestMode
      });

      const expiresAt = new Date(Date.now() + createdUpload.timeoutSeconds * 1000).toISOString();
      const attached = await this.repository.attachMuxUpload(
        input.businessId,
        reservation.mediaId,
        createdUpload.id,
        expiresAt
      );

      if (!attached) {
        await this.cancelUploadBestEffort(createdUpload.id);
        await this.repository.failReservation(input.businessId, reservation.mediaId, 'UPLOAD_ATTACH_FAILED');
        throw new VideoHttpError(503, 'UPLOAD_ATTACH_FAILED', 'Não foi possível iniciar o upload.');
      }

      return {
        mediaId: reservation.mediaId,
        uploadUrl: createdUpload.url,
        expiresAt,
        maxFileSizeBytes: this.config.maxUploadBytes,
        maxDurationSeconds: this.config.maxDurationSeconds
      };
    } catch (error) {
      if (error instanceof VideoHttpError) throw error;
      if (createdUpload) await this.cancelUploadBestEffort(createdUpload.id);
      await this.repository.failReservation(input.businessId, reservation.mediaId, 'MUX_UPLOAD_CREATE_FAILED');
      throw new VideoHttpError(503, 'VIDEO_PROVIDER_UNAVAILABLE', 'Serviço de vídeo temporariamente indisponível.');
    }
  }

  async processWebhook(event: MuxWebhookEventLike): Promise<'processed' | 'ignored' | 'duplicate'> {
    if (!event.id || !event.type) {
      throw new VideoHttpError(400, 'INVALID_WEBHOOK_EVENT', 'Evento inválido.');
    }

    const objectId = event.data?.id ?? null;
    const claimed = await this.repository.claimWebhook({
      eventId: event.id,
      eventType: event.type,
      objectId,
      staleAfterSeconds: this.config.webhookClaimStaleSeconds
    });
    if (!claimed) return 'duplicate';

    try {
      const processed = await this.processClaimedWebhook(event);
      await this.repository.finishWebhook(event.id, processed ? 'processed' : 'ignored');
      return processed ? 'processed' : 'ignored';
    } catch (error) {
      try {
        await this.repository.finishWebhook(event.id, 'failed', 'WEBHOOK_PROCESSING_FAILED');
      } catch {
        // Keep the original sanitized failure; the stale-claim mechanism retries it.
      }
      if (error instanceof VideoHttpError) throw error;
      throw new VideoHttpError(503, 'WEBHOOK_PROCESSING_FAILED', 'Falha temporária ao processar o evento.');
    }
  }

  async deleteOwnedMedia(businessId: string, menuItemId: string, mediaId: string): Promise<'deleted' | 'pending' | 'absent'> {
    const existing = await this.repository.findOwned(businessId, menuItemId, mediaId);
    if (!existing) return 'absent';

    const pending = existing.status === 'pending_deletion'
      ? existing
      : await this.repository.markPendingDeletion(existing);

    try {
      await this.deleteProviderResource(pending);
      await this.repository.deleteMedia(pending.id);
      return 'deleted';
    } catch {
      await this.repository.recordDeletionFailure(pending, 'PROVIDER_DELETE_FAILED');
      return 'pending';
    }
  }

  async listOwnedMedia(businessId: string, menuItemId: string): Promise<Array<Record<string, unknown>>> {
    const rows: OwnerMediaView[] = await this.repository.listOwnedForItem(businessId, menuItemId);
    return rows.map(row => ({
      id: row.id,
      mediaType: row.media_type,
      source: row.source,
      position: row.position,
      status: row.status,
      isPublished: row.is_published,
      durationSeconds: row.duration_seconds,
      errorCode: row.last_error_code,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  async reconcile(): Promise<{ inspected: number; repaired: number; pending: number }> {
    const candidates = await this.repository.listReconciliationCandidates(
      this.config.reconciliationBatchSize
    );
    let repaired = 0;
    let pending = 0;

    for (const media of candidates) {
      try {
        if (media.status === 'pending_deletion') {
          await this.deleteProviderResource(media);
          await this.repository.deleteMedia(media.id);
          repaired += 1;
          continue;
        }

        if ((media.status === 'waiting' || media.status === 'uploading') && media.mux_upload_id) {
          const upload = await this.mux.retrieveUpload(media.mux_upload_id);
          if (upload.asset_id) {
            await this.repository.markProcessing(media.id, media.mux_upload_id, upload.asset_id);
          } else if (['errored', 'cancelled', 'timed_out'].includes(upload.status)) {
            await this.repository.markErrored(media.id, 'UPLOAD_EXPIRED');
          } else {
            await this.cancelUploadBestEffort(media.mux_upload_id);
            await this.repository.markErrored(media.id, 'UPLOAD_EXPIRED');
          }
          repaired += 1;
          continue;
        }

        if (media.status === 'processing' && media.mux_asset_id) {
          const asset = await this.mux.retrieveAsset(media.mux_asset_id);
          if (asset.status === 'ready') {
            await this.finalizeReadyAsset(media, asset.id, asset.duration, asset.playback_ids);
            repaired += 1;
          } else if (asset.status === 'errored') {
            await this.repository.markErrored(media.id, 'MUX_ASSET_ERRORED', asset.id);
            repaired += 1;
          } else {
            pending += 1;
          }
          continue;
        }
      } catch {
        pending += 1;
      }
    }

    // Provider-side sweep closes the distributed-transaction gap where Mux
    // created an upload but the database was temporarily unable to store its ID.
    const providerUploads = await this.mux.listRecentUploads(this.config.reconciliationBatchSize);
    for (const upload of providerUploads) {
      if (!upload.mediaId) continue;
      try {
        const alreadyLinked = await this.repository.findByUploadId(upload.id);
        if (alreadyLinked) {
          if (upload.assetId && ['waiting', 'uploading'].includes(alreadyLinked.status)) {
            await this.repository.markProcessing(alreadyLinked.id, upload.id, upload.assetId);
            repaired += 1;
          } else if (
            upload.assetId
            && ['rejected', 'errored', 'pending_deletion'].includes(alreadyLinked.status)
          ) {
            await this.deleteLateAsset(alreadyLinked, upload.assetId);
            repaired += 1;
          }
          continue;
        }

        const reservedMedia = await this.repository.findById(upload.mediaId);
        if (reservedMedia?.status === 'waiting' && !reservedMedia.mux_upload_id) {
          const expiresAt = new Date(Date.now() + upload.timeoutSeconds * 1000).toISOString();
          const attached = await this.repository.attachMuxUpload(
            reservedMedia.business_id,
            reservedMedia.id,
            upload.id,
            expiresAt
          );
          if (attached) {
            if (upload.assetId) {
              await this.repository.markProcessing(reservedMedia.id, upload.id, upload.assetId);
            }
            repaired += 1;
            continue;
          }
        }

        if (upload.assetId) {
          await this.mux.deleteAsset(upload.assetId);
          repaired += 1;
        } else if (upload.status === 'waiting') {
          await this.mux.cancelUpload(upload.id);
          repaired += 1;
        }
      } catch {
        pending += 1;
      }
    }

    return { inspected: candidates.length + providerUploads.length, repaired, pending };
  }

  private async processClaimedWebhook(event: MuxWebhookEventLike): Promise<boolean> {
    const data = event.data ?? {};

    if (event.type === 'video.upload.asset_created') {
      const uploadId = data.id;
      const assetId = data.asset_id;
      if (!uploadId || !assetId) return false;
      const media = await this.repository.findByUploadId(uploadId);
      if (!media) return false;
      if (media.status === 'ready' && media.mux_asset_id === assetId) return true;
      if (['rejected', 'errored', 'pending_deletion'].includes(media.status)) {
        await this.deleteLateAsset(media, assetId);
        return true;
      }
      const updated = await this.repository.markProcessing(media.id, uploadId, assetId);
      if (!updated) {
        throw new VideoHttpError(503, 'MEDIA_STATE_RACE', 'Estado de mídia em atualização.');
      }
      return true;
    }

    if (event.type === 'video.asset.ready') {
      if (!data.id) return false;
      let media = await this.repository.findByAssetId(data.id);
      if (!media && data.upload_id) {
        media = await this.repository.findByUploadId(data.upload_id);
        if (media) {
          media = await this.repository.markProcessing(media.id, data.upload_id, data.id);
        }
      }
      if (!media) return false;
      if (media.status === 'pending_deletion') {
        await this.deleteLateAsset(media, data.id);
        return true;
      }
      if (['rejected', 'errored'].includes(media.status)) {
        await this.deleteLateAsset(media, data.id);
        return true;
      }
      await this.finalizeReadyAsset(media, data.id, data.duration, data.playback_ids);
      return true;
    }

    if (event.type === 'video.asset.errored') {
      if (!data.id) return false;
      let media = await this.repository.findByAssetId(data.id);
      if (!media && data.upload_id) {
        media = await this.repository.findByUploadId(data.upload_id);
      }
      if (!media) return false;
      if (['pending_deletion', 'rejected'].includes(media.status)) return true;
      await this.repository.markErrored(media.id, 'MUX_ASSET_ERRORED', data.id);
      return true;
    }

    if (event.type === 'video.upload.errored') {
      if (!data.id) return false;
      const media = await this.repository.findByUploadId(data.id);
      if (!media) return false;
      if (['ready', 'rejected', 'pending_deletion'].includes(media.status)) return true;
      await this.repository.markErrored(media.id, 'MUX_UPLOAD_ERRORED');
      return true;
    }

    return false;
  }

  private async finalizeReadyAsset(
    media: ProductMediaRecord,
    assetId: string,
    duration: number | undefined,
    playbackIds: Array<{ id: string; policy?: string }> | undefined
  ): Promise<void> {
    if (!Number.isFinite(duration) || (duration as number) < 0) {
      await this.rejectAndDelete(media, assetId, 0, 'INVALID_ASSET_DURATION');
      return;
    }

    if ((duration as number) > this.config.maxDurationSeconds) {
      await this.rejectAndDelete(media, assetId, duration as number, 'DURATION_LIMIT_EXCEEDED');
      return;
    }

    const signedPlaybackId = playbackIds?.find(playback => playback.policy === 'signed')?.id;
    if (!signedPlaybackId) {
      await this.rejectAndDelete(media, assetId, duration as number, 'SIGNED_PLAYBACK_MISSING');
      return;
    }

    await this.repository.markReady(media.id, assetId, duration as number, signedPlaybackId);
  }

  private async rejectAndDelete(
    media: ProductMediaRecord,
    assetId: string,
    duration: number,
    errorCode: string
  ): Promise<void> {
    await this.repository.markRejected(media.id, assetId, duration, errorCode);
    try {
      await this.mux.deleteAsset(assetId);
    } catch (error) {
      if (!this.mux.isNotFoundError(error)) throw error;
    }
    await this.repository.markAssetDeleted(media.id);
  }

  private async deleteLateAsset(media: ProductMediaRecord, assetId: string): Promise<void> {
    try {
      await this.mux.deleteAsset(assetId);
    } catch (error) {
      if (!this.mux.isNotFoundError(error)) throw error;
    }
    await this.repository.markAssetDeleted(media.id);
  }

  private async deleteProviderResource(media: ProductMediaRecord): Promise<void> {
    if (media.mux_asset_id) {
      try {
        await this.mux.deleteAsset(media.mux_asset_id);
      } catch (error) {
        if (!this.mux.isNotFoundError(error)) throw error;
      }
      return;
    }

    if (media.mux_upload_id) {
      let upload;
      try {
        upload = await this.mux.retrieveUpload(media.mux_upload_id);
      } catch (error) {
        if (this.mux.isNotFoundError(error)) return;
        throw error;
      }

      if (upload.asset_id) {
        await this.deleteAssetIdempotently(upload.asset_id);
        return;
      }

      if (['cancelled', 'timed_out', 'errored'].includes(upload.status)) return;

      try {
        await this.mux.cancelUpload(media.mux_upload_id);
      } catch (error) {
        if (this.mux.isNotFoundError(error)) return;
        if (!this.mux.isUploadNotCancellableError(error)) throw error;

        // Cancellation can race asset creation. Re-read before considering the
        // deletion complete so the new asset cannot become orphaned.
        const refreshed = await this.mux.retrieveUpload(media.mux_upload_id);
        if (refreshed.asset_id) {
          await this.deleteAssetIdempotently(refreshed.asset_id);
          return;
        }
        if (!['cancelled', 'timed_out', 'errored'].includes(refreshed.status)) {
          throw error;
        }
      }
    }
  }

  private async deleteAssetIdempotently(assetId: string): Promise<void> {
    try {
      await this.mux.deleteAsset(assetId);
    } catch (error) {
      if (!this.mux.isNotFoundError(error)) throw error;
    }
  }

  private async cancelUploadBestEffort(uploadId: string): Promise<void> {
    try {
      await this.mux.cancelUpload(uploadId);
    } catch {
      // Reconciliation handles provider resources that raced with cancellation.
    }
  }
}
