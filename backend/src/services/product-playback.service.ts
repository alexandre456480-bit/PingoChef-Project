import type { VideoPlaybackConfig } from '../config/video.config';
import type { PlaybackRepository } from '../repositories/playback.repository';
import { VideoAbuseService, VideoSecurityError, type VideoRequestIdentity } from './video-abuse.service';

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
    private readonly now: () => number = Date.now,
    private readonly abuse: Pick<VideoAbuseService, 'authorizePlayback'> = new VideoAbuseService()
  ) {}

  async createPublicSession(slug: string, itemId: string, mediaId: string, identity: VideoRequestIdentity): Promise<PlaybackSession> {
    const access = await this.repository.findPublicPlayback(slug, itemId, mediaId);
    return this.createSession(access, identity, false);
  }

  async createOwnerPreviewSession(
    businessId: string,
    itemId: string,
    mediaId: string,
    identity: VideoRequestIdentity
  ): Promise<PlaybackSession> {
    const access = await this.repository.findOwnerPlayback(businessId, itemId, mediaId);
    return this.createSession(access, identity, true);
  }

  private async createSession(
    access: Awaited<ReturnType<PlaybackRepository['findPublicPlayback']>>,
    identity: VideoRequestIdentity,
    preview: boolean
  ): Promise<PlaybackSession> {
    if (!access) throw new PlaybackDeniedError();
    await this.abuse.authorizePlayback(access, identity, preview);

    let playbackToken: string;
    try {
      playbackToken = await this.tokenProvider.signPlaybackToken(access.playbackId, this.config.playbackTokenTtlSeconds);
    } catch { throw new VideoSecurityError(503, 'VIDEO_TEMPORARILY_UNAVAILABLE'); }

    return {
      playbackId: access.playbackId,
      playbackToken,
      expiresAt: new Date(this.now() + this.config.playbackTokenTtlSeconds * 1000).toISOString(),
      videoTitle: access.itemName
    };
  }
}
