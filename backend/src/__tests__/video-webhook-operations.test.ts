import express from 'express';
import request from 'supertest';
import { muxWebhookController, reconcileVideosController } from '../controllers/product-video.controller';
import { getMuxVideoProvider } from '../services/mux-video.service';
import { SupabaseProductMediaRepository } from '../repositories/product-media.repository';
import { supabaseAdmin } from '../config/supabase';
import { ProductVideoService } from '../services/product-video.service';
import { syncMuxDeliveryUsage } from '../services/mux-delivery-usage.service';

jest.mock('../services/mux-video.service', () => ({ getMuxVideoProvider: jest.fn() }));
jest.mock('../config/supabase', () => ({ supabaseAdmin: { rpc: jest.fn(async () => ({ data: null, error: null })) } }));
jest.mock('../services/mux-delivery-usage.service', () => ({ syncMuxDeliveryUsage: jest.fn() }));
jest.mock('../middleware/shared-rate-limit.middleware', () => ({ enforceSharedRequest: jest.fn(async () => undefined) }));
jest.mock('../config/video.config', () => ({
  ALLOWED_VIDEO_MIME_TYPES: ['video/mp4'], loadVideoConfig: () => ({ webhookClaimStaleSeconds: 300 })
}));
const app = express(); app.post('/mux', express.raw({ type:'application/json', limit:'1mb' }), muxWebhookController as any);
app.get('/reconcile', reconcileVideosController as any);

describe('Mux webhook error classification', () => {
  it('returns 4xx for invalid signatures and 5xx for verified events during DB outage', async () => {
    const verifyAndUnwrapWebhook = jest.fn().mockRejectedValue(new Error('bad signature'));
    jest.mocked(getMuxVideoProvider).mockReturnValue({ verifyAndUnwrapWebhook } as any);
    const send = () => request(app).post('/mux').set('Content-Type','application/json').set('mux-signature','fixture').send('{"id":"fixture"}');
    const forged = await send(); expect(forged.status).toBe(400); expect(forged.body.error.code).toBe('INVALID_WEBHOOK_SIGNATURE');
    verifyAndUnwrapWebhook.mockResolvedValue({ id: 'event', type:'video.asset.ready', data:{ id:'asset' } });
    const claim = jest.spyOn(SupabaseProductMediaRepository.prototype,'claimWebhook').mockRejectedValue(new Error('database unavailable'));
    const failed = await send(); expect(failed.status).toBe(503); expect(failed.body.error.code).toBe('WEBHOOK_PROCESSING_FAILED');
    claim.mockResolvedValue(false);
    const duplicate = await send(); expect(duplicate.status).toBe(200); expect(duplicate.body.data.status).toBe('duplicate');
    claim.mockRestore();
  });
  it('runs retention before Mux and checkpoints reconciliation when optional delivery usage fails', async () => {
    const previousSecret=process.env.CRON_SECRET,previousUsage=process.env.MUX_USAGE_SYNC_ENABLED;
    process.env.CRON_SECRET='c'.repeat(32);process.env.MUX_USAGE_SYNC_ENABLED='true';
    const reconcile=jest.spyOn(ProductVideoService.prototype,'reconcile').mockResolvedValue({inspected:1,repaired:1,pending:0,nextUploadPage:2,nextAssetPage:3});
    const rpc=supabaseAdmin.rpc as jest.Mock;
    rpc.mockImplementation(async name=>({error:null,data:name==='claim_video_maintenance'?{uploadPage:1,assetPage:1,usageDay:'2026-01-01',usagePage:1}:name==='finish_video_maintenance'?true:null}));
    jest.mocked(syncMuxDeliveryUsage).mockRejectedValue(new Error('optional provider permission denied'));
    try {
      const response=await request(app).get('/reconcile').set('Authorization','Bearer '+'c'.repeat(32));
      expect(response.status).toBe(200);expect(response.body.data.usageStatus).toBe('unavailable');
      const retentionIndex=rpc.mock.calls.findIndex(call=>call[0]==='maintain_video_security_state');
      expect(rpc.mock.invocationCallOrder[retentionIndex]).toBeLessThan(reconcile.mock.invocationCallOrder[0]);
      expect(rpc).toHaveBeenCalledWith('finish_video_maintenance',expect.objectContaining({p_upload_page:2,p_asset_page:3}));
    } finally {
      reconcile.mockRestore();
      if(previousSecret===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=previousSecret;
      if(previousUsage===undefined)delete process.env.MUX_USAGE_SYNC_ENABLED;else process.env.MUX_USAGE_SYNC_ENABLED=previousUsage;
    }
  });
});
