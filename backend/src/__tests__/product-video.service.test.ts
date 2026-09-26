import type { VideoConfig } from '../config/video.config';
import type {
  ProductMediaRecord,
  ProductMediaRepository
} from '../repositories/product-media.repository';
import type { MuxVideoProvider } from '../services/mux-video.service';
import { ProductVideoService } from '../services/product-video.service';

const config: VideoConfig = {
  muxTokenId: 'token-id',
  muxTokenSecret: 'token-secret',
  muxWebhookSigningSecret: 'webhook-secret',
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

function media(overrides: Partial<ProductMediaRecord> = {}): ProductMediaRecord {
  return {
    id: 'media-1',
    business_id: 'business-1',
    menu_item_id: 'item-1',
    status: 'processing',
    is_published: false,
    mux_upload_id: 'upload-1',
    mux_asset_id: 'asset-1',
    mux_playback_id: null,
    duration_seconds: null,
    aspect_ratio: '16:9',
    replaces_media_id: null,
    upload_expires_at: null,
    deletion_attempts: 0,
    updated_at: new Date().toISOString(),
    ...overrides
  };
}

function repositoryMock(): jest.Mocked<ProductMediaRepository> {
  return {
    reserveUpload: jest.fn(),
    attachMuxUpload: jest.fn(),
    failReservation: jest.fn(),
    claimWebhook: jest.fn(),
    finishWebhook: jest.fn(),
    findByUploadId: jest.fn(),
    findByAssetId: jest.fn(),
    findById: jest.fn(),
    findOwned: jest.fn(),
    listOwnedForItem: jest.fn(),
    listGalleryMedia: jest.fn(),
    publishReadyForBusiness: jest.fn(),
    markProcessing: jest.fn(),
    markReady: jest.fn().mockResolvedValue([]),
    markRejected: jest.fn(),
    markErrored: jest.fn(),
    markAssetDeleted: jest.fn(),
    markPendingDeletion: jest.fn(),
    recordDeletionFailure: jest.fn(),
    deleteMedia: jest.fn(),
    listReconciliationCandidates: jest.fn()
  };
}

function providerMock(): jest.Mocked<MuxVideoProvider> {
  return {
    createDirectUpload: jest.fn(),
    verifyAndUnwrapWebhook: jest.fn(),
    deleteAsset: jest.fn(),
    cancelUpload: jest.fn(),
    retrieveUpload: jest.fn(),
    retrieveAsset: jest.fn(),
    listRecentUploads: jest.fn().mockResolvedValue([]),
    signPlaybackToken: jest.fn(),
    isNotFoundError: jest.fn().mockReturnValue(false),
    isUploadNotCancellableError: jest.fn().mockReturnValue(false)
  };
}

describe('ProductVideoService security boundaries', () => {
  it('projects owner status without exposing Mux administrative identifiers', async () => {
    const repository = repositoryMock();
    const provider = providerMock();
    repository.listOwnedForItem.mockResolvedValue([{
      id: 'media-1',
      media_type: 'video',
      source: 'mux',
      position: 0,
      status: 'processing',
      is_published: false,
      duration_seconds: null,
      aspect_ratio: '9:16',
      last_error_code: null,
      created_at: '2026-09-23T10:00:00.000Z',
      updated_at: '2026-09-23T10:01:00.000Z'
    }]);
    const service = new ProductVideoService(repository, provider, config);

    const result = await service.listOwnedMedia('business-1', 'item-1');

    expect(repository.listOwnedForItem).toHaveBeenCalledWith('business-1', 'item-1');
    expect(result[0]).toEqual(expect.objectContaining({
      id: 'media-1',
      status: 'processing'
    }));
    expect(JSON.stringify(result)).not.toMatch(/mux_(upload|asset|playback)_id/i);
  });

  it('rejects a declared file above 50 MB before reserving anything', async () => {
    const repository = repositoryMock();
    const provider = providerMock();
    const service = new ProductVideoService(repository, provider, config);

    await expect(service.createUploadIntent({
      businessId: 'business-1',
      userId: 'user-1',
      menuItemId: 'item-1',
      clientIp: '203.0.113.10',
      corsOrigin: 'https://app.example.com',
      declaredFileSizeBytes: 50 * 1024 * 1024 + 1,
      declaredMimeType: 'video/mp4',
      aspectRatio: '16:9',
      replacesMediaId: null
    })).rejects.toMatchObject({ status: 413, code: 'VIDEO_FILE_TOO_LARGE' });

    expect(repository.reserveUpload).not.toHaveBeenCalled();
    expect(provider.createDirectUpload).not.toHaveBeenCalled();
  });

  it('creates a signed Direct Upload only after an atomic reservation', async () => {
    const repository = repositoryMock();
    const provider = providerMock();
    repository.reserveUpload.mockResolvedValue({ mediaId: 'media-1', denialCode: null });
    repository.attachMuxUpload.mockResolvedValue(true);
    provider.createDirectUpload.mockResolvedValue({
      id: 'upload-1',
      url: 'https://storage.example.test/direct-upload',
      timeoutSeconds: 900
    });
    const service = new ProductVideoService(repository, provider, config);

    const result = await service.createUploadIntent({
      businessId: 'business-1',
      userId: 'user-1',
      menuItemId: 'item-1',
      clientIp: '203.0.113.10',
      corsOrigin: 'https://app.example.com',
      declaredFileSizeBytes: 1024,
      declaredMimeType: 'video/mp4',
      aspectRatio: '9:16',
      replacesMediaId: 'media-old'
    });

    expect(repository.reserveUpload.mock.invocationCallOrder[0])
      .toBeLessThan(provider.createDirectUpload.mock.invocationCallOrder[0]);
    expect(provider.createDirectUpload).toHaveBeenCalledWith(expect.objectContaining({
      corsOrigin: 'https://app.example.com',
      timeoutSeconds: 900,
      mediaId: 'media-1'
    }));
    expect(repository.attachMuxUpload).toHaveBeenCalledWith(
      'business-1',
      'media-1',
      'upload-1',
      expect.any(String)
    );
    expect(result).toEqual(expect.objectContaining({
      mediaId: 'media-1',
      maxFileSizeBytes: 52428800,
      maxDurationSeconds: 15
    }));
    expect(result).not.toHaveProperty('muxUploadId');
  });

  it('cancels the provider upload when its database link cannot be persisted', async () => {
    const repository = repositoryMock();
    const provider = providerMock();
    repository.reserveUpload.mockResolvedValue({ mediaId: 'media-1', denialCode: null });
    repository.attachMuxUpload.mockResolvedValue(false);
    provider.createDirectUpload.mockResolvedValue({
      id: 'upload-orphan',
      url: 'https://storage.example.test/direct-upload',
      timeoutSeconds: 900
    });
    const service = new ProductVideoService(repository, provider, config);

    await expect(service.createUploadIntent({
      businessId: 'business-1',
      userId: 'user-1',
      menuItemId: 'item-1',
      clientIp: '203.0.113.10',
      corsOrigin: 'https://app.example.com',
      declaredFileSizeBytes: 1024,
      declaredMimeType: 'video/mp4',
      aspectRatio: '16:9',
      replacesMediaId: null
    })).rejects.toMatchObject({ code: 'UPLOAD_ATTACH_FAILED' });

    expect(provider.cancelUpload).toHaveBeenCalledWith('upload-orphan');
    expect(repository.failReservation).toHaveBeenCalledWith(
      'business-1',
      'media-1',
      'UPLOAD_ATTACH_FAILED'
    );
  });

  it('maps an atomic quota denial without calling Mux', async () => {
    const repository = repositoryMock();
    const provider = providerMock();
    repository.reserveUpload.mockResolvedValue({
      mediaId: null,
      denialCode: 'DAILY_UPLOAD_LIMIT_REACHED'
    });
    const service = new ProductVideoService(repository, provider, config);

    await expect(service.createUploadIntent({
      businessId: 'business-1',
      userId: 'user-1',
      menuItemId: 'item-1',
      clientIp: '203.0.113.10',
      corsOrigin: 'https://app.example.com',
      declaredFileSizeBytes: 1024,
      declaredMimeType: 'video/mp4',
      aspectRatio: '16:9',
      replacesMediaId: null
    })).rejects.toMatchObject({ status: 429, code: 'DAILY_UPLOAD_LIMIT_REACHED' });

    expect(provider.createDirectUpload).not.toHaveBeenCalled();
  });

  it('accepts exactly 15 seconds and requires a signed playback id', async () => {
    const repository = repositoryMock();
    const provider = providerMock();
    repository.claimWebhook.mockResolvedValue(true);
    repository.findByAssetId.mockResolvedValue(media());
    const service = new ProductVideoService(repository, provider, config);

    await expect(service.processWebhook({
      id: 'event-ready',
      type: 'video.asset.ready',
      data: {
        id: 'asset-1',
        duration: 15,
        playback_ids: [{ id: 'playback-signed', policy: 'signed' }]
      }
    })).resolves.toBe('processed');

    expect(repository.markReady).toHaveBeenCalledWith(
      'media-1',
      'asset-1',
      15,
      'playback-signed'
    );
    expect(repository.finishWebhook).toHaveBeenCalledWith('event-ready', 'processed');
    expect(provider.deleteAsset).not.toHaveBeenCalled();
  });

  it('removes the replaced provider asset after the atomic ready transition', async () => {
    const repository = repositoryMock();
    const provider = providerMock();
    repository.claimWebhook.mockResolvedValue(true);
    repository.findByAssetId.mockResolvedValue(media({ id: 'media-new' }));
    repository.markReady.mockResolvedValue(['media-old']);
    repository.findById.mockResolvedValue(media({
      id: 'media-old',
      status: 'pending_deletion',
      mux_asset_id: 'asset-old'
    }));
    const service = new ProductVideoService(repository, provider, config);

    await service.processWebhook({
      id: 'event-replacement-ready',
      type: 'video.asset.ready',
      data: {
        id: 'asset-new',
        duration: 10,
        playback_ids: [{ id: 'playback-new', policy: 'signed' }]
      }
    });

    expect(provider.deleteAsset).toHaveBeenCalledWith('asset-old');
    expect(repository.deleteMedia).toHaveBeenCalledWith('media-old');
    expect(provider.deleteAsset.mock.invocationCallOrder[0])
      .toBeLessThan(repository.deleteMedia.mock.invocationCallOrder[0]);
  });

  it('rejects and deletes an asset when the real provider duration exceeds 15 seconds', async () => {
    const repository = repositoryMock();
    const provider = providerMock();
    repository.claimWebhook.mockResolvedValue(true);
    repository.findByAssetId.mockResolvedValue(media());
    const service = new ProductVideoService(repository, provider, config);

    await service.processWebhook({
      id: 'event-too-long',
      type: 'video.asset.ready',
      data: {
        id: 'asset-1',
        duration: 15.001,
        playback_ids: [{ id: 'playback-signed', policy: 'signed' }]
      }
    });

    expect(repository.markRejected).toHaveBeenCalledWith(
      'media-1',
      'asset-1',
      15.001,
      'DURATION_LIMIT_EXCEEDED'
    );
    expect(provider.deleteAsset).toHaveBeenCalledWith('asset-1');
    expect(repository.markAssetDeleted).toHaveBeenCalledWith('media-1');
    expect(repository.markReady).not.toHaveBeenCalled();
  });

  it('does not process a duplicate webhook event twice', async () => {
    const repository = repositoryMock();
    const provider = providerMock();
    repository.claimWebhook.mockResolvedValue(false);
    const service = new ProductVideoService(repository, provider, config);

    await expect(service.processWebhook({
      id: 'event-duplicate',
      type: 'video.asset.ready',
      data: { id: 'asset-1' }
    })).resolves.toBe('duplicate');

    expect(repository.findByAssetId).not.toHaveBeenCalled();
    expect(repository.finishWebhook).not.toHaveBeenCalled();
  });

  it('moves an errored Mux asset to the local errored state', async () => {
    const repository = repositoryMock();
    const provider = providerMock();
    repository.claimWebhook.mockResolvedValue(true);
    repository.findByAssetId.mockResolvedValue(media());
    const service = new ProductVideoService(repository, provider, config);

    await expect(service.processWebhook({
      id: 'event-errored',
      type: 'video.asset.errored',
      data: { id: 'asset-1' }
    })).resolves.toBe('processed');

    expect(repository.markErrored).toHaveBeenCalledWith(
      'media-1',
      'MUX_ASSET_ERRORED',
      'asset-1'
    );
  });

  it('cannot delete a media row that is outside the authenticated tenant and item', async () => {
    const repository = repositoryMock();
    const provider = providerMock();
    repository.findOwned.mockResolvedValue(null);
    const service = new ProductVideoService(repository, provider, config);

    await expect(service.deleteOwnedMedia('business-a', 'item-b', 'media-b'))
      .resolves.toBe('absent');

    expect(repository.findOwned).toHaveBeenCalledWith('business-a', 'item-b', 'media-b');
    expect(repository.markPendingDeletion).not.toHaveBeenCalled();
    expect(provider.deleteAsset).not.toHaveBeenCalled();
  });

  it('keeps the database reference pending when provider deletion is unavailable', async () => {
    const repository = repositoryMock();
    const provider = providerMock();
    const existing = media({ status: 'ready' });
    const pending = media({ status: 'pending_deletion' });
    repository.findOwned.mockResolvedValue(existing);
    repository.markPendingDeletion.mockResolvedValue(pending);
    provider.deleteAsset.mockRejectedValue(new Error('provider offline'));
    const service = new ProductVideoService(repository, provider, config);

    await expect(service.deleteOwnedMedia('business-1', 'item-1', 'media-1'))
      .resolves.toBe('pending');

    expect(repository.markPendingDeletion).toHaveBeenCalledWith(existing);
    expect(repository.recordDeletionFailure).toHaveBeenCalledWith(
      pending,
      'PROVIDER_DELETE_FAILED'
    );
    expect(repository.deleteMedia).not.toHaveBeenCalled();
  });

  it('treats an already absent provider asset as an idempotent deletion success', async () => {
    const repository = repositoryMock();
    const provider = providerMock();
    const existing = media({ status: 'pending_deletion' });
    const notFound = new Error('not found');
    repository.findOwned.mockResolvedValue(existing);
    provider.deleteAsset.mockRejectedValue(notFound);
    provider.isNotFoundError.mockImplementation(error => error === notFound);
    const service = new ProductVideoService(repository, provider, config);

    await expect(service.deleteOwnedMedia('business-1', 'item-1', 'media-1'))
      .resolves.toBe('deleted');

    expect(repository.deleteMedia).toHaveBeenCalledWith('media-1');
  });

  it('recovers a provider upload whose database link was lost', async () => {
    const repository = repositoryMock();
    const provider = providerMock();
    repository.listReconciliationCandidates.mockResolvedValue([]);
    repository.findByUploadId.mockResolvedValue(null);
    repository.findById.mockResolvedValue(media({
      status: 'waiting',
      mux_upload_id: null,
      mux_asset_id: null
    }));
    repository.attachMuxUpload.mockResolvedValue(true);
    provider.listRecentUploads.mockResolvedValue([{
      id: 'lost-upload',
      status: 'asset_created',
      assetId: 'lost-asset',
      mediaId: 'media-1',
      timeoutSeconds: 900
    }]);
    const service = new ProductVideoService(repository, provider, config);

    await expect(service.reconcile()).resolves.toEqual({
      inspected: 1,
      repaired: 1,
      pending: 0
    });

    expect(repository.attachMuxUpload).toHaveBeenCalledWith(
      'business-1',
      'media-1',
      'lost-upload',
      expect.any(String)
    );
    expect(repository.markProcessing).toHaveBeenCalledWith(
      'media-1',
      'lost-upload',
      'lost-asset'
    );
  });

  it('retries pending provider deletion before removing the local reference', async () => {
    const repository = repositoryMock();
    const provider = providerMock();
    repository.listReconciliationCandidates.mockResolvedValue([
      media({ status: 'pending_deletion', mux_asset_id: 'asset-delete' })
    ]);
    const service = new ProductVideoService(repository, provider, config);

    await expect(service.reconcile()).resolves.toEqual({ inspected: 1, repaired: 1, pending: 0 });
    expect(provider.deleteAsset).toHaveBeenCalledWith('asset-delete');
    expect(repository.deleteMedia).toHaveBeenCalledWith('media-1');
    expect(repository.deleteMedia.mock.invocationCallOrder[0])
      .toBeGreaterThan(provider.deleteAsset.mock.invocationCallOrder[0]);
  });

  it('deletes an orphan Mux asset discovered by the provider sweep', async () => {
    const repository = repositoryMock();
    const provider = providerMock();
    repository.listReconciliationCandidates.mockResolvedValue([]);
    repository.findByUploadId.mockResolvedValue(null);
    repository.findById.mockResolvedValue(null);
    provider.listRecentUploads.mockResolvedValue([{
      id: 'orphan-upload',
      status: 'asset_created',
      assetId: 'orphan-asset',
      mediaId: 'missing-media',
      timeoutSeconds: 900
    }]);
    const service = new ProductVideoService(repository, provider, config);

    await expect(service.reconcile()).resolves.toEqual({ inspected: 1, repaired: 1, pending: 0 });
    expect(provider.deleteAsset).toHaveBeenCalledWith('orphan-asset');
  });

  it('cancels an abandoned provider upload that never produced an asset', async () => {
    const repository = repositoryMock();
    const provider = providerMock();
    repository.listReconciliationCandidates.mockResolvedValue([]);
    repository.findByUploadId.mockResolvedValue(null);
    repository.findById.mockResolvedValue(null);
    provider.listRecentUploads.mockResolvedValue([{
      id: 'abandoned-upload',
      status: 'waiting',
      assetId: null,
      mediaId: 'missing-media',
      timeoutSeconds: 900
    }]);
    const service = new ProductVideoService(repository, provider, config);

    await expect(service.reconcile()).resolves.toEqual({ inspected: 1, repaired: 1, pending: 0 });
    expect(provider.cancelUpload).toHaveBeenCalledWith('abandoned-upload');
  });
});
