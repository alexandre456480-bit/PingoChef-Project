import express from 'express';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { supabaseAdmin, createPasswordAuthClient } from '../config/supabase';
import authRoutes from '../routes/auth.routes';
import { authenticateJwt } from '../middleware/auth.middleware';
import { encryptOwnerTokens, decryptOwnerTokens, ownerCookieOptions } from '../services/owner-session.service';
import { mapEntitlementDatabaseError } from '../services/entitlement.service';

jest.mock('../config/supabase', () => ({ isSupabaseConfigured: true, createPasswordAuthClient: jest.fn(),
  supabaseAdmin: { from: jest.fn(), rpc: jest.fn(), auth: { getUser: jest.fn(), admin: { signOut: jest.fn() } } } }));
// Distributed credential quotas are exercised against real PostgreSQL in test:database.
jest.mock('express-rate-limit', () => ({ __esModule: true, default: () => (_req:any,_res:any,next:any) => next() }));

const origin = 'http://localhost:4200';
const user = { id: randomUUID(), email: 'owner@example.test', email_confirmed_at: new Date().toISOString() };
const business = { id: randomUUID(), name: 'Owner', status: 'ACTIVE', slug: 'owner-test', owner_user_id: user.id };
const secrets = { access_token: 'server-only-access-secret', refresh_token: 'server-only-refresh-secret',
  expires_at: Math.floor(Date.now()/1000)+3600 };
const rows = new Map<string, any>();
const selections = new Map<string,any>();
let duplicate = false;
let deniedProvision = false;
const provider = { signInWithPassword: jest.fn(), refreshSession: jest.fn(), signUp: jest.fn(), verifyOtp: jest.fn(),
  resetPasswordForEmail: jest.fn(), resend: jest.fn(), setSession: jest.fn(), updateUser: jest.fn(), signOut:jest.fn() };
function app() {
  const api = express(); api.use(express.json()); api.use('/api/v1/auth', authRoutes);
  api.post('/api/v1/owner-operation', authenticateJwt as any, (_req, res) => res.json({success:true}));
  api.use((error:any,_req:express.Request,res:express.Response,_next:express.NextFunction) => {
    const err=mapEntitlementDatabaseError(error)||error;
    res.status(err.status|| (err.name==='ZodError'?400:500)).json({success:false,error:{code:err.code||'VALIDATION_ERROR',metadata:err.metadata}});
  }); return api;
}
beforeEach(() => {
  delete process.env.APP_MODE; process.env.NODE_ENV='test'; process.env.FRONTEND_ORIGINS=origin;
  process.env.OWNER_SESSION_ENCRYPTION_KEY=Buffer.alloc(32,19).toString('base64');
  process.env.INVITATION_HASH_SECRET='invitation-test-secret-'.repeat(3);
  process.env.OWNER_AUTH_CALLBACK_URL='http://localhost:3000/api/v1/auth/confirm-email';
  rows.clear();selections.clear();duplicate=false;deniedProvision=false;
  (createPasswordAuthClient as jest.Mock).mockReturnValue({auth:provider});
  provider.signInWithPassword.mockResolvedValue({data:{user,session:secrets},error:null});
  provider.signUp.mockResolvedValue({data:{user:{...user,email_confirmed_at:null,identities:[{id:'new'}]},session:null},error:null});
  provider.verifyOtp.mockResolvedValue({data:{user,session:secrets},error:null});
  provider.resend.mockResolvedValue({error:null});provider.resetPasswordForEmail.mockResolvedValue({error:null});
  provider.setSession.mockResolvedValue({error:null});provider.updateUser.mockResolvedValue({error:null});
  provider.signOut.mockResolvedValue({error:null});
  (supabaseAdmin.auth.getUser as jest.Mock).mockResolvedValue({data:{user},error:null});
  (supabaseAdmin.auth.admin.signOut as jest.Mock).mockResolvedValue({error:null});
  (supabaseAdmin.from as jest.Mock).mockImplementation((table:string) => {
    const filters: Array<[string,any]> = []; let update:any;let inserted:any;
    const chain:any = { select:()=>chain, update:(value:any)=>{update=value;return chain;},insert:(value:any)=>{inserted=value;return chain;},
      eq:(key:string,value:any)=>{filters.push([key,value]);return chain;},
      is:(key:string,value:any)=>{filters.push([key,value]);return chain;}, gt:()=>chain, in:()=>chain,
      maybeSingle:async()=>{
        if(table==='admin_identities') return {data:null,error:null};
        if(table==='businesses') return {data:business,error:null};
        if(table==='business_account_state')return {data:{sessions_revoked_at:null},error:null};
        if(table==='owner_plan_intents'){
          const id=filters.find(([key])=>key==='id')?.[1];const entry=selections.get(id);
          if(!entry||entry.consumed_at||Date.parse(entry.expires_at)<=Date.now())return {data:null,error:null};
          if(update)Object.assign(entry,update);return {data:{...entry},error:null};
        }
        if(table==='owner_sessions'){
          const hash=filters.find(([key])=>key==='session_hash')?.[1]; const row=rows.get(hash);
          if(!row || (filters.some(([key,value])=>key==='revoked_at'&&value===null)&&row.revoked_at))return {data:null,error:null};
          if(update)Object.assign(row,update);
          return {data:{...row},error:null};
        }
        return {data:null,error:null};
      }, single:async()=>{if(table==='owner_plan_intents'&&inserted){const entry={id:randomUUID(),plan_code:inserted.plan_code,expires_at:new Date(Date.now()+1800000).toISOString(),consumed_at:null};selections.set(entry.id,entry);return {data:entry,error:null};}return {data:business,error:null};} };
    return chain;
  });
  (supabaseAdmin.rpc as jest.Mock).mockImplementation(async(name:string,args:any)=>{
    if(name==='create_owner_session'){
      if(args.p_previous_hash){const old=rows.get(args.p_previous_hash);if(old?.user_id===args.p_user_id)old.revoked_at=new Date().toISOString();}
      rows.set(args.p_hash,{session_hash:args.p_hash,user_id:args.p_user_id,scope:args.p_scope,encrypted_tokens:args.p_tokens,
        token_expires_at:args.p_token_expires_at,expires_at:args.p_expires_at,created_at:new Date().toISOString(),last_seen_at:new Date().toISOString(),revoked_at:null});
      return {data:true,error:null};
    }
    if(name==='revoke_owner_sessions'){
      for(const row of rows.values())if(row.user_id===args.p_user_id&&(!args.p_hash||row.session_hash===args.p_hash)){row.revoked_at=new Date().toISOString();row.encrypted_tokens='';}
      return {data:null,error:null};
    }
    if(name==='reserve_owner_auth_attempt') return {data:true,error:null};
    if(name==='reserve_shared_request') return {data:true,error:null};
    if(name==='owner_schedule_account_deletion')return args.p_confirm_business_id===business.id?{data:new Date(Date.now()+30*86400000).toISOString(),error:null}:{data:null,error:{message:'OWNER_CONFIRMATION_REQUIRED'}};
    if(name==='start_owner_registration')return {data:duplicate?null:randomUUID(),error:null};
    if(name==='bind_owner_registration')return {data:true,error:null};
    if(name==='provision_owner_account')return deniedProvision?{data:null,error:{message:'INVALID_REGISTRATION_INTENT'}}:{data:business.id,error:null};
    if(name==='business_is_account_active')return {data:true,error:null};
    if(name==='business_entitlement_snapshot')return {data:{plan:{code:'FREE',name:'Free'},subscription:{status:'active',provider:null},
      entitlements:{MAX_PRODUCTS:10,MAX_CATEGORIES:4,MAX_VIDEOS:1},usage:{products:0,categories:0,videos:0}},error:null};
    return {data:null,error:null};
  });
});
async function login(api:express.Express) {
  const result=await request(api).post('/api/v1/auth/login').set('Origin',origin).send({email:user.email,password:'StrongPassword123!'});
  return {result,cookie:result.headers['set-cookie']?.[0]?.split(';')[0],csrf:result.body.data?.csrfToken};
}
describe('Owner BFF session and authentication boundaries',()=>{
  it('me cannot switch usage/plan/tenant through query parameters or forged feature headers',async()=>{
    const api=app();const {cookie}=await login(api);
    const r=await request(api).get('/api/v1/auth/me?businessId=business-b&planCode=PRO').set('Cookie',cookie).set('X-Plan','PRO');
    expect(r.status).toBe(200);expect(r.body.data.business.id).toBe(business.id);expect(r.body.data.plan.code).toBe('FREE');
    expect(r.body.data.usage).toEqual({products:0,categories:0,videos:0});
  });
  it('valid login sets HttpOnly cookie and /me returns account data without credentials',async()=>{
    const api=app();const {result,cookie}=await login(api);
    expect(result.status).toBe(200);expect(result.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(result.headers['set-cookie'][0]).toContain('SameSite=Lax');
    const me=await request(api).get('/api/v1/auth/me').set('Cookie',cookie);
    expect(me.body.data).toMatchObject({emailVerified:true,plan:{code:'FREE'},subscription:{status:'active'},usage:{products:0}});
    for(const response of [result,me])expect(JSON.stringify(response.body)).not.toMatch(/server-only-|access_token|refresh_token|accessToken|refreshToken/);
    expect([...rows.values()][0].encrypted_tokens).not.toContain(secrets.refresh_token);
  });
  it('invalid password and unconfirmed email use the same rejection contract',async()=>{
    provider.signInWithPassword.mockResolvedValue({data:{user:null,session:null},error:{code:'invalid_credentials'}});
    const first=await login(app());expect(first.result.status).toBe(401);
    provider.signInWithPassword.mockResolvedValue({data:{user:{...user,email_confirmed_at:null},session:null},error:{code:'email_not_confirmed'}});
    const second=await login(app());expect(second.result.body.error.code).toBe(first.result.body.error.code);
    expect(second.result.headers['set-cookie']).toBeUndefined();
  });
  it('persistent rate limit denies password authentication before calling Supabase Auth',async()=>{
    (supabaseAdmin.rpc as jest.Mock).mockResolvedValueOnce({data:false,error:null});
    const {result}=await login(app());expect(result.status).toBe(429);expect(provider.signInWithPassword).not.toHaveBeenCalled();
  });
  it('login rejects missing Origin, suffix spoofing and cross-site fetch metadata',async()=>{
    for(const invalidOrigin of ['',origin+'.evil.test']){
      const attempt=request(app()).post('/api/v1/auth/login');if(invalidOrigin)attempt.set('Origin',invalidOrigin);
      const response=await attempt.send({email:user.email,password:'StrongPassword123!'});expect(response.status).toBe(403);
    }
    const response=await request(app()).post('/api/v1/auth/login').set('Origin',origin).set('Sec-Fetch-Site','cross-site').send({email:user.email,password:'StrongPassword123!'});
    expect(response.status).toBe(403);expect(provider.signInWithPassword).not.toHaveBeenCalled();
  });
  it('mutations and logout require the session-bound CSRF token',async()=>{
    const api=app();const {cookie,csrf}=await login(api);
    const missing=await request(api).post('/api/v1/auth/logout').set('Origin',origin).set('Cookie',cookie);
    expect(missing.status).toBe(403);expect(missing.body.error.code).toBe('CSRF_INVALID');
    const valid=await request(api).post('/api/v1/owner-operation').set('Origin',origin).set('Cookie',cookie).set('X-CSRF-Token',csrf);
    expect(valid.status).toBe(200);
    const logout=await request(api).post('/api/v1/auth/logout').set('Origin',origin).set('Cookie',cookie).set('X-CSRF-Token',csrf);
    expect(logout.status).toBe(204);expect((await request(api).get('/api/v1/auth/me').set('Cookie',cookie)).status).toBe(401);
  });
  it('logout-all revokes two independently created sessions',async()=>{
    const api=app();const first=await login(api),second=await login(api);
    expect(rows.size).toBe(2);
    expect((await request(api).post('/api/v1/auth/logout-all').set('Origin',origin).set('Cookie',first.cookie).set('X-CSRF-Token',first.csrf)).status).toBe(204);
    expect((await request(api).get('/api/v1/auth/me').set('Cookie',second.cookie)).status).toBe(401);
    expect(supabaseAdmin.auth.admin.signOut).toHaveBeenCalledWith(secrets.access_token,'global');
  });
  it.each(['expiry','idle','revocation'])('rejects %s',async(kind)=>{
    const api=app();const {cookie}=await login(api);const row=[...rows.values()][0];
    if(kind==='expiry')row.expires_at=new Date(Date.now()-1000).toISOString();
    if(kind==='idle')row.last_seen_at=new Date(Date.now()-31*60_000).toISOString();
    if(kind==='revocation')row.revoked_at=new Date().toISOString();
    expect((await request(api).get('/api/v1/auth/me').set('Cookie',cookie)).status).toBe(401);
  });
  it('reauthentication rotates the cookie and revokes the previous session',async()=>{
    const api=app();const old=await login(api);
    const fresh=await request(api).post('/api/v1/auth/login').set('Origin',origin).set('Cookie',old.cookie).send({email:user.email,password:'StrongPassword123!'});
    expect(fresh.headers['set-cookie'][0].split(';')[0]).not.toBe(old.cookie);
    expect((await request(api).get('/api/v1/auth/me').set('Cookie',old.cookie)).status).toBe(401);
  });
  it('Secure host-only cookie in production and encryption resists substitution',()=>{
    process.env.NODE_ENV='production';expect(ownerCookieOptions()).toMatchObject({httpOnly:true,secure:true,path:'/',sameSite:'lax'});
    const encrypted=encryptOwnerTokens({accessToken:'secret',refreshToken:'refresh'},'a'.repeat(64));
    expect(()=>decryptOwnerTokens(encrypted,'b'.repeat(64))).toThrow();
    expect(()=>decryptOwnerTokens(encrypted.slice(0,-5),'a'.repeat(64))).toThrow();
  });
  it('recovery cookie cannot call /me or owner operations; reset revokes owner sessions',async()=>{
    const api=app();const old=await login(api);
    const callback=await request(api).get('/api/v1/auth/recover?token_hash='+('a'.repeat(64)));
    const cookie=callback.headers['set-cookie'][0].split(';')[0];expect(callback.status).toBe(303);
    expect((await request(api).get('/api/v1/auth/me').set('Cookie',cookie)).status).toBe(403);
    const recovery=await request(api).get('/api/v1/auth/recovery-session').set('Cookie',cookie);
    const reset=await request(api).post('/api/v1/auth/reset-password').set('Origin',origin).set('Cookie',cookie).set('X-CSRF-Token',recovery.body.data.csrfToken).send({password:'NewPassword123!'});
    expect(reset.status).toBe(204);expect((await request(api).get('/api/v1/auth/me').set('Cookie',old.cookie)).status).toBe(401);
  });
});
describe('Owner commercial journey and account operations',()=>{
  it('publishes provisional prices and exact limits with paid checkout disabled',async()=>{
    const r=await request(app()).get('/api/v1/auth/plans');expect(r.status).toBe(200);
    expect(r.body.data.billingAvailable).toBe(false);expect(r.body.data.pricesProvisional).toBe(true);
    expect(r.body.data.plans.map((p:any)=>[p.code,p.products,p.categories,p.videos,p.priceCents,p.available])).toEqual([
      ['FREE',10,4,1,0,true],['BASIC',30,10,7,2990,false],['MEDIUM',70,25,25,5990,false],['PRO',150,40,40,9990,false]]);
  });
  it('rejects every paid plan and injected entitlements before creating a selection',async()=>{
    for(const planCode of ['BASIC','MEDIUM','PRO'])expect((await request(app()).post('/api/v1/auth/plan-intents').set('Origin',origin).send({planCode})).status).toBe(409);
    expect((await request(app()).post('/api/v1/auth/plan-intents').set('Origin',origin).send({planCode:'FREE',entitlements:{QR_GENERATOR:true}})).status).toBe(400);
    expect(selections.size).toBe(0);
  });
  it('requires a valid unconsumed server intent and explicit terms for the new signup',async()=>{
    const api=app();const selected=await request(api).post('/api/v1/auth/plan-intents').set('Origin',origin).send({planCode:'FREE'});
    expect(selected.status).toBe(201);const intentId=selected.body.data.id;
    expect((await request(api).get('/api/v1/auth/plan-intents/'+intentId)).body.data.plan.code).toBe('FREE');
    const body={email:'signup@example.test',password:'StrongPassword123!',fullName:'Owner',businessName:'Business',slug:'business-slug',intentId};
    expect((await request(api).post('/api/v1/auth/register').set('Origin',origin).send(body)).status).toBe(400);
    expect((await request(api).post('/api/v1/auth/register').set('Origin',origin).send({...body,termsAccepted:true})).status).toBe(202);
    expect((await request(api).post('/api/v1/auth/register').set('Origin',origin).send({...body,termsAccepted:true})).status).toBe(410);
    expect((await request(api).get('/api/v1/auth/plan-intents/'+intentId)).status).toBe(410);
    expect(selections.get(intentId).terms_version).toBe('2026-10');
  });
  it('password change requires CSRF and current password then revokes all BFF sessions',async()=>{
    const api=app();const first=await login(api),second=await login(api);
    const body={currentPassword:'StrongPassword123!',password:'DifferentStrongPassword1!'};
    expect((await request(api).post('/api/v1/auth/change-password').set('Origin',origin).set('Cookie',first.cookie).send(body)).status).toBe(403);
    provider.signInWithPassword.mockResolvedValueOnce({data:{user:null,session:null},error:{code:'invalid'}});
    expect((await request(api).post('/api/v1/auth/change-password').set('Origin',origin).set('Cookie',first.cookie).set('X-CSRF-Token',first.csrf).send(body)).status).toBe(400);
    expect(provider.updateUser).not.toHaveBeenCalled();
    expect((await request(api).post('/api/v1/auth/change-password').set('Origin',origin).set('Cookie',first.cookie).set('X-CSRF-Token',first.csrf).send(body)).status).toBe(204);
    expect((await request(api).get('/api/v1/auth/me').set('Cookie',second.cookie)).status).toBe(401);
  });
  it('deletion derives actor from session, denies forged ownership and requires explicit confirmation',async()=>{
    const api=app();const {cookie,csrf}=await login(api);const body={currentPassword:'StrongPassword123!',confirmBusinessId:business.id,confirmation:'EXCLUIR'};
    const send=(b:any)=>request(api).post('/api/v1/auth/delete-account').set('Origin',origin).set('Cookie',cookie).set('X-CSRF-Token',csrf).send(b);
    expect((await send({...body,confirmation:'DELETE'})).status).toBe(400);
    expect((await send({...body,userId:user.id})).status).toBe(400);
    expect((await send({...body,confirmBusinessId:randomUUID()})).status).toBe(409);
    const r=await send(body);expect(r.status).toBe(200);expect(r.body.data.status).toBe('PENDING_DELETION');
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('owner_schedule_account_deletion',{p_user_id:user.id,p_confirm_business_id:business.id});
  });
});
describe('Public Free signup and Supabase confirmation',()=>{
  const body={email:'new@example.test',password:'StrongPassword123!',fullName:'New Owner',businessName:'New Business',slug:'new-owner'};
  it('stores a server intent and never auto-confirms or provisions signup',async()=>{
    const response=await request(app()).post('/api/v1/auth/register').set('Origin',origin).send(body);
    expect(response.status).toBe(202);
    expect(provider.signUp).toHaveBeenCalledWith({email:body.email,password:body.password,options:{emailRedirectTo:process.env.OWNER_AUTH_CALLBACK_URL}});
    expect(supabaseAdmin.rpc).not.toHaveBeenCalledWith('provision_owner_account',expect.anything());
    expect(response.headers['set-cookie']).toBeUndefined();
  });
  it('duplicate email returns the same public response without binding or replacing an identity',async()=>{
    const api=app();const first=await request(api).post('/api/v1/auth/register').set('Origin',origin).send(body);
    duplicate=true;const second=await request(api).post('/api/v1/auth/register').set('Origin',origin).send(body);
    expect(second.status).toBe(202);expect(second.body).toEqual(first.body);expect(provider.signUp).toHaveBeenCalledTimes(1);
  });
  it('browser plan_id is rejected and public PRO is unavailable',async()=>{
    const api=app();const forged=await request(api).post('/api/v1/auth/register').set('Origin',origin).send({...body,plan_id:randomUUID()});
    expect(forged.status).toBe(400);
    const paid=await request(api).post('/api/v1/auth/register').set('Origin',origin).send({...body,planCode:'PRO'});
    expect(paid.status).toBe(409);expect(paid.body.error.code).toBe('PAID_PLAN_UNAVAILABLE');expect(provider.signUp).not.toHaveBeenCalled();
  });
  it('callback repetition is safe: OTP verified by Supabase and finalization never duplicates content',async()=>{
    const api=app();provider.verifyOtp.mockResolvedValueOnce({data:{user,session:secrets},error:null})
      .mockResolvedValueOnce({data:{user:null,session:null},error:{code:'otp_expired'}});
    const path='/api/v1/auth/confirm-email?token_hash='+('a'.repeat(64));
    const first=await request(api).get(path),second=await request(api).get(path);
    expect(first.status).toBe(303);expect(first.headers.location).toContain('confirmation=success');
    expect(second.headers.location).toContain('invalid_or_used');expect(first.headers['set-cookie']).toBeUndefined();
    expect((supabaseAdmin.rpc as jest.Mock).mock.calls.filter(([name])=>name==='provision_owner_account')).toHaveLength(1);
  });
  it('forged registration intent cannot be used to finalize another account',async()=>{
    deniedProvision=true;const response=await request(app()).get('/api/v1/auth/confirm-email?token_hash='+('a'.repeat(64))+'&intent_id='+randomUUID());
    expect(response.status).toBe(303);expect(response.headers.location).toContain('confirmation=pending');
  });
  it('fails closed if Supabase email confirmation is disabled',async()=>{
    provider.signUp.mockResolvedValue({data:{user:{...user,identities:[{}]},session:secrets},error:null});
    const response=await request(app()).post('/api/v1/auth/register').set('Origin',origin).send(body);
    expect(response.status).toBe(503);expect(response.body.error.code).toBe('EMAIL_CONFIRMATION_REQUIRED');
  });
  it('expired email link never creates a session',async()=>{
    provider.verifyOtp.mockResolvedValue({data:{user:null,session:null},error:{code:'otp_expired'}});
    const response=await request(app()).get('/api/v1/auth/confirm-email?token_hash='+('a'.repeat(64)));
    expect(response.status).toBe(303);expect(response.headers['set-cookie']).toBeUndefined();expect(rows.size).toBe(0);
  });
});
