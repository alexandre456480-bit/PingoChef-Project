import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getPublicMenuController, likeItemController } from '../controllers/public.controller';
import { createPublicPlaybackController } from '../controllers/product-playback.controller';
import { apiRouteGroup } from '../middleware/api-telemetry.middleware';
import { collectMenuAnalytics } from '../controllers/menu-analytics.controller';
import { qrService } from '../services/qr.service';
import { z } from 'zod';
import { ownerError } from '../services/owner-session.service';

const router = Router();
router.get('/qr/:identifier', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  void (async () => {
    if (Object.keys(req.query).length) throw ownerError(400, 'INVALID_QR_QUERY');
    const identifier = z.string().uuid().parse(req.params.identifier);
    return res.json({ success: true, data: await qrService.resolve(identifier) });
  })().catch(next);
});

function boundedEnvInteger(name: string, fallback: number, min: number, max: number): number {
  const parsed = Number(process.env[name] ?? fallback);
  return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

const playbackLimiter = rateLimit({
  windowMs: boundedEnvInteger('VIDEO_PLAYBACK_RATE_WINDOW_SECONDS', 60, 10, 3600) * 1000,
  limit: boundedEnvInteger('VIDEO_PLAYBACK_RATE_LIMIT', 20, 1, 300),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn('[Security Audit]', {
      event: 'playback_rate_limit_exceeded',
      requestId: res.locals?.requestId,
      method: req.method,
      routeGroup: apiRouteGroup(req.originalUrl)
    });
    return res.status(429).json({
      success: false,
      error: {
        code: 'PLAYBACK_RATE_LIMITED',
        message: 'Muitas solicitações de vídeo. Aguarde um instante.',
        timestamp: new Date().toISOString()
      }
    });
  }
});

const likeLimiter = rateLimit({
  windowMs: boundedEnvInteger('LIKE_RATE_WINDOW_SECONDS', 60, 10, 3600) * 1000,
  limit: boundedEnvInteger('LIKE_RATE_LIMIT', 20, 1, 300),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn('[Security Audit]', {
      event: 'like_rate_limit_exceeded',
      requestId: res.locals?.requestId,
      method: req.method,
      routeGroup: apiRouteGroup(req.originalUrl)
    });
    return res.status(429).json({
      success: false,
      error: {
        code: 'LIKE_RATE_LIMITED',
        message: 'Muitas tentativas de curtida. Aguarde um instante.',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Endpoints abertos sem autenticação para o cardápio público do cliente final
router.get('/menu/:slug', getPublicMenuController as any);
router.post('/menu/:slug/events', rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false }), collectMenuAnalytics);
router.post('/menu/:slug/like/:itemId', likeLimiter, likeItemController as any);
router.post(
  '/menus/:slug/items/:itemId/media/:mediaId/playback',
  playbackLimiter,
  createPublicPlaybackController as any
);

export default router;
