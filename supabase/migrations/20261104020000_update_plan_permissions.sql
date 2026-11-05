-- Update entitlements only. Existing products, videos, selections and subscriptions remain intact.
BEGIN;
INSERT INTO public.plan_feature_definitions(feature_key,value_type,description)
 VALUES('THEMATIC_TEMPLATES','boolean','Publicação de templates temáticos')
 ON CONFLICT(feature_key) DO NOTHING;
INSERT INTO public.plan_entitlements(plan_id,feature_key,value)
 SELECT p.id,e.key,e.value FROM public.plans p CROSS JOIN LATERAL jsonb_each(
  CASE p.code
   WHEN 'FREE' THEN '{"MAX_VIDEOS":0,"VIDEO_UPLOAD":false,"THEMATIC_TEMPLATES":false}'::jsonb
   WHEN 'BASIC' THEN '{"MAX_VIDEOS":5,"VIDEO_UPLOAD":true,"THEMATIC_TEMPLATES":true}'::jsonb
   WHEN 'MEDIUM' THEN '{"MAX_VIDEOS":15,"VIDEO_UPLOAD":true,"THEMATIC_TEMPLATES":true}'::jsonb
   WHEN 'PRO' THEN '{"MAX_VIDEOS":30,"VIDEO_UPLOAD":true,"THEMATIC_TEMPLATES":true}'::jsonb
  END) e WHERE p.code IN ('FREE','BASIC','MEDIUM','PRO')
 ON CONFLICT(plan_id,feature_key) DO UPDATE SET value=EXCLUDED.value;

CREATE FUNCTION public.menu_template_is_thematic(p_key text) RETURNS boolean
 LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT coalesce(p_key IN ('pixel','retro-diner','circuit-tech','soft-wave','nordic-tavern',
 'japanese-izakaya','neon-arcade','tropical-bamboo','mexican-fiesta','sweet-boutique','royal-palace'),false);
$$;
REVOKE ALL ON FUNCTION public.menu_template_is_thematic(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.menu_template_is_thematic(text) TO service_role;

CREATE OR REPLACE FUNCTION public.publish_business_menu(p_business_id uuid,p_owner_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_owner uuid; v_template text;
BEGIN
 PERFORM public.lock_business_capacity(p_business_id);
 SELECT owner_user_id INTO v_owner FROM public.businesses WHERE id=p_business_id;
 IF NOT FOUND OR v_owner<>p_owner_id OR NOT public.business_is_account_active(p_business_id) THEN RETURN false; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.menu_items WHERE business_id=p_business_id) THEN
  RAISE EXCEPTION 'Menu needs a product before publication';
 END IF;
 SELECT template_key INTO v_template FROM public.design_settings WHERE business_id=p_business_id FOR SHARE;
 IF public.menu_template_is_thematic(v_template)
  AND public.business_feature_entitlement(p_business_id,'THEMATIC_TEMPLATES') IS DISTINCT FROM 'true'::jsonb THEN
  RAISE EXCEPTION 'THEMATIC_TEMPLATE_REQUIRES_PLAN';
 END IF;
 UPDATE public.business_account_state SET is_published=true,updated_at=now() WHERE business_id=p_business_id;
 INSERT INTO public.platform_events(business_id,user_id,event_name)
  VALUES(p_business_id,p_owner_id,'MENU_PUBLISHED') ON CONFLICT DO NOTHING;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.publish_business_menu(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.publish_business_menu(uuid,uuid) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
