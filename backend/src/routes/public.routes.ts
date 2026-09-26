import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getPublicMenuController, likeItemController } from '../controllers/public.controller';
import { createPublicPlaybackController } from '../controllers/product-playback.controller';

const router = Router();

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
      path: req.path
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
      path: req.path
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
router.post('/menu/:slug/like/:itemId', likeLimiter, likeItemController as any);
router.post(
  '/menus/:slug/items/:itemId/media/:mediaId/playback',
  playbackLimiter,
  createPublicPlaybackController as any
);

export default router;
