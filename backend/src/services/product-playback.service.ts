import type { VideoPlaybackConfig } from '../config/video.config';
import type { PlaybackRepository } from '../repositories/playback.repository';

export interface PlaybackTokenProvider {
  signPlaybackToken(playbackId: string, ttlSeconds: number): Promise<string>;
}

export interface PlaybackSession {
  playbackId: string;
  playbackToken: string;
  expiresAt: string;
  videoTitle: string;
}

export class PlaybackDeniedError extends Error {
  readonly status = 404;
  readonly code = 'MEDIA_NOT_AVAILABLE';

  constructor() {
    super('Vídeo não encontrado ou indisponível.');
    this.name = 'PlaybackDeniedError';
  }
}

export class ProductPlaybackService {
  constructor(
    private readonly repository: PlaybackRepository,
    private readonly tokenProvider: PlaybackTokenProvider,
    private readonly config: VideoPlaybackConfig,
    private readonly now: () => number = Date.now
  ) {}

  async createPublicSession(slug: string, itemId: string, mediaId: string): Promise<PlaybackSession> {
    const access = await this.repository.findPublicPlayback(slug, itemId, mediaId);
    return this.createSession(access);
  }

  async createOwnerPreviewSession(
    businessId: string,
    itemId: string,
    mediaId: string
  ): Promise<PlaybackSession> {
    const access = await this.repository.findOwnerPlayback(businessId, itemId, mediaId);
    return this.createSession(access);
  }

  private async createSession(
    access: Awaited<ReturnType<PlaybackRepository['findPublicPlayback']>>
  ): Promise<PlaybackSession> {
    if (!access) throw new PlaybackDeniedError();

    const playbackToken = await this.tokenProvider.signPlaybackToken(
      access.playbackId,
      this.config.playbackTokenTtlSeconds
    );

    return {
      playbackId: access.playbackId,
      playbackToken,
      expiresAt: new Date(this.now() + this.config.playbackTokenTtlSeconds * 1000).toISOString(),
      videoTitle: access.itemName
    };
  }
}
