import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { ipKeyGenerator } from 'express-rate-limit';
import { supabaseAdmin } from '../config/supabase';
import { loadVideoSecurityConfig, type VideoSecurityConfig } from '../config/video-security.config';
import { VideoConfigurationError } from '../config/video.config';
import { videoAudit } from './video-audit.service';

export class VideoSecurityError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(status === 429 ? 'Muitas solicitações de vídeo. Aguarde um instante.' : 'Vídeo temporariamente indisponível.');
  }
}

export interface VideoRequestIdentity { sessionHash: string; ipHash: string; }
export interface VideoPlaybackAccess { businessId: string; mediaId: string; playbackId: string; }
export interface VideoRateLimiter {
  consume(input: Record<string, unknown>): Promise<{ allowed: boolean; code: string; state: string }>;
}

export class PostgresVideoRateLimiter implements VideoRateLimiter {
  async consume(input: Record<string, unknown>) {
    const { data, error } = await supabaseAdmin.rpc('consume_video_security_budget', input);
    if (error || !data || typeof data.allowed !== 'boolean') throw new VideoSecurityError(503, 'VIDEO_TEMPORARILY_UNAVAILABLE');
    return data as { allowed: boolean; code: string; state: string };
  }
}

function hash(secret: string, value: string): string { return createHmac('sha256', secret).update(value).digest('hex'); }
function secret(): string {
  const key = process.env.VIDEO_IP_HASH_SECRET?.trim();
  if (!key || key.length < 32) throw new VideoConfigurationError('VIDEO_IP_HASH_SECRET is not configured');
  return key;
}

// No fingerprint, PII, authentication or advertising identity. Fixed expiry: never sliding/permanent.
export function videoRequestIdentity(req: Request, res: Response, now = Date.now()): VideoRequestIdentity {
  const key = secret();
  const config = loadVideoSecurityConfig();
  const secure = process.env.NODE_ENV === 'production';
  const name = secure ? '__Host-pingo_video' : 'pingo_video';
  let value = (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`))?.slice(name.length + 1) || '';
  const parts = value.split('.');
  const signature = parts.length === 3 ? hash(key, `video-session:v1:${parts[0]}.${parts[1]}`) : '';
  const valid = /^[a-f0-9]{32}$/.test(parts[0] || '') && /^\d{10}$/.test(parts[1] || '')
    && /^[a-f0-9]{64}$/.test(parts[2] || '') && signature.length === parts[2]?.length
    && timingSafeEqual(Buffer.from(signature), Buffer.from(parts[2]))
    && Number(parts[1]) > now / 1000 && Number(parts[1]) <= now / 1000 + config.sessionTtlSeconds;
  if (!valid) {
    const payload = `${randomBytes(16).toString('hex')}.${Math.floor(now / 1000) + config.sessionTtlSeconds}`;
    value = `${payload}.${hash(key, `video-session:v1:${payload}`)}`;
    res.cookie(name, value, { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: config.sessionTtlSeconds * 1000 });
  }
  // Daily domain separation bounds usefulness of pseudonymous hashes; DB retention is 2 days.
  const epoch = new Date(now).toISOString().slice(0, 10);
  return {
    sessionHash: hash(key, `video-session:${epoch}:${value}`),
    ipHash: hash(key, `video-ip:${epoch}:${ipKeyGenerator(req.ip || req.socket.remoteAddress || 'unknown')}`)
  };
}

export class VideoAbuseService {
  constructor(private readonly limiter: VideoRateLimiter = new PostgresVideoRateLimiter(),
    private readonly config: VideoSecurityConfig = loadVideoSecurityConfig()) {}

  async authorizePlayback(access: VideoPlaybackAccess, identity: VideoRequestIdentity, preview = false): Promise<void> {
    if (this.config.globalKillSwitch) throw new VideoSecurityError(503, 'VIDEO_TEMPORARILY_UNAVAILABLE');
    await this.consume('playback', access.businessId, access.mediaId, identity, preview, null, access.playbackId);
  }

  async authorizeUpload(businessId: string, ownerId: string, identity: VideoRequestIdentity): Promise<void> {
    await this.consume('upload', businessId, null, identity, false, ownerId, null);
  }

  private async consume(endpoint: string, businessId: string, mediaId: string | null, identity: VideoRequestIdentity,
    preview: boolean, ownerId: string | null, playbackId: string | null): Promise<void> {
    const decision = await this.limiter.consume({ p_endpoint: endpoint, p_business_id: businessId, p_media_id: mediaId,
      p_session_hash: identity.sessionHash, p_ip_hash: identity.ipHash, p_preview: preview,
      p_owner_id: ownerId, p_playback_id: playbackId, p_policy: this.config.policy });
    videoAudit(endpoint === 'playback' ? (decision.allowed ? 'video_playback_token_allowed' : 'video_playback_token_blocked')
      : (decision.allowed ? 'video_upload_intent_allowed' : 'video_upload_intent_blocked'),
      { businessId, mediaId: mediaId ?? undefined, code: decision.code });
    if (!decision.allowed) videoAudit('video_abuse_detected', { businessId, mediaId: mediaId ?? undefined, code: decision.code });
    if (!decision.allowed) {
      throw new VideoSecurityError(decision.code === 'RATE_LIMITED' ? 429 : decision.code === 'MEDIA_NOT_AVAILABLE' ? 404 : 503,
        ['RATE_LIMITED', 'MEDIA_NOT_AVAILABLE'].includes(decision.code) ? decision.code : 'VIDEO_TEMPORARILY_UNAVAILABLE');
    }
  }
}
