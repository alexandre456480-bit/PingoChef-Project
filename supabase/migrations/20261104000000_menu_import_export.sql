-- Private, bounded, expiring transfer buffers. Menu writes remain atomic.
BEGIN;
-- These existing editor fields were present in legacy installations but absent
-- from the ordered migration chain. Add them without changing existing values.
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS icon_type text NOT NULL DEFAULT '2d',
 ADD COLUMN IF NOT EXISTS icon_key text, ADD COLUMN IF NOT EXISTS image_url text;
CREATE TABLE public.menu_transfers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('import','export')),
 parts jsonb NOT NULL DEFAULT '[]',
 expected_parts integer NOT NULL CHECK(expected_parts BETWEEN 1 AND 68),
 summary jsonb,
 completed boolean NOT NULL DEFAULT false,
 expires_at timestamptz NOT NULL DEFAULT now()+interval '1 hour',
 CHECK(jsonb_typeof(parts)='array' AND jsonb_array_length(parts)<=68),
 CHECK(octet_length(parts::text)<=70000000)
);
CREATE INDEX menu_transfers_expiry ON public.menu_transfers(expires_at);
CREATE INDEX menu_transfers_tenant ON public.menu_transfers(business_id);
ALTER TABLE public.menu_transfers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.menu_transfers FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.menu_transfers TO service_role;

CREATE FUNCTION public.menu_transfer_start(p_business_id uuid,p_owner_id uuid,p_kind text,p_parts integer DEFAULT 1)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid; v_doc jsonb; v_text text; v_parts jsonb='[]'; v_count integer; v_summary jsonb;
BEGIN
 PERFORM public.lock_business_capacity(p_business_id);
 IF NOT EXISTS(SELECT 1 FROM public.businesses WHERE id=p_business_id AND owner_user_id=p_owner_id)
   OR NOT public.business_is_account_active(p_business_id) THEN RAISE EXCEPTION 'ACCOUNT_NOT_ACTIVE'; END IF;
 DELETE FROM public.menu_transfers WHERE expires_at<now();
 IF (SELECT count(*) FROM public.menu_transfers WHERE business_id=p_business_id AND NOT completed)>=4 THEN RAISE EXCEPTION 'TRANSFER_LIMIT'; END IF;
 IF p_kind='export' THEN
   SELECT jsonb_build_object('format','pingochef-menu','version',1,'exportedAt',now(),
    'excludedVideos',(SELECT count(*) FROM public.product_media WHERE business_id=p_business_id AND media_type='video'),
    'business',(SELECT jsonb_build_object('name',b.name,'description',b.description,'logo_url',b.logo_url,'banner_url',b.banner_url,
      'phone',b.phone,'whatsapp',b.whatsapp,'welcome_bg_type',b.welcome_bg_type,'welcome_bg_image',b.welcome_bg_image,
      'welcome_bg_color',b.welcome_bg_color,'social_links',b.social_links,'order_settings',b.order_settings)
      FROM public.businesses b WHERE b.id=p_business_id),
    'design',(SELECT jsonb_build_object('template_key',d.template_key,'palette',d.palette,'font_heading',d.font_heading,
      'font_body',d.font_body,'font_pair',d.font_pair,'category_style',d.category_style,'home_blocks',d.home_blocks,'custom_config',d.custom_config)
      FROM public.design_settings d WHERE d.business_id=p_business_id),
    'categories',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c."displayOrder",c.id) FROM (
      SELECT id,name,description,icon,icon_type AS "iconType",icon_key AS "iconKey",image_url AS "imageUrl",
       display_mode AS "displayMode",display_order AS "displayOrder",is_active AS "isActive"
      FROM public.categories WHERE business_id=p_business_id) c),'[]'),
    'subcategories',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s."displayOrder",s.id) FROM (
      SELECT id,category_id AS "categoryId",name,display_order AS "displayOrder" FROM public.subcategories WHERE business_id=p_business_id) s),'[]'),
    'items',coalesce((SELECT jsonb_agg(to_jsonb(i) ORDER BY i."displayOrder",i.id) FROM (
      SELECT id,category_id AS "categoryId",subcategory_id AS "subcategoryId",name,description,price,promotional_price AS "promotionalPrice",
       image_url AS "imageUrl",is_available AS "isAvailable",is_highlighted AS "isHighlighted",highlight_type AS "highlightType",
       show_price AS "showPrice",display_order AS "displayOrder" FROM public.menu_items WHERE business_id=p_business_id) i),'[]')) INTO v_doc;
   v_text:=v_doc::text;
   IF octet_length(v_text)>33554432 THEN RAISE EXCEPTION 'MENU_ARCHIVE_TOO_LARGE'; END IF;
   FOR v_count IN 0..((length(v_text)-1)/500000) LOOP
    v_parts:=v_parts||jsonb_build_array(substr(v_text,v_count*500000+1,500000));
   END LOOP;
   p_parts:=jsonb_array_length(v_parts);
   v_summary:=jsonb_build_object('name',v_doc#>>'{business,name}','categories',jsonb_array_length(v_doc->'categories'),
     'subcategories',jsonb_array_length(v_doc->'subcategories'),'items',jsonb_array_length(v_doc->'items'),
     'excludedVideos',v_doc->'excludedVideos','bytes',octet_length(v_text));
 ELSIF p_kind<>'import' THEN RAISE EXCEPTION 'INVALID_TRANSFER'; END IF;
 INSERT INTO public.menu_transfers(business_id,owner_id,kind,expected_parts,parts,summary)
 VALUES(p_business_id,p_owner_id,p_kind,p_parts,v_parts,v_summary) RETURNING id INTO v_id;
 RETURN jsonb_build_object('id',v_id,'parts',p_parts,'summary',v_summary);
END $$;

CREATE FUNCTION public.menu_transfer_chunk(p_business_id uuid,p_owner_id uuid,p_id uuid,p_index integer,p_content text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.menu_transfers;
BEGIN
 SELECT * INTO v FROM public.menu_transfers WHERE id=p_id AND business_id=p_business_id AND owner_id=p_owner_id
  AND expires_at>now() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'TRANSFER_NOT_FOUND'; END IF;
 IF p_index<0 OR p_index>=v.expected_parts THEN RAISE EXCEPTION 'INVALID_TRANSFER'; END IF;
 IF p_content IS NOT NULL THEN
  IF v.kind<>'import' OR v.completed OR length(p_content)>500000 OR p_index>jsonb_array_length(v.parts) THEN RAISE EXCEPTION 'INVALID_TRANSFER'; END IF;
  IF p_index<jsonb_array_length(v.parts) AND v.parts->>p_index IS DISTINCT FROM p_content THEN RAISE EXCEPTION 'INVALID_TRANSFER'; END IF;
  UPDATE public.menu_transfers SET parts=jsonb_set(parts,ARRAY[p_index::text],to_jsonb(p_content),true) WHERE id=v.id;
  RETURN 'ok';
 END IF;
 IF v.kind<>'export' THEN RAISE EXCEPTION 'INVALID_TRANSFER'; END IF;
 RETURN v.parts->>p_index;
END $$;

CREATE FUNCTION public.menu_transfer_apply(p_business_id uuid,p_owner_id uuid,p_id uuid,p_document jsonb,p_catalog boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.menu_transfers; r jsonb; b jsonb; d jsonb; v_result jsonb;
BEGIN
 PERFORM public.lock_business_capacity(p_business_id);
 SELECT * INTO v FROM public.menu_transfers WHERE id=p_id AND business_id=p_business_id AND owner_id=p_owner_id
  AND kind='import' AND expires_at>now() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'TRANSFER_NOT_FOUND'; END IF;
 IF v.completed THEN RETURN v.summary; END IF;
 IF jsonb_array_length(v.parts)<>v.expected_parts THEN RAISE EXCEPTION 'TRANSFER_INCOMPLETE'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.businesses WHERE id=p_business_id AND owner_user_id=p_owner_id)
  OR NOT public.business_is_account_active(p_business_id) THEN RAISE EXCEPTION 'ACCOUNT_NOT_ACTIVE'; END IF;
 IF p_catalog THEN
  -- Never orphan provider assets or silently destroy videos through an import.
  IF EXISTS(SELECT 1 FROM public.product_media WHERE business_id=p_business_id) THEN RAISE EXCEPTION 'MENU_HAS_MEDIA'; END IF;
  IF jsonb_array_length(p_document->'items')>coalesce((public.business_feature_entitlement(p_business_id,'MAX_PRODUCTS')#>>'{}')::integer,0)
   OR jsonb_array_length(p_document->'categories')>coalesce((public.business_feature_entitlement(p_business_id,'MAX_CATEGORIES')#>>'{}')::integer,0)
   THEN RAISE EXCEPTION 'IMPORT_PLAN_LIMIT'; END IF;
  DELETE FROM public.menu_items WHERE business_id=p_business_id;
  DELETE FROM public.subcategories WHERE business_id=p_business_id;
  DELETE FROM public.categories WHERE business_id=p_business_id;
  FOR r IN SELECT value FROM jsonb_array_elements(p_document->'categories') LOOP
   INSERT INTO public.categories(id,business_id,name,description,icon,icon_type,icon_key,image_url,display_mode,display_order,is_active)
   VALUES((r->>'id')::uuid,p_business_id,r->>'name',r->>'description',r->>'icon',r->>'iconType',r->>'iconKey',r->>'imageUrl',r->>'displayMode',(r->>'displayOrder')::integer,(r->>'isActive')::boolean);
  END LOOP;
  FOR r IN SELECT value FROM jsonb_array_elements(p_document->'subcategories') LOOP
   INSERT INTO public.subcategories(id,business_id,category_id,name,display_order)
   VALUES((r->>'id')::uuid,p_business_id,(r->>'categoryId')::uuid,r->>'name',(r->>'displayOrder')::integer);
  END LOOP;
  FOR r IN SELECT value FROM jsonb_array_elements(p_document->'items') LOOP
   INSERT INTO public.menu_items(id,business_id,category_id,subcategory_id,name,description,price,promotional_price,image_url,is_available,is_highlighted,highlight_type,show_price,display_order)
   VALUES((r->>'id')::uuid,p_business_id,(r->>'categoryId')::uuid,(r->>'subcategoryId')::uuid,r->>'name',r->>'description',
    (r->>'price')::numeric,(r->>'promotionalPrice')::numeric,r->>'imageUrl',(r->>'isAvailable')::boolean,
    (r->>'isHighlighted')::boolean,r->>'highlightType',(r->>'showPrice')::boolean,(r->>'displayOrder')::integer);
  END LOOP;
 END IF;
 b:=p_document->'business'; d:=p_document->'design';
 IF NOT p_catalog AND d IS NOT NULL AND d<>'null'::jsonb THEN
  -- Category-specific banners belong to the destination catalogue, not file IDs.
  d:=jsonb_set(d,'{custom_config}',coalesce(d->'custom_config','{}')- 'category_hero_configs'
    ||jsonb_build_object('category_hero_configs',coalesce((SELECT custom_config->'category_hero_configs'
      FROM public.design_settings WHERE business_id=p_business_id),'{}')));
 END IF;
 UPDATE public.businesses SET name=b->>'name',description=b->>'description',logo_url=b->>'logo_url',banner_url=b->>'banner_url',
  phone=b->>'phone',whatsapp=b->>'whatsapp',welcome_bg_type=b->>'welcome_bg_type',welcome_bg_image=b->>'welcome_bg_image',
  welcome_bg_color=b->>'welcome_bg_color',social_links=b->'social_links',order_settings=b->'order_settings',updated_at=now()
 WHERE id=p_business_id AND owner_user_id=p_owner_id;
 IF d IS NOT NULL AND d<>'null'::jsonb THEN
  INSERT INTO public.design_settings(business_id,template_key,palette,font_heading,font_body,font_pair,category_style,home_blocks,custom_config)
   VALUES(p_business_id,d->>'template_key',d->'palette',d->>'font_heading',d->>'font_body',d->>'font_pair',d->>'category_style',d->'home_blocks',d->'custom_config')
   ON CONFLICT(business_id) DO UPDATE SET template_key=EXCLUDED.template_key,palette=EXCLUDED.palette,font_heading=EXCLUDED.font_heading,
    font_body=EXCLUDED.font_body,font_pair=EXCLUDED.font_pair,category_style=EXCLUDED.category_style,home_blocks=EXCLUDED.home_blocks,
    custom_config=EXCLUDED.custom_config,updated_at=now();
 END IF;
 -- The public URL, publication state, billing, credentials and analytics are untouched.
 v_result:=jsonb_build_object('imported',true,'catalog',p_catalog);
 UPDATE public.menu_transfers SET completed=true,parts='[]',summary=v_result WHERE id=v.id;
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.menu_transfer_start(uuid,uuid,text,integer),public.menu_transfer_chunk(uuid,uuid,uuid,integer,text),
 public.menu_transfer_apply(uuid,uuid,uuid,jsonb,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.menu_transfer_start(uuid,uuid,text,integer),public.menu_transfer_chunk(uuid,uuid,uuid,integer,text),
 public.menu_transfer_apply(uuid,uuid,uuid,jsonb,boolean) TO service_role;
-- Reuse the existing authenticated daily maintenance job; no new cron is required.
CREATE OR REPLACE FUNCTION public.maintain_shared_security_state() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n integer; m integer; t integer; BEGIN
 DELETE FROM public.shared_request_quotas WHERE window_start<now()-interval '2 days'; GET DIAGNOSTICS n=ROW_COUNT;
 DELETE FROM public.analytics_qr_entry_windows WHERE last_entry_at<now()-interval '2 days'; GET DIAGNOSTICS m=ROW_COUNT;
 DELETE FROM public.menu_transfers WHERE expires_at<now(); GET DIAGNOSTICS t=ROW_COUNT;
 RETURN n+m+t;
END $$;
COMMIT;
