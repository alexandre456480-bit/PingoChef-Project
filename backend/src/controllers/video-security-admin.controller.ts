import type { Response, NextFunction } from 'express';
import { z } from 'zod';
import { supabaseAdmin, createAuditedAdminClient } from '../config/supabase';
import type { AdminRequest } from '../middleware/admin.middleware';
import { loadVideoSecurityConfig } from '../config/video-security.config';

export async function getVideoSecurityReport(req: AdminRequest, res: Response, next: NextFunction) {
  try {
    const days = z.coerce.number().refine(n => [1, 7, 30].includes(n)).default(1).parse(req.query.days);
    const page = z.coerce.number().int().min(1).max(10000).default(1).parse(req.query.page);
    const { data, error } = await supabaseAdmin.rpc('admin_video_security_report', { p_days: days, p_page: page });
    if (error) throw error;
    return res.json({ success: true, data: { ...data, environmentKillSwitch: loadVideoSecurityConfig().globalKillSwitch } });
  } catch (error) { next(error); }
}

export async function setVideoSecurityState(req: AdminRequest, res: Response, next: NextFunction) {
  try {
    const body = z.object({ businessId: z.string().uuid().nullable(), state: z.enum(['NORMAL', 'SOFT_ALERT', 'HARD_BLOCK']),
      seconds: z.number().int().min(60).max(86400), reason: z.string().trim().min(3).max(500) }).strict().parse(req.body);
    const { error } = await createAuditedAdminClient(req, res).rpc('admin_set_video_security_state', {
      p_actor: req.adminUserId!, p_business_id: body.businessId, p_state: body.state, p_seconds: body.seconds, p_reason: body.reason
    });
    if (error) throw error;
    return res.json({ success: true });
  } catch (error) { next(error); }
}
