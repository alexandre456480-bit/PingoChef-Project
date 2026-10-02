-- Run on a disposable Supabase database after both admin migrations.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;
SELECT no_plan();

INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,
  recovery_token,email_change,email_change_token_new)
SELECT id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',email,'',now(),
  '{"provider":"email","providers":["email"]}','{}',now(),now(),'','','',''
FROM (VALUES
  ('81000000-0000-0000-0000-000000000001'::uuid,'phase1-owner-a@example.test'),
  ('81000000-0000-0000-0000-000000000002'::uuid,'phase1-owner-b@example.test'),
  ('81000000-0000-0000-0000-000000000003'::uuid,'phase1-admin@example.test')) v(id,email);
INSERT INTO public.profiles(id,full_name) VALUES
  ('81000000-0000-0000-0000-000000000001','Owner A'),
  ('81000000-0000-0000-0000-000000000002','Owner B');
INSERT INTO public.admin_identities(user_id) VALUES ('81000000-0000-0000-0000-000000000003');
INSERT INTO public.businesses(id,owner_user_id,name,slug,status) VALUES
  ('82000000-0000-0000-0000-000000000001','81000000-0000-0000-0000-000000000001','A','phase1-a','ACTIVE'),
  ('82000000-0000-0000-0000-000000000002','81000000-0000-0000-0000-000000000002','B','phase1-b','ACTIVE');
INSERT INTO public.subscriptions(business_id,status,current_period_end) VALUES
  ('82000000-0000-0000-0000-000000000001','active',now() + interval '1 month'),
  ('82000000-0000-0000-0000-000000000002','active',now() + interval '1 month');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"81000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
SELECT is((SELECT count(id)::integer FROM public.subscriptions),1,'owner sees one own subscription');
SELECT is((SELECT business_id::text FROM public.subscriptions LIMIT 1),
  '82000000-0000-0000-0000-000000000001','owner A cannot see owner B subscription');
SELECT is((SELECT count(id)::integer FROM public.subscription_adjustments),0,'owner sees no foreign adjustments');
SELECT throws_ok($$ SELECT count(*) FROM public.admin_audit_log $$,'42501',NULL,
  'owner cannot read admin audit');
SELECT throws_ok($$ SELECT count(*) FROM public.customer_invitations $$,'42501',NULL,
  'owner cannot read invitations');
SELECT throws_ok($$ SELECT count(*) FROM public.platform_events $$,'42501',NULL,
  'owner cannot read platform analytics');
SELECT throws_ok($$ UPDATE public.subscriptions SET status='active' $$,'42501',NULL,
  'owner cannot mutate subscriptions');
SELECT set_config('request.jwt.claims',
  '{"sub":"81000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
SELECT is((SELECT count(id)::integer FROM public.subscriptions),1,
  'second owner sees only the second subscription');
SELECT is((SELECT business_id::text FROM public.subscriptions LIMIT 1),
  '82000000-0000-0000-0000-000000000002','owner B cannot see owner A subscription');
RESET ROLE;

SET LOCAL ROLE anon;
SELECT throws_ok($$ SELECT count(*) FROM public.subscriptions $$,'42501',NULL,
  'anonymous cannot read subscriptions');
SELECT throws_ok($$ SELECT count(*) FROM public.admin_identities $$,'42501',NULL,
  'anonymous cannot read admin identities');
RESET ROLE;

SET LOCAL ROLE service_role;
SELECT is((SELECT count(*)::integer FROM public.subscriptions),2,
  'backend sees both subscriptions');
SELECT ok(public.set_business_lifecycle('81000000-0000-0000-0000-000000000003',
  '82000000-0000-0000-0000-000000000001','SUSPENDED','Review',30),
  'admin suspends account');
SELECT is(public.business_is_publicly_eligible('82000000-0000-0000-0000-000000000001'),false,
  'suspension blocks public access');
SELECT ok(public.set_business_lifecycle('81000000-0000-0000-0000-000000000003',
  '82000000-0000-0000-0000-000000000001','ACTIVE',NULL,30),
  'admin reactivates account');
SELECT is(public.business_is_publicly_eligible('82000000-0000-0000-0000-000000000001'),true,
  'reactivation restores public access');
SELECT ok(public.admin_transition_business('81000000-0000-0000-0000-000000000003',
  '82000000-0000-0000-0000-000000000001','ACTIVE_OR_SUSPENDED',
  'PENDING_DELETION',NULL,30),'admin schedules deletion');
SELECT is(public.business_is_publicly_eligible('82000000-0000-0000-0000-000000000001'),false,
  'pending deletion blocks public access');
SELECT is(public.admin_cancel_business_deletion('81000000-0000-0000-0000-000000000003',
  '82000000-0000-0000-0000-000000000001'),'ACTIVE','admin recovers account');
SELECT ok(public.set_business_lifecycle('81000000-0000-0000-0000-000000000003',
  '82000000-0000-0000-0000-000000000001','SUSPENDED','Review',30),
  'second suspension succeeds');
SELECT ok(public.admin_transition_business('81000000-0000-0000-0000-000000000003',
  '82000000-0000-0000-0000-000000000001','ACTIVE_OR_SUSPENDED',
  'PENDING_DELETION',NULL,30),'suspended account can be scheduled for deletion');
SELECT is(public.admin_cancel_business_deletion('81000000-0000-0000-0000-000000000003',
  '82000000-0000-0000-0000-000000000001'),'SUSPENDED',
  'cancellation restores prior suspension');
SELECT set_config('request.headers',
  '{"x-admin-client-ip":"203.0.113.7","x-admin-user-agent":"phase1-test","x-admin-request-id":"83000000-0000-0000-0000-000000000001"}',true);
SELECT isnt(public.grant_free_days('81000000-0000-0000-0000-000000000003',
  '82000000-0000-0000-0000-000000000001',30,'Commercial courtesy'),NULL::uuid,
  'free days adjustment recorded');
SELECT is((SELECT count(*)::integer FROM public.admin_audit_log
  WHERE action='FREE_PERIOD_GRANTED' AND target_id='82000000-0000-0000-0000-000000000001'),1,
  'free period audit is atomic');
SELECT is((SELECT request_id::text FROM public.admin_audit_log
  WHERE action='FREE_PERIOD_GRANTED' AND target_id='82000000-0000-0000-0000-000000000001'),
  '83000000-0000-0000-0000-000000000001','request ID is captured in audit');
SELECT is((SELECT count(*)::integer FROM public.subscription_adjustments
  WHERE business_id='82000000-0000-0000-0000-000000000001'),1,
  'free period has history');
UPDATE public.commercial_settings SET billing_enforced = true WHERE singleton;
UPDATE public.subscriptions SET status = 'canceled';
SELECT is(public.business_is_commercially_eligible('82000000-0000-0000-0000-000000000001'),true,
  'free adjustment grants commercial eligibility');
SELECT is(public.business_is_commercially_eligible('82000000-0000-0000-0000-000000000002'),false,
  'other tenant receives no free entitlement');
SELECT is(public.business_is_publicly_eligible('82000000-0000-0000-0000-000000000001'),false,
  'administrative suspension overrides free days');

INSERT INTO public.customer_invitations(code_hash,email,created_by,expires_at,status) VALUES
  ('expired-phase1','expired@example.test','81000000-0000-0000-0000-000000000003',now()-interval '1 day','ISSUED'),
  ('revoked-phase1','revoked@example.test','81000000-0000-0000-0000-000000000003',now()+interval '1 day','REVOKED'),
  ('used-phase1','used@example.test','81000000-0000-0000-0000-000000000003',now()+interval '1 day','CONSUMED'),
  ('race-phase1','race@example.test','81000000-0000-0000-0000-000000000003',now()+interval '1 day','ISSUED'),
  ('limited-phase1','limited@example.test','81000000-0000-0000-0000-000000000003',now()+interval '1 day','ISSUED');
SELECT is(public.reserve_customer_invitation('expired-phase1','expired@example.test'),NULL::uuid,
  'expired invitation cannot reserve');
SELECT is(public.reserve_customer_invitation('revoked-phase1','revoked@example.test'),NULL::uuid,
  'revoked invitation cannot reserve');
SELECT is(public.reserve_customer_invitation('used-phase1','used@example.test'),NULL::uuid,
  'consumed invitation cannot reserve');
SELECT isnt(public.reserve_customer_invitation('race-phase1','race@example.test'),NULL::uuid,
  'first reservation succeeds');
SELECT is(public.reserve_customer_invitation('race-phase1','race@example.test'),NULL::uuid,
  'second reservation fails while first holds it');
SELECT public.reserve_customer_invitation('limited-phase1','wrong@example.test');
SELECT public.reserve_customer_invitation('limited-phase1','wrong@example.test');
SELECT public.reserve_customer_invitation('limited-phase1','wrong@example.test');
SELECT public.reserve_customer_invitation('limited-phase1','wrong@example.test');
SELECT public.reserve_customer_invitation('limited-phase1','wrong@example.test');
SELECT is(public.reserve_customer_invitation('limited-phase1','limited@example.test'),NULL::uuid,
  'per-code attempt ceiling prevents further use');
DO $$ BEGIN
  FOR i IN 1..5 LOOP
    PERFORM public.reserve_admin_login_attempt(repeat('a',64));
  END LOOP;
END $$;
SELECT is(public.reserve_admin_login_attempt(repeat('a',64)),NULL::bigint,
  'database enforces admin login limit after five attempts');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
