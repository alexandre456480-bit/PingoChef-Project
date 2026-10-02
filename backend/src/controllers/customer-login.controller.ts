import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { supabaseAdmin, isSupabaseConfigured, createPasswordAuthClient } from '../config/supabase';
import { localDb, isDemoMode } from '../config/localDb';
import { businessEligibility } from '../services/business-eligibility.service';

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
const errorResponse = (res: Response, status: number, code: string, message: string) =>
  res.status(status).json({ success: false, error: { code, message, timestamp: new Date().toISOString() } });

export const loginController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    if (isSupabaseConfigured && !isDemoMode()) {
      try {
        const { data: auth, error } = await createPasswordAuthClient().auth.signInWithPassword({ email, password });
        if (error || !auth?.session) return errorResponse(res, 401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos.');
        const { data: adminIdentity, error: identityError } = await supabaseAdmin.from('admin_identities')
          .select('user_id').eq('user_id', auth.user.id).maybeSingle();
        if (identityError) throw identityError;
        if (adminIdentity) return errorResponse(res, 403, 'WRONG_LOGIN_AREA', 'Utilize a área administrativa.');
        const { data: business, error: businessError } = await supabaseAdmin.from('businesses')
          .select('id, name, slug, status, logo_url')
          .eq('owner_user_id', auth.user.id).maybeSingle();
        if (businessError) throw businessError;
        if (!business) return errorResponse(res, 403, 'BUSINESS_NOT_FOUND', 'Nenhum estabelecimento associado a este usuário.');
        if (!(await businessEligibility.isAccountActive(business.id))) {
          return errorResponse(res, 403, 'ACCOUNT_NOT_ACTIVE', 'Esta conta está indisponível.');
        }
        const { error: eventError } = await supabaseAdmin.from('platform_events').insert({
          business_id: business.id, user_id: auth.user.id, event_name: 'LOGIN', metadata: {}
        });
        if (eventError) console.error('[Analytics Audit]', { event: 'login_event_failed' });
        return res.status(200).json({
          success: true,
          data: {
            accessToken: auth.session.access_token,
            refreshToken: auth.session.refresh_token,
            user: { id: auth.user.id, email: auth.user.email },
            business
          }
        });
      } catch {
        console.error('[Auth Audit]', { event: 'supabase_login_failed' });
        return errorResponse(res, 503, 'SERVICE_UNAVAILABLE', 'Serviço de autenticação indisponível.');
      }
    }
    if (!isDemoMode()) return errorResponse(res, 503, 'SERVICE_UNAVAILABLE', 'Banco de dados principal não está configurado.');
    const user = localDb.users.find(candidate => candidate.email.toLowerCase() === email.toLowerCase());
    if (!user || !localDb.verifyPassword(password, user.passwordHash)) {
      return errorResponse(res, 401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos.');
    }
    const business = localDb.businesses.find(candidate => candidate.owner_user_id === user.id);
    if (!business) return errorResponse(res, 403, 'BUSINESS_NOT_FOUND', 'Nenhum estabelecimento associado a este usuário.');
    if (!(await businessEligibility.isAccountActive(business.id))) {
      return errorResponse(res, 403, 'ACCOUNT_NOT_ACTIVE', 'Esta conta está indisponível.');
    }
    const token = `local_jwt_${user.id}_${Date.now()}`;
    return res.status(200).json({
      success: true,
      data: {
        accessToken: token,
        refreshToken: `refresh_${token}`,
        user: { id: user.id, email: user.email, fullName: user.fullName },
        business
      }
    });
  } catch (error) { next(error); }
};
