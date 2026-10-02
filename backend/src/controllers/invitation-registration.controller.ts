import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { createHmac } from 'node:crypto';
import { supabaseAdmin, isSupabaseConfigured } from '../config/supabase';
import { isDemoMode } from '../config/localDb';

const registerSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
  fullName: z.string().trim().min(2).max(120),
  businessName: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(3).max(50).regex(/^[a-z0-9-]+$/),
  phone: z.string().trim().max(30).optional(),
  invitationCode: z.string().trim().min(30).max(80)
}).strict();

export function hashInvitationCode(code: string): string {
  const secret = process.env.INVITATION_HASH_SECRET?.trim();
  if (!secret || secret.length < 32) {
    const error = new Error('Configuração de convites indisponível.');
    Object.assign(error, { status: 503, code: 'INVITATION_CONFIGURATION_ERROR' });
    throw error;
  }
  return createHmac('sha256', secret).update(code.trim()).digest('hex');
}

const registrationError = (res: Response, status: number, code: string, message: string) =>
  res.status(status).json({ success: false, error: { code, message, timestamp: new Date().toISOString() } });

export const invitationRegisterController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = registerSchema.parse(req.body);
    if (!isSupabaseConfigured || isDemoMode()) {
      return registrationError(res, 503, 'SERVICE_UNAVAILABLE', 'Cadastro por convite indisponível.');
    }
    const email = data.email.toLowerCase();
    const codeHash = hashInvitationCode(data.invitationCode);
    const { data: reservationId, error: reserveError } = await supabaseAdmin.rpc('reserve_customer_invitation', {
      p_code_hash: codeHash, p_email: email
    });
    if (reserveError) throw reserveError;
    if (!reservationId) return registrationError(res, 400, 'INVALID_INVITATION', 'Convite inválido ou indisponível.');

    let createdUserId: string | null = null;
    try {
      const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email, password: data.password, email_confirm: true
      });
      if (createError || !created.user) {
        return registrationError(res, 409, 'REGISTRATION_UNAVAILABLE', 'Não foi possível concluir o cadastro para este email.');
      }
      createdUserId = created.user.id;
      const { data: businessId, error: completeError } = await supabaseAdmin.rpc('complete_customer_registration', {
        p_code_hash: codeHash, p_reservation_id: reservationId, p_user_id: createdUserId,
        p_email: email, p_full_name: data.fullName, p_business_name: data.businessName,
        p_slug: data.slug, p_phone: data.phone || null
      });
      if (completeError || !businessId) throw completeError || new Error('Registration finalization failed');
      return res.status(201).json({ success: true, data: { userId: createdUserId, businessId, requiresActivation: false } });
    } catch {
      if (createdUserId) {
        const { error: cleanupError } = await supabaseAdmin.auth.admin.deleteUser(createdUserId);
        if (cleanupError) console.error('[Auth Audit]', { event: 'registration_compensation_failed' });
      }
      return registrationError(res, 409, 'REGISTRATION_UNAVAILABLE', 'Não foi possível concluir o cadastro. Tente novamente.');
    } finally {
      const { error: releaseError } = await supabaseAdmin.rpc('release_customer_invitation', {
        p_code_hash: codeHash, p_reservation_id: reservationId
      });
      if (releaseError) console.error('[Auth Audit]', { event: 'invitation_release_failed' });
    }
  } catch (error) {
    next(error);
  }
};
