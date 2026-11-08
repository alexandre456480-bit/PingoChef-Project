-- Branding is a plan entitlement, never a customer-editable design preference.
BEGIN;
INSERT INTO public.plan_feature_definitions(feature_key,value_type,description)
 VALUES('REMOVE_PINGOCHEF_BRANDING','boolean','Remove marca PingoChef')
 ON CONFLICT(feature_key) DO NOTHING;
INSERT INTO public.plan_entitlements(plan_id,feature_key,value)
 SELECT id,'REMOVE_PINGOCHEF_BRANDING',to_jsonb(code<>'FREE')
 FROM public.plans WHERE code IN ('FREE','BASIC','MEDIUM','PRO')
 ON CONFLICT(plan_id,feature_key) DO UPDATE SET value=EXCLUDED.value;
NOTIFY pgrst,'reload schema';
COMMIT;
