import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { z } from 'zod';
import type { Session } from '@supabase/supabase-js';
import { createPasswordAuthClient, supabaseAdmin } from '../config/supabase';
import { localDb, isDemoMode } from '../config/localDb';
import { businessEligibility } from '../services/business-eligibility.service';
import { entitlements } from '../services/entitlement.service';
import { hashInvitationCode } from '../services/invitation-hash.service';
import { checkOwnerOrigin, createOwnerSession, enforceOwnerAttempts, ownerCookieName, ownerCookieOptions,
  ownerCsrf, ownerError, ownerOrigins, resolveOwnerSession, revokeOwnerSession, type OwnerSession } from '../services/owner-session.service';

const emailSchema = z.string().trim().email().max(254).transform(value => value.toLowerCase());
const passwordSchema = z.string().min(8).max(128);
const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) }).strict();
const registerSchema = z.object({ email: emailSchema, password: passwordSchema,
  fullName: z.string().trim().min(2).max(120), businessName: z.string().trim().min(2).max(120),
  slug: z.string().regex(/^[a-z0-9-]{3,50}$/), phone: z.string().trim().max(30).optional(),
  planCode: z.enum(['FREE', 'BASIC', 'MEDIUM', 'PRO']).default('FREE'),
  invitationCode: z.string().trim().min(10).max(128).optional(),
  intentId: z.string().uuid().optional(), termsAccepted: z.literal(true).optional() }).strict();
const emailBody = z.object({ email: emailSchema }).strict();
const accepted = (res: Response) => res.status(202).json({ success: true, data: {
  status: 'AWAITING_EMAIL', message: 'Se o endereço puder receber esta solicitação, enviaremos as instruções por e-mail.'
} });
const handler = (action: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req, res, next: NextFunction) => { res.setHeader('Cache-Control', 'no-store'); action(req, res).catch(next); };
export const requireOwnerOrigin: RequestHandler = (req, _res, next) => {
  try { checkOwnerOrigin(req, true); next(); } catch (error) { next(error); }
};
function callbackUrl(recovery = false): string {
  const base = process.env.OWNER_AUTH_CALLBACK_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000/api/v1/auth/confirm-email');
  let url: URL;
  try { url = new URL(base); } catch { throw ownerError(503, 'AUTH_CONFIGURATION_ERROR'); }
  if (url.search || url.hash || url.username || url.password || (process.env.NODE_ENV === 'production' && url.protocol !== 'https:')) {
    throw ownerError(503, 'AUTH_CONFIGURATION_ERROR');
  }
  if (recovery) url.pathname = url.pathname.replace(/confirm-email$/, 'recover');
  return url.toString();
}
async function rejectAdmin(userId: string) {
  const { data, error } = await supabaseAdmin.from('admin_identities').select('user_id').eq('user_id', userId).maybeSingle();
  if (error) throw ownerError(503, 'AUTH_SERVICE_UNAVAILABLE');
  if (data) throw ownerError(403, 'WRONG_LOGIN_AREA', 'Utilize a área administrativa.');
}
async function provision(userId: string, intentId: string | null = null): Promise<string | null> {
  const { data, error } = await supabaseAdmin.rpc('provision_owner_account', { p_user_id: userId, p_intent_id: intentId });
  if (error) {
    const codes = ['EMAIL_NOT_CONFIRMED', 'INVALID_REGISTRATION_INTENT', 'REGISTRATION_EXPIRED', 'INVALID_INVITATION', 'PAID_PLAN_UNAVAILABLE'];
    if (codes.includes(error.message)) throw ownerError(409, error.message, 'Cadastro pendente. Verifique as instruções de confirmação.');
    if (error.code === '23505') throw ownerError(409, 'PROVISIONING_CONFLICT', 'Escolha outro identificador para o estabelecimento.');
    throw ownerError(503, 'PROVISIONING_UNAVAILABLE');
  }
  return data;
}
async function meData(user: OwnerSession['user']) {
  let business: any;
  if (isDemoMode()) business = localDb.businesses.find(row => row.owner_user_id === user.id) || null;
  else {
    const { data, error } = await supabaseAdmin.from('businesses')
      .select('id,name,slug,status,logo_url,description,cover_image_url,welcome_bg_type,welcome_bg_image,welcome_bg_color,phone,whatsapp').eq('owner_user_id', user.id).maybeSingle();
    if (error) throw ownerError(503, 'AUTH_SERVICE_UNAVAILABLE');
    business = data;
  }
  const snapshot = business ? await entitlements.getEntitlements(business.id) : null;
  const accountActive = business ? await businessEligibility.isAccountActive(business.id) : false;
  const {data: lifecycle} = business && !isDemoMode()
    ? await supabaseAdmin.from('business_account_state').select('is_published').eq('business_id',business.id).maybeSingle() : {data:null};
  const {data: milestones} = business && !isDemoMode()
    ? await supabaseAdmin.from('platform_events').select('event_name').eq('business_id',business.id)
      .in('event_name',['DESIGN_CONFIGURED','MENU_PUBLISHED']) : {data:[]};
  const { data: profile } = isDemoMode() ? { data: null } : await supabaseAdmin.from('profiles').select('full_name').eq('id',user.id).maybeSingle();
  return { user: { id: user.id, email: user.email, name: profile?.full_name || null }, business, emailVerified: Boolean(user.email_confirmed_at),
    accountActive, provisioningRequired: !business, isPublished:lifecycle?.is_published===true,
    onboarding:{designConfigured:Array.isArray(milestones)&&milestones.some((e:any)=>e.event_name==='DESIGN_CONFIGURED')},
    plan: snapshot?.plan || null, subscription: snapshot?.subscription || null,
    entitlements: snapshot?.entitlements || {}, usage: snapshot?.usage || { products: 0, categories: 0, videos: 0 } };
}
export const ownerLogin = handler(async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  await enforceOwnerAttempts(req, 'login', email);
  let session: Session;
  let user: OwnerSession['user'];
  if (isDemoMode()) {
    const local = localDb.users.find(row => row.email.toLowerCase() === email);
    if (!local || !localDb.verifyPassword(password, local.passwordHash)) throw ownerError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos.');
    user = { id: local.id, email: local.email, email_confirmed_at: new Date().toISOString() };
    session = { access_token: `local_jwt_${local.id}_${Date.now()}`, refresh_token: '', expires_at: Math.floor(Date.now() / 1000) + 3600 } as Session;
  } else {
    const { data, error } = await createPasswordAuthClient().auth.signInWithPassword({ email, password });
    if (error || !data.session || !data.user.email_confirmed_at) {
      // Do not reveal whether a credential or an unconfirmed email caused rejection.
      throw ownerError(401, 'INVALID_CREDENTIALS', 'Verifique e-mail, senha e a confirmação do endereço.');
    }
    await rejectAdmin(data.user.id);
    session = data.session; user = data.user;
    // A callback interrupted after OTP verification is resumed after a valid password login.
    try { await provision(user.id); } catch (error: any) {
      if (![409].includes(error.status)) throw error;
      // Authenticated owner may repair a pending registration without deleting the identity.
    }
  }
  const csrfToken = await createOwnerSession(req, res, user.id, session);
  return res.json({ success: true, data: { ...await meData(user), csrfToken } });
});
export const ownerMe = handler(async (req, res) => {
  const session = await resolveOwnerSession(req);
  return res.json({ success: true, data: { ...await meData(session.user), csrfToken: ownerCsrf(session.token) } });
});
export const ownerLogout = (all = false) => handler(async (req, res) => {
  const session = await resolveOwnerSession(req);
  await revokeOwnerSession(session.user.id, all ? null : session.hash);
  if (!isDemoMode()) {
    // Database revocation is authoritative even if the Auth API is temporarily unavailable.
    await supabaseAdmin.auth.admin.signOut(session.tokens.accessToken, all ? 'global' : 'local').catch(() => undefined);
  }
  res.clearCookie(ownerCookieName(), ownerCookieOptions(0));
  return res.status(204).send();
});
export const ownerRegister = handler(async (req, res) => {
  const body = registerSchema.parse(req.body);
  await enforceOwnerAttempts(req, 'register', body.email);
  if (body.planCode !== 'FREE') throw ownerError(409, 'PAID_PLAN_UNAVAILABLE', 'Cadastro público disponível no plano Free.');
  if (isDemoMode()) throw ownerError(503, 'EMAIL_CONFIRMATION_REQUIRED', 'Configure Supabase Auth para cadastrar contas.');
  const redirect = callbackUrl();
  if (body.intentId) {
    if (!body.termsAccepted) throw ownerError(400,'TERMS_REQUIRED');
    const {data: selected,error: selectionError}=await supabaseAdmin.from('owner_plan_intents')
      .update({consumed_at:new Date().toISOString(),terms_version:'2026-10'})
      .eq('id',body.intentId).eq('plan_code','FREE').is('consumed_at',null)
      .gt('expires_at',new Date().toISOString()).select('id').maybeSingle();
    if(selectionError)throw ownerError(503,'REGISTRATION_UNAVAILABLE');
    if(!selected)throw ownerError(410,'PLAN_INTENT_EXPIRED','Escolha seu plano novamente para continuar.');
  }
  const { data: intentId, error } = await supabaseAdmin.rpc('start_owner_registration', {
    p_email: body.email, p_full_name: body.fullName, p_business_name: body.businessName,
    p_slug: body.slug, p_phone: body.phone || null, p_plan_code: 'FREE',
    p_invitation_hash: body.invitationCode ? hashInvitationCode(body.invitationCode) : null
  });
  if (error) {
    if (error.message === 'INVALID_INVITATION') return accepted(res);
    throw ownerError(503, 'REGISTRATION_UNAVAILABLE');
  }
  if (!intentId) return accepted(res);
  if(body.intentId){
    const {error: consentError}=await supabaseAdmin.from('registration_intents').update({
      plan_selection_intent_id:body.intentId,terms_version:'2026-10',terms_accepted_at:new Date().toISOString()
    }).eq('id',intentId);
    if(consentError)throw ownerError(503,'REGISTRATION_UNAVAILABLE');
  }
  const auth = createPasswordAuthClient();
  const { data, error: signupError } = await auth.auth.signUp({ email: body.email, password: body.password,
    options: { emailRedirectTo: redirect } });
  if (signupError || !data.user || !data.user.identities?.length || data.session || data.user.email_confirmed_at) {
    await supabaseAdmin.rpc('abandon_owner_registration', { p_intent_id: intentId });
    if (data.session || data.user?.email_confirmed_at) throw ownerError(503, 'EMAIL_CONFIRMATION_REQUIRED', 'Confirmação de e-mail deve estar habilitada.');
    if (signupError && signupError.status && signupError.status >= 500) throw ownerError(503, 'EMAIL_DELIVERY_UNAVAILABLE');
    return accepted(res);
  }
  const { data: bound, error: bindError } = await supabaseAdmin.rpc('bind_owner_registration', { p_intent_id: intentId, p_user_id: data.user.id });
  if (bindError || !bound) throw ownerError(503, 'REGISTRATION_BINDING_PENDING');
  return accepted(res);
});
export const ownerEmailRequest = (recovery = false) => handler(async (req, res) => {
  const { email } = emailBody.parse(req.body);
  try { await enforceOwnerAttempts(req, recovery ? 'forgot' : 'resend', email); }
  catch (error: any) { if (error.status === 429) return accepted(res); throw error; }
  if (isDemoMode()) return accepted(res);
  const redirect = callbackUrl(recovery);
  const auth = createPasswordAuthClient();
  const result = recovery ? await auth.auth.resetPasswordForEmail(email, { redirectTo: redirect })
    : await auth.auth.resend({ type: 'signup', email, options: { emailRedirectTo: redirect } });
  // Existence, already confirmed addresses and Auth's own throttling share the same response.
  if (result.error && (result.error.status || 0) >= 500) throw ownerError(503, 'EMAIL_DELIVERY_UNAVAILABLE');
  return accepted(res);
});
export const ownerConfirmEmail = (recovery = false) => handler(async (req, res) => {
  res.setHeader('Referrer-Policy', 'no-referrer');
  const tokenHash = z.string().min(32).max(256).regex(/^[A-Za-z0-9_-]+$/).safeParse(req.query.token_hash);
  const destination = new URL(recovery ? '/reset-password' : '/confirm-email', ownerOrigins()[0]);
  if (!tokenHash.success || isDemoMode()) { destination.searchParams.set('confirmation', 'invalid'); return res.redirect(303, destination.toString()); }
  const { data, error } = await createPasswordAuthClient().auth.verifyOtp({ token_hash: tokenHash.data, type: recovery ? 'recovery' : 'email' });
  if (error || !data.user?.email_confirmed_at || !data.session) {
    destination.searchParams.set('confirmation', 'invalid_or_used'); return res.redirect(303, destination.toString());
  }
  await rejectAdmin(data.user.id);
  if (recovery) await createOwnerSession(req, res, data.user.id, data.session, 'recovery');
  else {
    const intent = req.query.intent_id === undefined ? null : z.string().uuid().parse(req.query.intent_id);
    try { await provision(data.user.id, intent); destination.searchParams.set('confirmation', 'success'); }
    catch (error: any) {
      if (error.status !== 409) throw error;
      destination.searchParams.set('confirmation', 'pending');
    }
    // No automatic login on an email confirmation link; prevents signup login-CSRF.
    await supabaseAdmin.auth.admin.signOut(data.session.access_token, 'local').catch(() => undefined);
  }
  return res.redirect(303, destination.toString());
});
export const ownerRecoverySession = handler(async (req, res) => {
  const session = await resolveOwnerSession(req, 'recovery');
  return res.json({ success: true, data: { email: session.user.email, csrfToken: ownerCsrf(session.token) } });
});
export const ownerResetPassword = handler(async (req, res) => {
  const { password } = z.object({ password: passwordSchema }).strict().parse(req.body);
  const session = await resolveOwnerSession(req, 'recovery');
  const auth = createPasswordAuthClient();
  const { error: sessionError } = await auth.auth.setSession({ access_token: session.tokens.accessToken, refresh_token: session.tokens.refreshToken });
  if (sessionError) throw ownerError(401, 'SESSION_EXPIRED');
  const { error } = await auth.auth.updateUser({ password });
  if (error) throw ownerError(400, 'PASSWORD_UPDATE_FAILED', 'Não foi possível alterar a senha. Verifique a política de senhas.');
  await revokeOwnerSession(session.user.id, null);
  await supabaseAdmin.auth.admin.signOut(session.tokens.accessToken, 'global').catch(() => undefined);
  res.clearCookie(ownerCookieName(), ownerCookieOptions(0));
  return res.status(204).send();
});
export const ownerCompleteRegistration = handler(async (req, res) => {
  const session = await resolveOwnerSession(req);
  const body = registerSchema.omit({ email: true, password: true, invitationCode: true }).parse(req.body);
  if (body.planCode !== 'FREE') throw ownerError(409, 'PAID_PLAN_UNAVAILABLE');
  const { data, error } = await supabaseAdmin.rpc('resume_owner_registration', {
    p_user_id: session.user.id, p_full_name: body.fullName, p_business_name: body.businessName,
    p_slug: body.slug, p_phone: body.phone || null
  });
  if (error) throw ownerError(409, 'PROVISIONING_CONFLICT', 'Verifique os dados e o identificador do estabelecimento.');
  return res.json({ success: true, data: { businessId: data, ...await meData(session.user) } });
});
export const ownerMigrateSession = handler(async (req, res) => {
  const cutoff = Date.parse(process.env.OWNER_LEGACY_TOKEN_ACCEPT_UNTIL || '');
  if (!Number.isFinite(cutoff) || cutoff <= Date.now() || cutoff > Date.now() + 14 * 86400000) throw ownerError(410, 'LEGACY_MIGRATION_CLOSED');
  const token = req.get('authorization')?.match(/^Bearer ([A-Za-z0-9_.-]+)$/)?.[1];
  if (!token) throw ownerError(401, 'UNAUTHORIZED');
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user?.email_confirmed_at) throw ownerError(401, 'INVALID_TOKEN');
  await rejectAdmin(data.user.id);
  const { data: business, error: businessError } = await supabaseAdmin.from('businesses').select('id').eq('owner_user_id', data.user.id).single();
  if (businessError || !business || !await businessEligibility.isAccountActive(business.id)) throw ownerError(403, 'ACCOUNT_NOT_ACTIVE');
  const { data: state, error: stateError } = await supabaseAdmin.from('business_account_state').select('sessions_revoked_at').eq('business_id', business.id).single();
  let claims: any;
  try { claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')); } catch { throw ownerError(401, 'INVALID_TOKEN'); }
  if (stateError || !state || !Number.isFinite(claims.exp) || !Number.isFinite(claims.iat)
    || claims.exp * 1000 <= Date.now() || (state.sessions_revoked_at && claims.iat * 1000 <= Date.parse(state.sessions_revoked_at))) throw ownerError(401, 'SESSION_REVOKED');
  // A legacy access token is imported without exposing or accepting a browser refresh token.
  // This short transition session ends at the old JWT's expiry; next login starts an 8h session.
  const csrfToken = await createOwnerSession(req, res, data.user.id, { access_token: token, refresh_token: '', expires_at: claims.exp } as Session,
    'owner', Math.min(cutoff, claims.exp * 1000) - Date.now());
  return res.json({ success: true, data: { ...await meData(data.user), csrfToken } });
});
