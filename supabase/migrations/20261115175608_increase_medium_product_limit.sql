-- Change only the Medium product entitlement; existing catalogs and other limits are preserved.
BEGIN;
INSERT INTO public.plan_entitlements(plan_id,feature_key,value)
 SELECT id,'MAX_PRODUCTS','85'::jsonb FROM public.plans WHERE code='MEDIUM'
 ON CONFLICT(plan_id,feature_key) DO UPDATE SET value=EXCLUDED.value;
COMMIT;
