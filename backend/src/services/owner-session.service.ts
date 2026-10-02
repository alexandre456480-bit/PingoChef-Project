import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import type { Session, User } from '@supabase/supabase-js';
import { createPasswordAuthClient, supabaseAdmin } from '../config/supabase';
import { isDemoMode, localDb } from '../config/localDb';

export function ownerError(status: number, code: string, message = 'Não foi possível concluir a solicitação.') {
  return Object.assign(new Error(message), { status, code });
}
export const ownerOrigins = () => (process.env.FRONTEND_ORIGINS ||
  (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4200,http://127.0.0.1:4200'))
  .split(',').map(value => value.trim()).filter(value => value && value !== '*');
export const ownerCookieName = () => process.env.NODE_ENV === 'production' ? '__Host-pc_owner_session' : 'pc_owner_session';
export const ownerCookieOptions = (maxAge = 8 * 60 * 60 * 1000) => ({
  httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge
});
export const sessionHash = (value: string) => createHash('sha256').update(value).digest('hex');
const demoKey = randomBytes(32);
function encryptionKey(): Buffer {
  const configured = process.env.OWNER_SESSION_ENCRYPTION_KEY || '';
  if (!configured && isDemoMode()) return demoKey;
  const key = Buffer.from(configured, 'base64');
  if (!/^[A-Za-z0-9+/]{43}=$/.test(configured) || key.length !== 32) {
    throw ownerError(503, 'SESSION_CONFIGURATION_ERROR');
  }
  return key;
}
interface Tokens { accessToken: string; refreshToken: string }
export function encryptOwnerTokens(tokens: Tokens, hash: string): string {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), nonce);
  cipher.setAAD(Buffer.from(hash));
  const body = Buffer.concat([cipher.update(JSON.stringify(tokens), 'utf8'), cipher.final()]);
  return ['v1', nonce.toString('base64url'), cipher.getAuthTag().toString('base64url'), body.toString('base64url')].join('.');
}
export function decryptOwnerTokens(value: string, hash: string): Tokens {
  const [version, nonce, tag, body, extra] = value.split('.');
  if (version !== 'v1' || !nonce || !tag || !body || extra) throw ownerError(401, 'SESSION_INVALID');
  try {
    const cipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(nonce, 'base64url'));
    cipher.setAAD(Buffer.from(hash));
    cipher.setAuthTag(Buffer.from(tag, 'base64url'));
    const result = JSON.parse(Buffer.concat([cipher.update(Buffer.from(body, 'base64url')), cipher.final()]).toString('utf8'));
    if (typeof result.accessToken !== 'string' || typeof result.refreshToken !== 'string') throw new Error();
    return result;
  } catch { throw ownerError(401, 'SESSION_INVALID'); }
}
export function ownerCookie(req: Request): string | undefined {
  const values = (req.headers.cookie || '').split(';').map(part => part.trim()).filter(part => part.startsWith(`${ownerCookieName()}=`));
  // Reject ambiguous cookies instead of trusting their order.
  if (values.length !== 1) return undefined;
  const token = values[0].slice(ownerCookieName().length + 1);
  return /^[a-f0-9]{64}$/.test(token) ? token : undefined;
}
export function ownerCsrf(token: string): string {
  return createHmac('sha256', encryptionKey()).update(`owner-csrf:v1:${token}`).digest('hex');
}
export function checkOwnerOrigin(req: Request, requireOrigin = false): void {
  const origin = req.get('origin');
  if ((origin && !ownerOrigins().includes(origin)) || (requireOrigin && !origin)
    || req.get('sec-fetch-site') === 'cross-site') throw ownerError(403, 'OWNER_ORIGIN_DENIED');
}
export function checkOwnerCsrf(req: Request, token: string): void {
  checkOwnerOrigin(req, true);
  const csrf = req.get('x-csrf-token') || '';
  const expected = ownerCsrf(token);
  if (!/^[a-f0-9]{64}$/.test(csrf) || !timingSafeEqual(Buffer.from(csrf), Buffer.from(expected))) {
    throw ownerError(403, 'CSRF_INVALID');
  }
}
interface SessionRow {
  session_hash: string; user_id: string; scope: 'owner' | 'recovery'; encrypted_tokens: string;
  token_expires_at: string; expires_at: string; last_seen_at: string; created_at: string; revoked_at: string | null;
}
export interface OwnerSession { hash: string; token: string; row: SessionRow; tokens: Tokens; user: Pick<User, 'id' | 'email' | 'email_confirmed_at'> }
const demoSessions = new Map<string, SessionRow>();
async function readRow(hash: string): Promise<SessionRow | null> {
  if (isDemoMode()) return demoSessions.get(hash) || null;
  const { data, error } = await supabaseAdmin.from('owner_sessions')
    .select('session_hash,user_id,scope,encrypted_tokens,token_expires_at,expires_at,last_seen_at,created_at,revoked_at')
    .eq('session_hash', hash).maybeSingle();
  if (error) throw ownerError(503, 'SESSION_SERVICE_UNAVAILABLE');
  return data;
}
function assertLive(row: SessionRow | null): asserts row is SessionRow {
  const now = Date.now();
  if (!row || row.revoked_at || Date.parse(row.expires_at) <= now || Date.parse(row.last_seen_at) + 30 * 60 * 1000 <= now) {
    throw ownerError(401, 'SESSION_EXPIRED', 'Sessão encerrada. Entre novamente.');
  }
}
export async function createOwnerSession(req: Request, res: Response, userId: string, session: Session,
  scope: 'owner' | 'recovery' = 'owner', maxLifetime?: number): Promise<string> {
  const token = randomBytes(32).toString('hex');
  const hash = sessionHash(token);
  const lifetime = Math.min(scope === 'recovery' ? 15 * 60 * 1000 : 8 * 60 * 60 * 1000, maxLifetime ?? Infinity);
  const now = Date.now();
  const previous = ownerCookie(req);
  const row: SessionRow = {
    session_hash: hash, user_id: userId, scope,
    encrypted_tokens: encryptOwnerTokens({ accessToken: session.access_token, refreshToken: session.refresh_token }, hash),
    token_expires_at: new Date((session.expires_at || Math.floor(now / 1000) + 300) * 1000).toISOString(),
    expires_at: new Date(now + lifetime - 1000).toISOString(), created_at: new Date(now).toISOString(),
    last_seen_at: new Date(now).toISOString(), revoked_at: null
  };
  if (isDemoMode()) {
    if (previous) {
      const old = demoSessions.get(sessionHash(previous));
      if (old) { old.revoked_at = new Date().toISOString(); old.encrypted_tokens = ''; }
    }
    demoSessions.set(hash, row);
  } else {
    let issuedAt: number | null = null;
    try {
      const claims = JSON.parse(Buffer.from(session.access_token.split('.')[1], 'base64url').toString('utf8'));
      if (Number.isSafeInteger(claims.iat)) issuedAt = claims.iat;
    } catch { /* The database fails closed if a revocation cutoff exists. */ }
    const { data, error } = await supabaseAdmin.rpc('create_owner_session', {
      p_hash: hash, p_user_id: userId, p_scope: scope, p_tokens: row.encrypted_tokens,
      p_token_expires_at: row.token_expires_at, p_expires_at: row.expires_at,
      p_previous_hash: previous ? sessionHash(previous) : null, p_auth_issued_at: issuedAt
    });
    if (error || data !== true) throw ownerError(503, 'SESSION_CREATION_FAILED');
  }
  res.cookie(ownerCookieName(), token, ownerCookieOptions(lifetime));
  res.setHeader('Cache-Control', 'no-store');
  return ownerCsrf(token);
}
export async function resolveOwnerSession(req: Request, expectedScope: 'owner' | 'recovery' = 'owner'): Promise<OwnerSession> {
  const token = ownerCookie(req);
  if (!token) throw ownerError(401, 'UNAUTHORIZED', 'Entre na sua conta.');
  checkOwnerOrigin(req, !['GET', 'HEAD', 'OPTIONS'].includes(req.method));
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) checkOwnerCsrf(req, token);
  const hash = sessionHash(token);
  let row = await readRow(hash);
  assertLive(row);
  if (row.scope !== expectedScope) throw ownerError(403, 'SESSION_SCOPE_DENIED');
  let tokens = decryptOwnerTokens(row.encrypted_tokens, hash);
  if (!isDemoMode() && tokens.refreshToken && Date.parse(row.token_expires_at) <= Date.now() + 60_000) {
    const { data: lease, error } = await supabaseAdmin.rpc('claim_owner_session_refresh', { p_hash: hash });
    if (error) throw ownerError(503, 'SESSION_SERVICE_UNAVAILABLE');
    if (lease) {
      const { data, error: refreshError } = await createPasswordAuthClient().auth.refreshSession({ refresh_token: tokens.refreshToken });
      if (refreshError || !data.session || data.user?.id !== row.user_id) {
        await revokeOwnerSession(row.user_id, hash);
        throw ownerError(401, 'SESSION_EXPIRED');
      }
      tokens = { accessToken: data.session.access_token, refreshToken: data.session.refresh_token };
      const { data: completed, error: updateError } = await supabaseAdmin.rpc('complete_owner_session_refresh', {
        p_hash: hash, p_lease: lease, p_tokens: encryptOwnerTokens(tokens, hash),
        p_token_expires_at: new Date(data.session.expires_at! * 1000).toISOString()
      });
      if (updateError) throw ownerError(503, 'SESSION_SERVICE_UNAVAILABLE');
      if (!completed) throw ownerError(401, 'SESSION_REVOKED');
    } else {
      // Other instances share the refresh lease. Never reuse a refresh token concurrently.
      for (let attempt = 0; attempt < 15; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 100));
        row = await readRow(hash); assertLive(row);
        if (Date.parse(row.token_expires_at) > Date.now() + 60_000) break;
      }
      if (Date.parse(row.token_expires_at) <= Date.now() + 60_000) throw ownerError(503, 'SESSION_BUSY', 'Tente novamente em instantes.');
      tokens = decryptOwnerTokens(row.encrypted_tokens, hash);
    }
  }
  let user: OwnerSession['user'];
  if (isDemoMode()) {
    const local = localDb.users.find(value => value.id === row!.user_id);
    if (!local) throw ownerError(401, 'SESSION_INVALID');
    user = { id: local.id, email: local.email, email_confirmed_at: row.created_at };
    row.last_seen_at = new Date().toISOString();
  } else {
    const { data, error } = await supabaseAdmin.auth.getUser(tokens.accessToken);
    if (error || data.user?.id !== row.user_id || !data.user.email_confirmed_at) throw ownerError(401, 'SESSION_INVALID');
    const { data: admin, error: identityError } = await supabaseAdmin.from('admin_identities').select('user_id').eq('user_id', row.user_id).maybeSingle();
    if (identityError) throw ownerError(503, 'SESSION_SERVICE_UNAVAILABLE');
    if (admin) throw ownerError(403, 'WRONG_LOGIN_AREA');
    user = data.user;
    // Conditional update is also a final revocation check after a refresh or identity lookup.
    const { data: touched, error: touchError } = await supabaseAdmin.from('owner_sessions')
      .update({ last_seen_at: new Date().toISOString() }).eq('session_hash', hash).is('revoked_at', null)
      .gt('expires_at', new Date().toISOString()).select('session_hash').maybeSingle();
    if (touchError) throw ownerError(503, 'SESSION_SERVICE_UNAVAILABLE');
    if (!touched) throw ownerError(401, 'SESSION_REVOKED');
  }
  return { token, hash, row, tokens, user };
}
export async function revokeOwnerSession(userId: string, hash: string | null): Promise<void> {
  if (isDemoMode()) {
    for (const row of demoSessions.values()) if (row.user_id === userId && (!hash || row.session_hash === hash)) {
      row.revoked_at = new Date().toISOString(); row.encrypted_tokens = '';
    }
    return;
  }
  const { error } = await supabaseAdmin.rpc('revoke_owner_sessions', { p_user_id: userId, p_hash: hash });
  if (error) throw ownerError(503, 'SESSION_SERVICE_UNAVAILABLE');
}
export async function enforceOwnerAttempts(req: Request, action: 'login' | 'register' | 'forgot' | 'resend', email: string): Promise<void> {
  const window = action === 'login' ? 900 : 3600;
  const limits = action === 'login' ? [10, 50] : action === 'register' ? [3, 10] : [4, 20];
  const subjects = [`email:${email.trim().toLowerCase()}`, `ip:${req.ip || 'unknown'}`];
  for (let index = 0; index < subjects.length; index++) {
    const hash = createHmac('sha256', encryptionKey()).update(`owner-rate:${subjects[index]}`).digest('hex');
    if (isDemoMode()) continue; // Express IP gates remain active in the isolated demo.
    const { data, error } = await supabaseAdmin.rpc('reserve_owner_auth_attempt', {
      p_action: action, p_subject_hash: hash, p_limit: limits[index], p_window_seconds: window
    });
    if (error) throw ownerError(503, 'AUTH_SERVICE_UNAVAILABLE');
    if (!data) throw ownerError(429, 'TOO_MANY_REQUESTS', 'Aguarde antes de tentar novamente.');
  }
}
