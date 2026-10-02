import request from 'supertest';
import app from '../server';
import { validateDeploymentEnvironment } from '../config/deployment.config';
import { apiRouteGroup } from '../middleware/api-telemetry.middleware';
import { internalJobAuthorized } from '../middleware/internal-job-auth';
import { BillingSignatureError, registerBillingProvider, type BillingProvider } from '../services/billing-provider';
import { removeMuxPurgeResource } from '../services/account-purge.service';
import type { MuxVideoProvider } from '../services/mux-video.service';

describe('Admin phase 3 hardening',()=>{
  it.each(['/api/v1/admin/commercial','/api/v1/admin/infrastructure'])
    ('rejects a customer bearer token on %s',async path=>{
      const response=await request(app).get(path).set('Authorization','Bearer ordinary-customer-token');
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('ADMIN_UNAUTHORIZED');
    });

  it('keeps operational routes private and public health minimal',async()=>{
    expect((await request(app).post('/api/v1/internal/operations/accounts/purge')).status).toBe(401);
    expect((await request(app).post('/api/v1/internal/operations/billing/maintain')).status).toBe(401);
    const health=await request(app).get('/api/v1/health');
    expect(health.status).toBe(200);
    expect(health.body.data).toEqual({status:'UP'});
  });

  it('requires explicit staging separation from the production Supabase project',()=>{
    const base={NODE_ENV:'production',DEPLOYMENT_ENV:'staging',
      SUPABASE_URL:'https://stagingref123.supabase.co',EXPECTED_SUPABASE_PROJECT_REF:'stagingref123',
      PRODUCTION_SUPABASE_PROJECT_REF:'stagingref123',FRONTEND_ORIGINS:'https://app-staging.pingochef.com',
      ADMIN_ORIGINS:'https://admin-staging.pingochef.com',INTERNAL_JOBS_SECRET:'x'.repeat(32),
      SUPABASE_SERVICE_ROLE_KEY:'x'.repeat(32),SUPABASE_ANON_KEY:'x'.repeat(32),
      INVITATION_HASH_SECRET:'x'.repeat(32),ADMIN_LOGIN_HASH_SECRET:'x'.repeat(32),
      PURGE_STORAGE_BUCKET:'media',API_TELEMETRY_ENABLED:'true',
      PUBLIC_MENU_ORIGIN:'https://app-staging.pingochef.com',
      OWNER_SESSION_ENCRYPTION_KEY:Buffer.alloc(32,7).toString('base64'),
      OWNER_AUTH_CALLBACK_URL:'https://app-staging.pingochef.com/api/v1/auth/confirm-email'} as NodeJS.ProcessEnv;
    expect(()=>validateDeploymentEnvironment(base)).toThrow('Staging cannot use');
    expect(()=>validateDeploymentEnvironment({...base,PRODUCTION_SUPABASE_PROJECT_REF:'productionref123'})).not.toThrow();
    expect(()=>validateDeploymentEnvironment({...base,PRODUCTION_SUPABASE_PROJECT_REF:'productionref123',
      SUPABASE_URL:'https://productionref123.supabase.co'})).toThrow('does not match');
    expect(()=>validateDeploymentEnvironment({...base,PRODUCTION_SUPABASE_PROJECT_REF:'productionref123',
      ADMIN_LOGIN_HASH_SECRET:''})).toThrow('ADMIN_LOGIN_HASH_SECRET is not configured');
    expect(()=>validateDeploymentEnvironment({...base,PRODUCTION_SUPABASE_PROJECT_REF:'productionref123',
      OWNER_AUTH_CALLBACK_URL:'https://wrong-origin.example.test/api/v1/auth/confirm-email'}))
      .toThrow('must use an allowed owner application origin');
  });

  it('never puts tenant identifiers or query strings into API telemetry route groups',()=>{
    expect(apiRouteGroup('/api/v1/admin/businesses/secret-user-id?email=private@example.test'))
      .toBe('/api/v1/admin');
    expect(apiRouteGroup('/api/v1/public/m/tenant-slug')).toBe('/api/v1/public');
    expect(internalJobAuthorized('Bearer '+('a'.repeat(32)),'a'.repeat(32))).toBe(true);
    expect(internalJobAuthorized('Bearer '+('b'.repeat(32)),'a'.repeat(32))).toBe(false);
  });

  it('rejects a forged billing webhook before any normalized event is applied',async()=>{
    const verifyWebhook=jest.fn(async()=>{throw new BillingSignatureError('invalid');});
    const provider:BillingProvider={name:'testsecure',verifyWebhook,
      createCustomer:jest.fn(),createCheckout:jest.fn(),getSubscription:jest.fn(),
      cancelSubscription:jest.fn()};
    registerBillingProvider(provider);
    const response=await request(app).post('/api/v1/webhooks/billing/testsecure')
      .set('Content-Type','application/json').send('{"event":"forged"}');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_WEBHOOK_SIGNATURE');
    expect(verifyWebhook).toHaveBeenCalledTimes(1);
  });

  it('keeps a Mux reference unresolved when provider deletion fails',async()=>{
    const mux={deleteAsset:jest.fn().mockRejectedValue(new Error('provider unavailable')),
      isNotFoundError:jest.fn().mockReturnValue(false)} as unknown as MuxVideoProvider;
    await expect(removeMuxPurgeResource({kind:'MUX_ASSET',reference:'asset-1'},mux))
      .rejects.toThrow('provider unavailable');
    expect(mux.deleteAsset).toHaveBeenCalledWith('asset-1');
  });
});
