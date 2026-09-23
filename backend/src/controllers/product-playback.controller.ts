import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { loadVideoPlaybackConfig } from '../config/video.config';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import { SupabasePlaybackRepository } from '../repositories/playback.repository';
import { SupabaseProductMediaRepository } from '../repositories/product-media.repository';
import { getMuxVideoProvider } from '../services/mux-video.service';
import { PlaybackDeniedError, ProductPlaybackService } from '../services/product-playback.service';

const uuid = z.string().uuid();
const slug = z.string().trim().regex(/^[a-z0-9-]+$/);

let playbackService: ProductPlaybackService | undefined;
function service(): ProductPlaybackService {
  playbackService ??= new ProductPlaybackService(
    new SupabasePlaybackRepository(),
    getMuxVideoProvider(),
    loadVideoPlaybackConfig()
  );
  return playbackService;
}

function sendError(res: Response, error: unknown): Response {
  if (error instanceof PlaybackDeniedError) {
    return res.status(error.status).json({
      success: false,
      error: { code: error.code, message: error.message, timestamp: new Date().toISOString() }
    });
  }
  throw error;
}

export async function createPublicPlaybackController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const parsedSlug = slug.parse(req.params.slug);
    const itemId = uuid.parse(req.params.itemId);
    const mediaId = uuid.parse(req.params.mediaId);
    const data = await service().createPublicSession(
      parsedSlug,
      itemId,
      mediaId
    );
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    return res.status(200).json({ success: true, data });
  } catch (error) {
    try { return sendError(res, error); } catch (unknownError) { next(unknownError); }
  }
}

export async function createOwnerPreviewPlaybackController(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    if (!req.businessId) throw new PlaybackDeniedError();
    const itemId = uuid.parse(req.params.itemId);
    const mediaId = uuid.parse(req.params.mediaId);
    const data = await service().createOwnerPreviewSession(
      req.businessId,
      itemId,
      mediaId
    );
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    return res.status(200).json({ success: true, data });
  } catch (error) {
    try { return sendError(res, error); } catch (unknownError) { next(unknownError); }
  }
}

export async function publishReadyMediaController(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    if (!req.businessId) throw new PlaybackDeniedError();
    const publishedCount = await new SupabaseProductMediaRepository()
      .publishReadyForBusiness(req.businessId);
    return res.status(200).json({ success: true, data: { publishedCount } });
  } catch (error) {
    next(error);
  }
}
