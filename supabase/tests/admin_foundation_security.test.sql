-- Run with `supabase test db` on a disposable database after migrations.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;
SELECT plan(8);

SELECT has_table('public', 'business_account_state', 'private account state exists');
SELECT has_table('public', 'customer_invitations', 'invitation registry exists');
SELECT has_table('public', 'admin_sessions', 'revocable admin sessions exist');

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
) VALUES (
  '71000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'admin-foundation-owner@example.test', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
);
INSERT INTO public.profiles(id, full_name)
  VALUES ('71000000-0000-0000-0000-000000000001', 'Foundation Owner');
INSERT INTO public.businesses(id, owner_user_id, name, slug, status) VALUES (
  '72000000-0000-0000-0000-000000000001',
  '71000000-0000-0000-0000-000000000001', 'Foundation Business', 'admin-foundation-test', 'ACTIVE'
);

SELECT is(
  (SELECT lifecycle_status FROM public.business_account_state
   WHERE business_id = '72000000-0000-0000-0000-000000000001'),
  'ACTIVE', 'business insert creates its private state'
);
SELECT throws_ok(
  $$ INSERT INTO public.businesses(owner_user_id, name, slug, status)
     VALUES ('71000000-0000-0000-0000-000000000001', 'Second', 'admin-foundation-second', 'ACTIVE') $$,
  '23505', NULL, 'one owner cannot have two businesses'
);

-- Exercise the trigger even if a deployment has broad legacy table grants.
GRANT SELECT, UPDATE ON public.businesses TO authenticated;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"71000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
SELECT throws_ok(
  $$ UPDATE public.businesses SET status = 'SUSPENDED' WHERE id = '72000000-0000-0000-0000-000000000001' $$,
  'P0001', 'Administrative business fields are read-only',
  'owner cannot change legacy status'
);
SELECT throws_ok(
  $$ SELECT count(*) FROM public.business_account_state $$,
  '42501', NULL, 'owner cannot read private account state'
);

RESET ROLE;
UPDATE public.business_account_state SET lifecycle_status = 'SUSPENDED'
  WHERE business_id = '72000000-0000-0000-0000-000000000001';
SELECT is(public.business_is_publicly_eligible('72000000-0000-0000-0000-000000000001'),
  false, 'suspended business is not publicly eligible');
SELECT * FROM finish();
ROLLBACK;
