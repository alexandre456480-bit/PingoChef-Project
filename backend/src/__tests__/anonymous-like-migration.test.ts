import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.resolve(
  __dirname,
  '../../../supabase/migrations/20260925010000_harden_anonymous_likes.sql'
);

describe('anonymous likes migration contract', () => {
  const migration = fs.readFileSync(migrationPath, 'utf8');

  it('enforces one like per visitor and item at database level', () => {
    expect(migration).toMatch(
      /CREATE UNIQUE INDEX[\s\S]*\(business_id, item_id, visitor_hash\)/i
    );
    expect(migration).toMatch(/ON CONFLICT \(business_id, item_id, visitor_hash\) DO NOTHING/i);
  });

  it('stores only validated hashes and enforces tenant-item coherence', () => {
    expect(migration).toMatch(/CHECK \(visitor_hash ~ '\^\[a-f0-9\]\{64\}\$'\)/i);
    expect(migration).toMatch(/FOREIGN KEY \(business_id, item_id\)[\s\S]*menu_items\(business_id, id\)/i);
  });

  it('keeps both the table and RPC unavailable to public roles', () => {
    expect(migration).toContain('ALTER TABLE public.anonymous_likes FORCE ROW LEVEL SECURITY');
    expect(migration).toMatch(/REVOKE ALL ON TABLE public\.anonymous_likes FROM PUBLIC, anon, authenticated/i);
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.increment_likes[\s\S]*PUBLIC, anon, authenticated/i);
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.register_anonymous_like[\s\S]*TO service_role/i);
  });
});
