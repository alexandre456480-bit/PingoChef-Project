import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const migration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260924000000_add_video_backend_controls.sql'),
  'utf8'
);
const replacementMigration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260925000000_single_product_video_and_aspect_ratio.sql'),
  'utf8'
);
const server = fs.readFileSync(path.join(root, 'backend/src/server.ts'), 'utf8');
const muxProvider = fs.readFileSync(
  path.join(root, 'backend/src/services/mux-video.service.ts'),
  'utf8'
);
const publicController = fs.readFileSync(
  path.join(root, 'backend/src/controllers/public.controller.ts'),
  'utf8'
);
const frontendIndex = fs.readFileSync(path.join(root, 'frontend/src/index.html'), 'utf8');
const frontendHeaders = fs.readFileSync(path.join(root, 'frontend/public/_headers'), 'utf8');
const vercelConfig = fs.readFileSync(path.join(root, 'frontend/vercel.json'), 'utf8');

describe('Mux backend static security contract', () => {
  it('mounts the raw webhook route before the JSON parser', () => {
    expect(server.indexOf("app.use('/api/v1/webhooks/mux'"))
      .toBeGreaterThan(-1);
    expect(server.indexOf("app.use('/api/v1/webhooks/mux'"))
      .toBeLessThan(server.indexOf('app.use(express.json'));
  });

  it('uses signed playback and a bounded Direct Upload URL', () => {
    expect(muxProvider).toContain("playback_policies: ['signed']");
    expect(muxProvider).toContain('timeout: input.timeoutSeconds');
    expect(muxProvider).toContain('cors_origin: input.corsOrigin');
    expect(muxProvider).toContain('`pingo-media:${input.mediaId}`');
    expect(muxProvider).toContain("type: 'video'");
    expect(muxProvider).toContain('expiration: `${ttlSeconds}s`');
  });

  it('keeps administrative Mux identifiers out of the public menu projection', () => {
    expect(publicController).not.toMatch(/mux_(?:upload|asset|playback)_id/);
    expect(publicController).not.toContain('owner_user_id');
  });

  it('ships a restrictive CSP for Mux playback without wildcard script or frame sources', () => {
    for (const policy of [frontendIndex, frontendHeaders, vercelConfig]) {
      expect(policy).toContain("media-src 'self' blob: https://*.mux.com");
      expect(policy).toContain("frame-src 'none'");
      expect(policy).not.toMatch(/script-src[^;]*\*/);
      expect(policy).not.toMatch(/frame-src[^;]*\*/);
    }
    expect(frontendHeaders).toContain("frame-ancestors 'none'");
    expect(vercelConfig).toContain("frame-ancestors 'none'");
  });

  it('atomically locks quota reservation and never stores raw webhook payloads or IPs', () => {
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain('p_ip_hash');
    expect(migration).not.toMatch(/\bip_address\b/i);
    expect(migration).not.toMatch(/\braw_payload\b/i);
  });

  it('denies direct access to control tables and RPCs', () => {
    expect(migration).toContain('ALTER TABLE public.video_upload_attempts FORCE ROW LEVEL SECURITY');
    expect(migration).toContain('ALTER TABLE public.mux_webhook_events FORCE ROW LEVEL SECURITY');
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.reserve_video_upload[\s\S]*FROM PUBLIC, anon, authenticated/i);
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.claim_mux_webhook_event[\s\S]*TO service_role/i);
  });

  it('enforces a single active product video and finalizes replacements atomically', () => {
    expect(replacementMigration).toContain('product_media_one_ready_video_per_item_uidx');
    expect(replacementMigration).toContain('product_media_one_pending_video_per_item_uidx');
    expect(replacementMigration).toContain('finalize_product_video_ready');
    expect(replacementMigration).toContain("aspect_ratio IN ('16:9', '9:16')");
    expect(replacementMigration).toMatch(/REVOKE ALL ON FUNCTION public\.finalize_product_video_ready[\s\S]*FROM PUBLIC, anon, authenticated/i);
  });
});
