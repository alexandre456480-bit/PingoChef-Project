import fs from 'node:fs';
import path from 'node:path';

const repositoryRoot = path.resolve(__dirname, '../../..');
const migrationPath = path.join(
  repositoryRoot,
  'supabase',
  'migrations',
  '20260923000000_add_product_media.sql'
);
const rlsTestPath = path.join(
  repositoryRoot,
  'supabase',
  'tests',
  'product_media_rls.test.sql'
);

describe('product_media migration contract', () => {
  const migration = fs.readFileSync(migrationPath, 'utf8');
  const rlsTest = fs.readFileSync(rlsTestPath, 'utf8');

  it('enforces tenant and product coherence with a composite foreign key', () => {
    expect(migration).toMatch(/UNIQUE\s*\(business_id, id\)/i);
    expect(migration).toMatch(
      /FOREIGN KEY\s*\(business_id, menu_item_id\)\s*REFERENCES public\.menu_items\(business_id, id\)/i
    );
  });

  it('keeps provider state constrained and blocks ready Mux media over 15 seconds', () => {
    expect(migration).toContain("media_type IN ('image', 'video')");
    expect(migration).toContain("source IN ('storage', 'mux', 'external')");
    expect(migration).toContain("provider IN ('supabase', 'mux', 'youtube', 'vimeo')");
    expect(migration).toMatch(/source = 'mux'[\s\S]*duration_seconds <= 15/i);
    expect(migration).toContain("CHECK (NOT is_published OR status = 'ready')");
  });

  it('uses partial unique indexes for all Mux identifiers', () => {
    for (const column of ['mux_upload_id', 'mux_asset_id', 'mux_playback_id']) {
      expect(migration).toMatch(
        new RegExp(`CREATE UNIQUE INDEX[\\s\\S]*ON public\\.product_media \\(${column}\\)[\\s\\S]*WHERE ${column} IS NOT NULL`, 'i')
      );
    }
  });

  it('enables forced RLS and exposes no direct anonymous access', () => {
    expect(migration).toContain('ALTER TABLE public.product_media ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('ALTER TABLE public.product_media FORCE ROW LEVEL SECURITY');
    expect(migration).toContain('CREATE POLICY product_media_owner_select');
    expect(migration).toContain('REVOKE ALL ON TABLE public.product_media FROM anon');
    expect(migration).not.toMatch(/GRANT\s+SELECT[\s\S]*TO\s+anon/i);
  });

  it('keeps client writes behind the BFF service role', () => {
    expect(migration).toContain('REVOKE ALL ON TABLE public.product_media FROM authenticated');
    expect(migration).toContain('GRANT SELECT ON TABLE public.product_media TO authenticated');
    expect(migration).toContain(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.product_media TO service_role'
    );
  });

  it('ships executable isolation coverage for both tenants and anon', () => {
    expect(rlsTest).toContain("'owner A cannot discover owner B media'");
    expect(rlsTest).toContain("'owner A cannot insert media for owner B'");
    expect(rlsTest).toContain("'owner A cannot update owner B media'");
    expect(rlsTest).toContain("'owner A cannot delete owner B media'");
    expect(rlsTest).toContain("'anonymous clients have no direct table access'");
    expect(rlsTest).toContain("'23503'");
  });
});

