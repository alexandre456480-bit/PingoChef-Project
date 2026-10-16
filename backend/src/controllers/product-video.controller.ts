import { randomUUID } from 'node:crypto';
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
import { VideoAbuseService, videoRequestIdentity } from '../services/video-abuse.service';
import { supabaseAdmin } from '../config/supabase';
import { internalJobAuthorized } from '../middleware/internal-job-auth';
import { enforceSharedRequest } from '../middleware/shared-rate-limit.middleware';
import { videoAudit } from '../services/video-audit.service';
import { loadVideoSecurityConfig } from '../config/video-security.config';
import { syncMuxDeliveryUsage } from '../services/mux-delivery-usage.service';

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
  res.setHeader('Cache-Control', 'private, no-store');
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
    const idempotencyKey = req.get('idempotency-key');
    if (idempotencyKey) z.string().uuid().parse(idempotencyKey);
    await new VideoAbuseService().authorizeUpload(req.businessId, req.userId, videoRequestIdentity(req, res));
    const result = await getProductVideoService().createUploadIntent({
      businessId: req.businessId,
      userId: req.userId,
      menuItemId: itemParamSchema.parse(routeParam(req.params.itemId)),
      clientIp: ipKeyGenerator(req.ip || req.socket.remoteAddress || 'unknown'),
      corsOrigin: origin,
      declaredFileSizeBytes: body.fileSizeBytes,
      declaredMimeType: body.mimeType,
      aspectRatio: body.aspectRatio,
      replacesMediaId: body.replacesMediaId,
      idempotencyKey
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
  res.setHeader('Cache-Control', 'no-store');
  if (!req.get('mux-signature')) return errorResponse(res, new VideoHttpError(400, 'INVALID_WEBHOOK_SIGNATURE', 'Assinatura do webhook inválida.'));
  try {
    if (!Buffer.isBuffer(req.body)) {
      return errorResponse(res, new VideoHttpError(400, 'INVALID_WEBHOOK_BODY', 'Corpo inválido.'));
    }

    const provider = getMuxVideoProvider();
    let event;
    try {
      event = await provider.verifyAndUnwrapWebhook(req.body.toString('utf8'), req.headers as Record<string, unknown>);
    } catch {
      return errorResponse(res, new VideoHttpError(400, 'INVALID_WEBHOOK_SIGNATURE', 'Assinatura do webhook inválida.'));
    }
    await enforceSharedRequest('video-webhook', 'verified-events', loadVideoSecurityConfig().webhookLimit, 60);
    const outcome = await getProductVideoService().processWebhook(event as MuxWebhookEventLike);
    return res.status(200).json({ success: true, data: { status: outcome } });
  } catch (error) {
    videoAudit('video_mux_webhook_failed', { code: error instanceof VideoHttpError ? error.code : 'WEBHOOK_PROCESSING_FAILED' });
    try { await supabaseAdmin.rpc('record_video_abuse', { p_business: null, p_media: null, p_endpoint: 'webhook', p_code: 'WEBHOOK_FAILURE' }); }
    catch { /* Database outages cannot prevent the required 5xx retry response. */ }
    if (error instanceof VideoHttpError) return errorResponse(res, error);
    return errorResponse(
      res,
      new VideoHttpError(503, 'WEBHOOK_PROCESSING_FAILED', 'Falha temporária ao processar o evento.')
    );
  }
}

export async function reconcileVideosController(req: Request, res: Response): Promise<Response> {
  res.setHeader('Cache-Control', 'no-store');
  const header = req.get('authorization');
  if (!internalJobAuthorized(header, process.env.VIDEO_RECONCILIATION_SECRET)
    && !internalJobAuthorized(header, process.env.CRON_SECRET)) {
    return errorResponse(res, new VideoHttpError(401, 'UNAUTHORIZED', 'Credencial inválida.'));
  }

  try {
    const token = randomUUID();
    const { data: claim, error } = await supabaseAdmin.rpc('claim_video_maintenance', { p_token: token, p_seconds: 240 });
    if (error) throw error;
    if (!claim) return res.status(200).json({ success: true, data: { status: 'leased' } });
    // Retention must run even if Mux is down or the optional delivery job fails.
    const { error: retentionError } = await supabaseAdmin.rpc('maintain_video_security_state');
    if (retentionError) throw retentionError;
    const result = await getProductVideoService().reconcile(claim.uploadPage, claim.assetPage);
    let usage: Awaited<ReturnType<typeof syncMuxDeliveryUsage>> | null = null;
    let usageStatus = 'disabled';
    if (process.env.MUX_USAGE_SYNC_ENABLED === 'true') {
      try { usage = await syncMuxDeliveryUsage(getMuxVideoProvider(), claim.usageDay, claim.usagePage); usageStatus = 'synced'; }
      catch {
        usageStatus = 'unavailable';
        videoAudit('video_provider_usage_failed', { code: 'PROVIDER_USAGE_FAILURE' });
        await supabaseAdmin.rpc('record_video_abuse', { p_business: null, p_media: null, p_endpoint: 'maintenance', p_code: 'PROVIDER_USAGE_FAILURE' });
      }
    }
    const { data: finished, error: finishError } = await supabaseAdmin.rpc('finish_video_maintenance', {
      p_token: token, p_upload_page: result.nextUploadPage, p_asset_page: result.nextAssetPage,
      p_usage_day: usage?.day ?? null, p_usage_page: usage?.page ?? null
    });
    if (finishError || !finished) throw finishError || new Error('VIDEO_LEASE_LOST');
    return res.status(200).json({ success: true, data: { ...result, usageStatus } });
  } catch {
    return errorResponse(
      res,
      new VideoHttpError(503, 'RECONCILIATION_FAILED', 'Conciliação temporariamente indisponível.')
    );
  }
}
