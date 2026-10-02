import { createHash, timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { supabaseAdmin, isSupabaseConfigured } from '../config/supabase';

export interface AdminRequest extends Request {
  adminUserId?: string;
  adminSessionHash?: string;
  adminReauthenticatedAt?: string;
  adminExpectedLifecycle?: 'ACTIVE' | 'SUSPENDED' | 'ACTIVE_OR_SUSPENDED';
}

export const adminOrigins = () => (process.env.ADMIN_ORIGINS || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4300'))
  .split(',').map(value => value.trim()).filter(value => value.length > 0 && value !== '*');

export const adminCookieName = () => process.env.NODE_ENV === 'production'
  ? '__Host-pc_admin_session' : 'pc_admin_session';

export const adminCookieOptions = () => ({
  httpOnly: true as const,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  maxAge: 8 * 60 * 60 * 1000
});

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

function cookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.cookie || '').split(';')) {
    const separator = part.indexOf('=');
    if (separator > 0 && part.slice(0, separator).trim() === name) {
      return part.slice(separator + 1).trim();
    }
  }
  return undefined;
}

export function requireAdminOrigin(req: Request, res: Response, next: NextFunction) {
  const origin = req.get('origin');
  if (!origin || !adminOrigins().includes(origin)) {
    return res.status(403).json({ success: false, error: { code: 'ADMIN_ORIGIN_DENIED' } });
  }
  return next();
}

export async function requireAdmin(req: AdminRequest, res: Response, next: NextFunction) {
  try {
    if (!isSupabaseConfigured) return res.status(503).json({ success: false, error: { code: 'SERVICE_UNAVAILABLE' } });
    const token = cookie(req, adminCookieName());
    if (!token || !/^[a-f0-9]{64}$/.test(token)) {
      return res.status(401).json({ success: false, error: { code: 'ADMIN_UNAUTHORIZED' } });
    }
    const requestOrigin = req.get('origin');
    if ((requestOrigin && !adminOrigins().includes(requestOrigin))
      || (!requestOrigin && req.method !== 'GET' && req.method !== 'HEAD')
      || (!requestOrigin && req.get('sec-fetch-site') === 'cross-site')) {
      return res.status(403).json({ success: false, error: { code: 'ADMIN_ORIGIN_DENIED' } });
    }
    const sessionHash = sha256(token);
    const { data: session, error } = await supabaseAdmin.from('admin_sessions')
      .select('user_id, csrf_hash, mfa_verified, expires_at, last_seen_at, revoked_at,created_at,reauthenticated_at')
      .eq('session_hash', sessionHash).maybeSingle();
    if (error) throw error;
    const now = Date.now();
    if (!session || session.revoked_at || new Date(session.expires_at).getTime() <= now
      || new Date(session.last_seen_at).getTime() + 30 * 60 * 1000 <= now) {
      return res.status(401).json({ success: false, error: { code: 'ADMIN_SESSION_EXPIRED' } });
    }
    const { data: admin, error: adminError } = await supabaseAdmin.from('admin_identities')
      .select('active, require_mfa, revoked_at').eq('user_id', session.user_id).maybeSingle();
    if (adminError) throw adminError;
    if (!admin?.active || admin.revoked_at) {
      return res.status(403).json({ success: false, error: { code: 'ADMIN_REVOKED' } });
    }
    if (admin.require_mfa && !session.mfa_verified) {
      return res.status(403).json({ success: false, error: { code: 'ADMIN_MFA_REQUIRED' } });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
      const csrf = req.get('x-csrf-token');
      if (!csrf || !/^[a-f0-9]{64}$/.test(csrf)) {
        return res.status(403).json({ success: false, error: { code: 'ADMIN_CSRF_DENIED' } });
      }
      const supplied = Buffer.from(sha256(csrf), 'hex');
      const expected = Buffer.from(session.csrf_hash, 'hex');
      if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
        return res.status(403).json({ success: false, error: { code: 'ADMIN_CSRF_DENIED' } });
      }
    }
    const { error: touchError } = await supabaseAdmin.from('admin_sessions')
      .update({ last_seen_at: new Date().toISOString() }).eq('session_hash', sessionHash);
    if (touchError) throw touchError;
    req.adminUserId = session.user_id;
    req.adminSessionHash = sessionHash;
    req.adminReauthenticatedAt = session.reauthenticated_at || session.created_at;
    res.setHeader('Cache-Control', 'no-store');
    return next();
  } catch {
    return res.status(503).json({ success: false, error: { code: 'ADMIN_AUTH_UNAVAILABLE' } });
  }
}

export function requireRecentAdmin(req: AdminRequest, res: Response, next: NextFunction) {
  const last = req.adminReauthenticatedAt ? new Date(req.adminReauthenticatedAt).getTime() : 0;
  if (!last || Date.now() - last > 15 * 60 * 1000) {
    return res.status(403).json({ success: false, error: { code: 'ADMIN_REAUTH_REQUIRED' } });
  }
  return next();
}
