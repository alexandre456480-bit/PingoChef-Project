import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

// Explicit opt-in: isolated Supabase database with all migrations through owner phase 1.
const enabled = process.env.RUN_DISPOSABLE_DB_TESTS === '1'
  && Boolean(process.env.TEST_SUPABASE_URL && process.env.TEST_SUPABASE_SERVICE_ROLE_KEY
    && process.env.TEST_ADMIN_ACTOR_ID);

(enabled ? describe : describe.skip)('customer invitation concurrency in disposable DB', () => {
  it('allows exactly one of two simultaneous reservations', async () => {
    const client = createClient(process.env.TEST_SUPABASE_URL!, process.env.TEST_SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const codeHash = randomBytes(32).toString('hex');
    const email = `race-${randomUUID()}@example.test`;
    const { data: invitation, error: insertError } = await client.from('customer_invitations')
      .insert({ code_hash: codeHash, email, created_by: process.env.TEST_ADMIN_ACTOR_ID!,
        expires_at: new Date(Date.now() + 60_000).toISOString() })
      .select('id').single();
    if (insertError || !invitation) throw insertError || new Error('Invitation setup failed');
    try {
      const results = await Promise.all([
        client.rpc('start_owner_registration', { p_email: email, p_full_name: 'Race Owner', p_business_name: 'Race Business',
          p_slug: `race-${randomUUID()}`, p_phone: null, p_plan_code: 'FREE', p_invitation_hash: codeHash }),
        client.rpc('start_owner_registration', { p_email: email, p_full_name: 'Race Owner', p_business_name: 'Race Business',
          p_slug: `race-${randomUUID()}`, p_phone: null, p_plan_code: 'FREE', p_invitation_hash: codeHash })
      ]);
      expect(results.every(result => !result.error)).toBe(true);
      expect(results.filter(result => result.data !== null)).toHaveLength(1);
    } finally {
      const { error } = await client.from('customer_invitations').delete().eq('id', invitation.id);
      if (error) throw error;
    }
  });
});
