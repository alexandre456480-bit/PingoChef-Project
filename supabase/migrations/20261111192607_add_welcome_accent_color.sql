-- Additive welcome personalization. Existing colors and image choices are preserved.
BEGIN;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS welcome_bg_accent_color text;
ALTER TABLE public.businesses ADD CONSTRAINT businesses_welcome_accent_color_check
 CHECK(welcome_bg_accent_color IS NULL OR welcome_bg_accent_color ~ '^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$');

CREATE OR REPLACE FUNCTION public.menu_transfer_start(p_business_id uuid,p_owner_id uuid,p_kind text,p_parts integer DEFAULT 1)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; doc jsonb; content text; chunks jsonb='[]'; n integer;
BEGIN
 result:=public.menu_transfer_start_without_recommendations(p_business_id,p_owner_id,p_kind,p_parts);
 IF p_kind='export' THEN
  SELECT string_agg(part,'' ORDER BY ord)::jsonb INTO doc FROM public.menu_transfers t,
   jsonb_array_elements_text(t.parts) WITH ORDINALITY x(part,ord) WHERE t.id=(result->>'id')::uuid;
  doc:=jsonb_set(doc,'{business,welcome_bg_accent_color}',coalesce((SELECT to_jsonb(welcome_bg_accent_color) FROM public.businesses WHERE id=p_business_id),'null'::jsonb));
  doc:=doc||jsonb_build_object('productRecommendations',public.product_recommendation_list(p_business_id));
  content:=doc::text;
  IF octet_length(content)>33554432 THEN RAISE EXCEPTION 'MENU_ARCHIVE_TOO_LARGE'; END IF;
  FOR n IN 0..((length(content)-1)/500000) LOOP chunks:=chunks||jsonb_build_array(substr(content,n*500000+1,500000)); END LOOP;
  UPDATE public.menu_transfers SET parts=chunks,expected_parts=jsonb_array_length(chunks),
   summary=jsonb_set(summary,'{bytes}',to_jsonb(octet_length(content))) WHERE id=(result->>'id')::uuid;
  result:=jsonb_set(result,'{parts}',to_jsonb(jsonb_array_length(chunks)));
  result:=jsonb_set(result,'{summary,bytes}',to_jsonb(octet_length(content)));
 END IF;
 RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.menu_transfer_apply(p_business_id uuid,p_owner_id uuid,p_id uuid,p_document jsonb,p_catalog boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; done boolean; r jsonb; target text; n integer;
BEGIN
 PERFORM public.lock_business_capacity(p_business_id);
 SELECT completed INTO done FROM public.menu_transfers WHERE id=p_id AND business_id=p_business_id AND owner_id=p_owner_id FOR UPDATE;
 result:=public.menu_transfer_apply_without_recommendations(p_business_id,p_owner_id,p_id,p_document,p_catalog);
 IF done=false AND (p_document->'business') ? 'welcome_bg_accent_color' THEN
  UPDATE public.businesses SET welcome_bg_accent_color=p_document#>>'{business,welcome_bg_accent_color}' WHERE id=p_business_id AND owner_user_id=p_owner_id;
 END IF;
 IF p_catalog AND done=false THEN
  FOR r IN SELECT value FROM jsonb_array_elements(coalesce(p_document->'productRecommendations','[]')) LOOP
   n:=0;
   FOR target IN SELECT jsonb_array_elements_text(r->'recommendedProductIds') LOOP
    n:=n+1;
    INSERT INTO public.product_recommendations(business_id,trigger_product_id,recommended_product_id,position)
     VALUES(p_business_id,(r->>'triggerProductId')::uuid,target::uuid,n);
   END LOOP;
  END LOOP;
 END IF;
 RETURN result;
END $$;
-- CREATE OR REPLACE preserves the existing private RPC grants.
NOTIFY pgrst,'reload schema';
COMMIT;
