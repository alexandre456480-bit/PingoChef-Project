BEGIN;
CREATE TABLE public.product_recommendations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 trigger_product_id uuid NOT NULL,
 recommended_product_id uuid NOT NULL,
 position integer NOT NULL CHECK(position BETWEEN 1 AND 3),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(trigger_product_id<>recommended_product_id),
 UNIQUE(business_id,trigger_product_id,recommended_product_id),
 UNIQUE(business_id,trigger_product_id,position),
 FOREIGN KEY(business_id,trigger_product_id) REFERENCES public.menu_items(business_id,id) ON DELETE CASCADE,
 FOREIGN KEY(business_id,recommended_product_id) REFERENCES public.menu_items(business_id,id) ON DELETE CASCADE
);
CREATE INDEX product_recommendations_target ON public.product_recommendations(business_id,recommended_product_id);
ALTER TABLE public.product_recommendations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.product_recommendations FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.product_recommendations TO authenticated;
GRANT ALL ON public.product_recommendations TO service_role;
CREATE POLICY recommendations_owner_read ON public.product_recommendations FOR SELECT TO authenticated
 USING(public.business_is_account_active(business_id) AND EXISTS(
   SELECT 1 FROM public.businesses b WHERE b.id=business_id AND b.owner_user_id=auth.uid()));

-- Absence means false, including every existing design. No customer setting is overwritten.
ALTER TABLE public.design_settings ADD CONSTRAINT design_cart_recommendations_boolean
 CHECK(custom_config->'cart_recommendations_enabled' IS NULL
   OR jsonb_typeof(custom_config->'cart_recommendations_enabled')='boolean');

CREATE FUNCTION public.replace_product_recommendations(p_business_id uuid,p_owner_id uuid,p_trigger uuid,p_recommended uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM public.lock_business_capacity(p_business_id);
 IF NOT EXISTS(SELECT 1 FROM public.businesses WHERE id=p_business_id AND owner_user_id=p_owner_id)
  OR NOT public.business_is_account_active(p_business_id) THEN RAISE EXCEPTION 'ACCOUNT_NOT_ACTIVE'; END IF;
 PERFORM 1 FROM public.menu_items WHERE business_id=p_business_id AND id=p_trigger FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_NOT_FOUND'; END IF;
 IF p_recommended IS NULL OR cardinality(p_recommended)>3
  OR EXISTS(SELECT 1 FROM unnest(p_recommended) x WHERE x IS NULL OR x=p_trigger)
  OR (SELECT count(DISTINCT x) FROM unnest(p_recommended) x)<>cardinality(p_recommended)
  THEN RAISE EXCEPTION 'INVALID_RECOMMENDATIONS'; END IF;
 IF (SELECT count(*) FROM public.menu_items WHERE business_id=p_business_id AND id=ANY(p_recommended))<>cardinality(p_recommended)
  THEN RAISE EXCEPTION 'INVALID_RESOURCE_RELATIONSHIP'; END IF;
 DELETE FROM public.product_recommendations WHERE business_id=p_business_id AND trigger_product_id=p_trigger;
 INSERT INTO public.product_recommendations(business_id,trigger_product_id,recommended_product_id,position)
  SELECT p_business_id,p_trigger,x,ordinality::integer FROM unnest(p_recommended) WITH ORDINALITY AS t(x,ordinality);
 RETURN jsonb_build_object('triggerProductId',p_trigger,'recommendedProductIds',to_jsonb(p_recommended));
END $$;

CREATE FUNCTION public.product_recommendation_list(p_business_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('triggerProductId',trigger_product_id,'recommendedProductIds',ids)
  ORDER BY trigger_product_id),'[]') FROM (
   SELECT trigger_product_id,jsonb_agg(recommended_product_id ORDER BY position) ids
    FROM public.product_recommendations WHERE business_id=p_business_id GROUP BY trigger_product_id) r;
$$;
REVOKE ALL ON FUNCTION public.replace_product_recommendations(uuid,uuid,uuid,uuid[]),public.product_recommendation_list(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.replace_product_recommendations(uuid,uuid,uuid,uuid[]),public.product_recommendation_list(uuid) TO service_role;

-- Extend the versioned archive without changing the already-deployed migration.
ALTER FUNCTION public.menu_transfer_start(uuid,uuid,text,integer) RENAME TO menu_transfer_start_without_recommendations;
REVOKE ALL ON FUNCTION public.menu_transfer_start_without_recommendations(uuid,uuid,text,integer) FROM service_role;
CREATE FUNCTION public.menu_transfer_start(p_business_id uuid,p_owner_id uuid,p_kind text,p_parts integer DEFAULT 1)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; doc jsonb; content text; chunks jsonb='[]'; n integer;
BEGIN
 result:=public.menu_transfer_start_without_recommendations(p_business_id,p_owner_id,p_kind,p_parts);
 IF p_kind='export' THEN
  SELECT string_agg(part,'' ORDER BY ord)::jsonb INTO doc FROM public.menu_transfers t,
   jsonb_array_elements_text(t.parts) WITH ORDINALITY x(part,ord) WHERE t.id=(result->>'id')::uuid;
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
ALTER FUNCTION public.menu_transfer_apply(uuid,uuid,uuid,jsonb,boolean) RENAME TO menu_transfer_apply_without_recommendations;
REVOKE ALL ON FUNCTION public.menu_transfer_apply_without_recommendations(uuid,uuid,uuid,jsonb,boolean) FROM service_role;
CREATE FUNCTION public.menu_transfer_apply(p_business_id uuid,p_owner_id uuid,p_id uuid,p_document jsonb,p_catalog boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; done boolean; r jsonb; target text; n integer;
BEGIN
 PERFORM public.lock_business_capacity(p_business_id);
 SELECT completed INTO done FROM public.menu_transfers WHERE id=p_id AND business_id=p_business_id AND owner_id=p_owner_id FOR UPDATE;
 result:=public.menu_transfer_apply_without_recommendations(p_business_id,p_owner_id,p_id,p_document,p_catalog);
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
REVOKE ALL ON FUNCTION public.menu_transfer_start(uuid,uuid,text,integer),public.menu_transfer_apply(uuid,uuid,uuid,jsonb,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.menu_transfer_start(uuid,uuid,text,integer),public.menu_transfer_apply(uuid,uuid,uuid,jsonb,boolean) TO service_role;
COMMIT;
