import { randomBytes, createHmac } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { supabaseAdmin, isSupabaseConfigured, createPasswordAuthClient,
  createAuditedAdminClient } from '../config/supabase';
import { adminCookieName, adminCookieOptions, type AdminRequest, sha256 } from '../middleware/admin.middleware';
import { enforceSharedRequest } from '../middleware/shared-rate-limit.middleware';

const loginSchema = z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(128) }).strict();
const reauthSchema = z.object({ password: z.string().min(1).max(128) }).strict();

function emailHash(email: string): string {
  const secret = process.env.ADMIN_LOGIN_HASH_SECRET?.trim();
  if (!secret || secret.length < 32) throw new Error('Admin login hash secret unavailable');
  return createHmac('sha256', secret).update(email).digest('hex');
}

const denied = (res: Response) => res.status(401).json({
  success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Credenciais inválidas.' }
});

export async function adminLogin(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isSupabaseConfigured) return res.status(503).json({ success: false, error: { code: 'SERVICE_UNAVAILABLE' } });
    const body = loginSchema.parse(req.body);
    await enforceSharedRequest('admin-login-ip',`ip:${req.ip || 'unknown'}`,30,900);
    const email = body.email.toLowerCase();
    const hash = emailHash(email);
    const { data: attemptId, error: attemptError } = await supabaseAdmin.rpc('reserve_admin_login_attempt', {
      p_email_hash: hash
    });
    if (attemptError) throw attemptError;
    if (attemptId === null) {
      return res.status(429).json({ success: false, error: { code: 'ADMIN_LOGIN_LIMITED' } });
    }
    const { data: auth, error: authError } = await createPasswordAuthClient().auth.signInWithPassword({ email, password: body.password });
    const { data: admin, error: adminError } = auth?.user
      ? await supabaseAdmin.from('admin_identities').select('active,require_mfa,revoked_at')
        .eq('user_id', auth.user.id).maybeSingle()
      : { data: null, error: null };
    if (adminError) throw adminError;
    if (authError || !auth?.session || !admin?.active || admin.revoked_at) {
      return denied(res);
    }
    // Supabase-signed token was returned directly by Auth. MFA enforcement can
    // be enabled per identity once the challenge/verify UI is deployed.
    const claims = JSON.parse(Buffer.from(auth.session.access_token.split('.')[1], 'base64url').toString('utf8'));
    if (admin.require_mfa && claims.aal !== 'aal2') {
      return res.status(403).json({ success: false, error: { code: 'ADMIN_MFA_REQUIRED' } });
    }
    const sessionToken = randomBytes(32).toString('hex');
    const csrfToken = randomBytes(32).toString('hex');
    const { error: sessionError } = await createAuditedAdminClient(req, res).rpc('start_admin_session', {
      p_session_hash: sha256(sessionToken), p_user_id: auth.user.id, p_csrf_hash: sha256(csrfToken),
      p_mfa_verified: claims.aal === 'aal2',
      p_expires_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()
    });
    if (sessionError) throw sessionError;
    const { error: clearError } = await supabaseAdmin.rpc('clear_admin_login_attempt', {
      p_id: attemptId, p_email_hash: hash
    });
    if (clearError) console.error('[Admin Auth Audit]', { event: 'login_attempt_clear_failed' });
    res.cookie(adminCookieName(), sessionToken, adminCookieOptions());
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ success: true, data: { csrfToken, expiresInSeconds: 8 * 60 * 60 } });
  } catch (error) {
    next(error);
  }
}

export async function adminSession(req: AdminRequest, res: Response, next: NextFunction) {
  try {
    const csrfToken = randomBytes(32).toString('hex');
    const { error } = await supabaseAdmin.from('admin_sessions').update({ csrf_hash: sha256(csrfToken) })
      .eq('session_hash', req.adminSessionHash!);
    if (error) throw error;
    return res.status(200).json({ success: true, data: { userId: req.adminUserId, csrfToken } });
  } catch (error) { next(error); }
}

export async function adminLogout(req: AdminRequest, res: Response, next: NextFunction) {
  try {
    const { error } = await createAuditedAdminClient(req, res).rpc('revoke_admin_session', {
      p_user_id: req.adminUserId!, p_session_hash: req.adminSessionHash!
    });
    if (error) throw error;
    const { maxAge: _maxAge, ...clearOptions } = adminCookieOptions();
    res.clearCookie(adminCookieName(), clearOptions);
    return res.status(204).send();
  } catch (error) { next(error); }
}

export async function adminReauthenticate(req: AdminRequest, res: Response, next: NextFunction) {
  try {
    const { password } = reauthSchema.parse(req.body);
    const { data: current, error: currentError } = await supabaseAdmin.auth.admin.getUserById(req.adminUserId!);
    if (currentError || !current.user?.email) throw currentError || new Error('Admin account unavailable');
    const hash = emailHash(current.user.email.toLowerCase());
    const { data: attemptId, error: attemptError } = await supabaseAdmin.rpc('reserve_admin_login_attempt', {
      p_email_hash: hash
    });
    if (attemptError) throw attemptError;
    if (attemptId === null)
      return res.status(429).json({ success: false, error: { code: 'ADMIN_LOGIN_LIMITED' } });
    const { data: auth, error: authError } = await createPasswordAuthClient().auth.signInWithPassword({
      email: current.user.email, password
    });
    if (authError || auth.user?.id !== req.adminUserId) {
      return denied(res);
    }
    const requestId = String(res.locals.requestId || '');
    const { data: updated, error } = await createAuditedAdminClient(req, res).rpc('reauthenticate_admin_session', {
      p_actor: req.adminUserId!, p_session_hash: req.adminSessionHash!, p_ip: req.ip || null,
      p_user_agent: null,
      p_request_id: /^[0-9a-f-]{36}$/i.test(requestId) ? requestId : null
    });
    if (error) throw error;
    if (updated) {
      const { error: clearError } = await supabaseAdmin.rpc('clear_admin_login_attempt', {
        p_id: attemptId, p_email_hash: hash
      });
      if (clearError) console.error('[Admin Auth Audit]', { event: 'reauth_attempt_clear_failed' });
    }
    return updated ? res.status(204).send()
      : res.status(401).json({ success: false, error: { code: 'ADMIN_SESSION_EXPIRED' } });
  } catch (error) { next(error); }
}
