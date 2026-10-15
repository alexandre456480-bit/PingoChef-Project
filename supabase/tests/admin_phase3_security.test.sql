-- Run on a disposable Supabase database after both phase 3 migrations.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path=public,extensions;
SELECT no_plan();

SELECT ok(NOT has_function_privilege('authenticated',
  'public.apply_verified_billing_event(text,text,text,text,timestamptz,text,text,timestamptz,timestamptz,text)',
  'EXECUTE'),'customer cannot apply a billing webhook');
SELECT ok(NOT has_function_privilege('authenticated',
  'public.claim_due_account_purge(integer)','EXECUTE'),'customer cannot start purge');
SELECT ok(NOT has_function_privilege('authenticated',
  'public.admin_infrastructure_report(timestamptz,timestamptz)','EXECUTE'),
  'customer cannot read infrastructure report');
SELECT ok(NOT has_function_privilege('authenticated',
  'public.admin_commercial_report(timestamptz,timestamptz)','EXECUTE'),
  'customer cannot read commercial report');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$ SELECT count(*) FROM public.billing_webhook_events $$,'42501',NULL,
  'customer cannot read billing webhook metadata');
SELECT throws_ok($$ SELECT count(*) FROM public.account_purge_jobs $$,'42501',NULL,
  'customer cannot read purge jobs');
SELECT throws_ok($$ SELECT count(*) FROM public.api_request_metrics $$,'42501',NULL,
  'customer cannot read operational telemetry');
RESET ROLE;

INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,
  recovery_token,email_change,email_change_token_new)
SELECT id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',email,'',now(),
  '{"provider":"email","providers":["email"]}','{}',now(),now(),'','','',''
FROM (VALUES
  ('91000000-0000-0000-0000-000000000001'::uuid,'phase3-owner@example.test'),
  ('91000000-0000-0000-0000-000000000002'::uuid,'phase3-admin@example.test')) v(id,email);
INSERT INTO public.profiles(id,full_name)
  VALUES('91000000-0000-0000-0000-000000000001','Phase 3 Owner');
INSERT INTO public.admin_identities(user_id)
  VALUES('91000000-0000-0000-0000-000000000002');
INSERT INTO public.businesses(id,owner_user_id,name,slug,status)
  VALUES('92000000-0000-0000-0000-000000000001',
    '91000000-0000-0000-0000-000000000001','Phase 3 Business','phase3-business','ACTIVE');
INSERT INTO public.subscriptions(business_id,status,provider,provider_subscription_id,current_period_end)
  VALUES('92000000-0000-0000-0000-000000000001','pending','example','sub_phase3',now()+interval '1 day');

SET LOCAL ROLE service_role;
SELECT is(public.apply_verified_billing_event('example','event_phase3','subscription.updated',
  repeat('a',64),now()-interval '1 minute','sub_phase3','active',now()+interval '1 month',NULL,'pix'),
  'processed','first verified event changes subscription');
SELECT is(public.apply_verified_billing_event('example','event_phase3','subscription.updated',
  repeat('a',64),now()-interval '1 minute','sub_phase3','active',now()+interval '1 month',NULL,'pix'),
  'duplicate','event ID is idempotent');
SELECT is((SELECT status FROM public.subscriptions WHERE provider_subscription_id='sub_phase3'),
  'active','duplicate did not change status');
SELECT is((SELECT count(*)::integer FROM public.billing_webhook_events
  WHERE provider='example' AND event_id='event_phase3'),1,'one webhook event row');
SELECT is((SELECT count(*)::integer FROM public.subscription_events
  WHERE business_id='92000000-0000-0000-0000-000000000001' AND event_type='CHANGED'),
  1,'duplicate did not duplicate subscription change');
INSERT INTO public.admin_audit_log(actor_user_id,action,target_type,target_id)
  VALUES('91000000-0000-0000-0000-000000000002','admin.login','admin_session',repeat('a',64));
SELECT is((SELECT target_id FROM public.admin_audit_log WHERE target_type='admin_session'
  ORDER BY id DESC LIMIT 1),'91000000-0000-0000-0000-000000000002',
  'session hash is never retained in audit target');
INSERT INTO public.admin_audit_log(actor_user_id,action,target_type,target_id,user_agent)
  VALUES('91000000-0000-0000-0000-000000000002','audit.test','business',
    '92000000-0000-0000-0000-000000000001','Bearer should-not-persist');
SELECT is((SELECT user_agent FROM public.admin_audit_log ORDER BY id DESC LIMIT 1),NULL::text,
  'caller-controlled user agent cannot carry credentials into audit');

UPDATE public.commercial_settings SET billing_enforced=true WHERE singleton;
UPDATE public.subscriptions SET status='past_due',current_period_end=now()-interval '1 day',
  grace_until=now()+interval '1 day' WHERE provider_subscription_id='sub_phase3';
SELECT is(public.advance_subscription_lifecycle(10),1,'maintenance moves past due into grace');
SELECT is((SELECT status FROM public.subscriptions WHERE provider_subscription_id='sub_phase3'),
  'grace','grace state is explicit');
UPDATE public.subscriptions SET grace_until=now()-interval '1 hour'
  WHERE provider_subscription_id='sub_phase3';
SELECT is(public.advance_subscription_lifecycle(10),1,'maintenance suspends after grace');
SELECT is(public.business_is_commercially_eligible('92000000-0000-0000-0000-000000000001'),
  false,'expired subscription cannot bypass commercial eligibility');

UPDATE public.business_account_state SET lifecycle_status='PENDING_DELETION',
  deletion_scheduled_at=now()-interval '1 hour'
  WHERE business_id='92000000-0000-0000-0000-000000000001';
SELECT ok(public.claim_due_account_purge(300) IS NOT NULL,'due purge is claimed');
SELECT is((SELECT phase FROM public.account_purge_jobs
  WHERE business_id='92000000-0000-0000-0000-000000000001'),
  'EXTERNAL','purge job is durable');
SELECT throws_ok($$ UPDATE public.business_account_state SET lifecycle_status='ACTIVE',
  deletion_scheduled_at=NULL WHERE business_id='92000000-0000-0000-0000-000000000001' $$,
  'P0001',NULL,'purge cannot be canceled after worker claim');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
