-- Run on a disposable database after the third Admin migration.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;
SELECT no_plan();

SELECT has_column('public','business_account_state','sessions_revoked_at',
  'customer session cutoff exists');
SELECT is((SELECT column_default FROM information_schema.columns
  WHERE table_schema='public' AND table_name='business_account_state'
    AND column_name='is_published'),'false',
  'new accounts start unpublished');
SELECT ok(NOT has_function_privilege('authenticated',
  'public.admin_dashboard_report(timestamptz,timestamptz,text,text,timestamptz,timestamptz)',
  'EXECUTE'),'customer cannot call aggregate analytics');
SELECT ok(NOT has_function_privilege('authenticated',
  'public.admin_business_list(text,text,text,text,boolean,timestamptz,timestamptz,integer,integer)',
  'EXECUTE'),'customer cannot enumerate all businesses');
SELECT ok(NOT has_function_privilege('authenticated',
  'public.admin_revoke_customer_sessions(uuid,uuid)','EXECUTE'),
  'customer cannot revoke sessions');
SELECT ok(NOT has_function_privilege('authenticated',
  'public.publish_business_menu(uuid,uuid)','EXECUTE'),
  'customer cannot publish through privileged RPC');

SET LOCAL ROLE service_role;
SELECT ok(public.admin_dashboard_report(now()-interval '7 days',now(),'UTC','day')
  ?& ARRAY['snapshot','period','attention','funnel','series','templates','timings'],
  'aggregate endpoint returns expected sections');
SELECT ok(public.admin_business_list(NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,25)
  ?& ARRAY['rows','total'],'paginated business list returns rows and count');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
