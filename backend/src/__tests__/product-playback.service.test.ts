import type { VideoPlaybackConfig } from '../config/video.config';
import type { PlaybackRepository } from '../repositories/playback.repository';
import type { PlaybackTokenProvider } from '../services/product-playback.service';
import { ProductPlaybackService } from '../services/product-playback.service';

const config: VideoPlaybackConfig = {
  muxSigningKeyId: 'key-id',
  muxSigningPrivateKey: 'private-key',
  playbackTokenTtlSeconds: 120,
  playbackRateLimit: 20,
  playbackRateWindowSeconds: 60
};

function repository(): jest.Mocked<PlaybackRepository> {
  return {
    findPublicPlayback: jest.fn(),
    findOwnerPlayback: jest.fn()
  };
}

function signer(): jest.Mocked<PlaybackTokenProvider> {
  return { signPlaybackToken: jest.fn() };
}

describe('ProductPlaybackService security boundary', () => {
  it('denies unpublished or cross-tenant public media without signing anything', async () => {
    const repo = repository();
    const tokenProvider = signer();
    repo.findPublicPlayback.mockResolvedValue(null);
    const service = new ProductPlaybackService(repo, tokenProvider, config);

    await expect(service.createPublicSession('tenant-a', 'item-b', 'media-b'))
      .rejects.toMatchObject({ status: 404, code: 'MEDIA_NOT_AVAILABLE' });
    expect(tokenProvider.signPlaybackToken).not.toHaveBeenCalled();
  });

  it('uses a short signed token and exposes no asset or upload identifier', async () => {
    const repo = repository();
    const tokenProvider = signer();
    repo.findPublicPlayback.mockResolvedValue({
      playbackId: 'signed-playback-id',
      itemName: 'Produto seguro'
    });
    tokenProvider.signPlaybackToken.mockResolvedValue('signed-jwt');
    const now = Date.parse('2026-09-23T12:00:00.000Z');
    const service = new ProductPlaybackService(repo, tokenProvider, config, () => now);

    const result = await service.createPublicSession('tenant-a', 'item-a', 'media-a');

    expect(tokenProvider.signPlaybackToken).toHaveBeenCalledWith('signed-playback-id', 120);
    expect(result).toEqual({
      playbackId: 'signed-playback-id',
      playbackToken: 'signed-jwt',
      expiresAt: '2026-09-23T12:02:00.000Z',
      videoTitle: 'Produto seguro'
    });
    expect(JSON.stringify(result)).not.toMatch(/asset|upload/i);
  });

  it('allows an owner preview for ready draft media through the authenticated path', async () => {
    const repo = repository();
    const tokenProvider = signer();
    repo.findOwnerPlayback.mockResolvedValue({ playbackId: 'draft-playback', itemName: 'Rascunho' });
    tokenProvider.signPlaybackToken.mockResolvedValue('preview-jwt');
    const service = new ProductPlaybackService(repo, tokenProvider, config);

    await expect(service.createOwnerPreviewSession('business-a', 'item-a', 'media-a'))
      .resolves.toEqual(expect.objectContaining({ playbackToken: 'preview-jwt' }));
    expect(repo.findOwnerPlayback).toHaveBeenCalledWith('business-a', 'item-a', 'media-a');
  });
});
