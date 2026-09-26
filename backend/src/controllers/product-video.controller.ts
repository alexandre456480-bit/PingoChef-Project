import { timingSafeEqual } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { ipKeyGenerator } from 'express-rate-limit';
import { z } from 'zod';
import {
  ALLOWED_VIDEO_MIME_TYPES,
  loadVideoConfig,
  resolveAllowedUploadOrigin
} from '../config/video.config';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { SupabaseProductMediaRepository } from '../repositories/product-media.repository';
import { getMuxVideoProvider } from '../services/mux-video.service';
import {
  MuxWebhookEventLike,
  ProductVideoService,
  VideoHttpError
} from '../services/product-video.service';

let singleton: ProductVideoService | undefined;

function getProductVideoService(): ProductVideoService {
  if (!singleton) {
    singleton = new ProductVideoService(
      new SupabaseProductMediaRepository(),
      getMuxVideoProvider(),
      loadVideoConfig()
    );
  }
  return singleton;
}

function errorResponse(res: Response, error: VideoHttpError): Response {
  return res.status(error.status).json({
    success: false,
    error: {
      code: error.code,
      message: error.message,
      timestamp: new Date().toISOString()
    }
  });
}

function routeParam(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

const uploadIntentSchema = z.object({
  fileSizeBytes: z.number().int().positive(),
  mimeType: z.enum(ALLOWED_VIDEO_MIME_TYPES),
  aspectRatio: z.enum(['16:9', '9:16']),
  replacesMediaId: z.string().uuid().nullable().optional().default(null)
}).strict();

const itemParamSchema = z.string().uuid();
const mediaParamSchema = z.string().uuid();

export async function createVideoUploadIntentController(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    if (!req.userId || !req.businessId) {
      return errorResponse(res, new VideoHttpError(401, 'UNAUTHORIZED', 'Sessão inválida.'));
    }

    const config = loadVideoConfig();
    const body = uploadIntentSchema.parse(req.body);
    if (body.fileSizeBytes > config.maxUploadBytes) {
      return errorResponse(
        res,
        new VideoHttpError(413, 'VIDEO_FILE_TOO_LARGE', 'O arquivo excede o limite de 50 MB.')
      );
    }

    const origin = resolveAllowedUploadOrigin(req.get('origin'), config);
    const result = await getProductVideoService().createUploadIntent({
      businessId: req.businessId,
      userId: req.userId,
      menuItemId: itemParamSchema.parse(routeParam(req.params.itemId)),
      clientIp: ipKeyGenerator(req.ip || req.socket.remoteAddress || 'unknown'),
      corsOrigin: origin,
      declaredFileSizeBytes: body.fileSizeBytes,
      declaredMimeType: body.mimeType,
      aspectRatio: body.aspectRatio,
      replacesMediaId: body.replacesMediaId
    });

    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    if (error instanceof VideoHttpError) return errorResponse(res, error);
    next(error);
  }
}

export async function deleteProductVideoController(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    if (!req.businessId) {
      return errorResponse(res, new VideoHttpError(401, 'UNAUTHORIZED', 'Sessão inválida.'));
    }

    const outcome = await getProductVideoService().deleteOwnedMedia(
      req.businessId,
      itemParamSchema.parse(routeParam(req.params.itemId)),
      mediaParamSchema.parse(routeParam(req.params.mediaId))
    );

    if (outcome === 'pending') {
      return res.status(202).json({
        success: true,
        data: { status: 'pending_deletion' }
      });
    }

    return res.status(204).send();
  } catch (error) {
    if (error instanceof VideoHttpError) return errorResponse(res, error);
    next(error);
  }
}

export async function listProductMediaController(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    if (!req.businessId) {
      return errorResponse(res, new VideoHttpError(401, 'UNAUTHORIZED', 'Sessão inválida.'));
    }
    const itemId = itemParamSchema.parse(routeParam(req.params.itemId));
    const media = await getProductVideoService().listOwnedMedia(req.businessId, itemId);
    return res.status(200).json({ success: true, data: media });
  } catch (error) {
    if (error instanceof VideoHttpError) return errorResponse(res, error);
    next(error);
  }
}

export async function muxWebhookController(
  req: Request,
  res: Response
): Promise<Response> {
  try {
    if (!Buffer.isBuffer(req.body)) {
      return errorResponse(res, new VideoHttpError(400, 'INVALID_WEBHOOK_BODY', 'Corpo inválido.'));
    }

    const provider = getMuxVideoProvider();
    const event = await provider.verifyAndUnwrapWebhook(
      req.body.toString('utf8'),
      req.headers as Record<string, unknown>
    );
    const outcome = await getProductVideoService().processWebhook(event as MuxWebhookEventLike);
    return res.status(200).json({ success: true, data: { status: outcome } });
  } catch (error) {
    if (error instanceof VideoHttpError) return errorResponse(res, error);
    return errorResponse(
      res,
      new VideoHttpError(400, 'INVALID_WEBHOOK_SIGNATURE', 'Assinatura do webhook inválida.')
    );
  }
}

export async function reconcileVideosController(req: Request, res: Response): Promise<Response> {
  const configuredSecret = loadVideoConfig().reconciliationSecret;
  const supplied = req.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const expectedBuffer = Buffer.from(configuredSecret);
  const suppliedBuffer = Buffer.from(supplied);

  if (
    expectedBuffer.length !== suppliedBuffer.length
    || !timingSafeEqual(expectedBuffer, suppliedBuffer)
  ) {
    return errorResponse(res, new VideoHttpError(401, 'UNAUTHORIZED', 'Credencial inválida.'));
  }

  try {
    const result = await getProductVideoService().reconcile();
    return res.status(200).json({ success: true, data: result });
  } catch {
    return errorResponse(
      res,
      new VideoHttpError(503, 'RECONCILIATION_FAILED', 'Conciliação temporariamente indisponível.')
    );
  }
}
