-- Optional product flavors. Existing catalogues and legacy transfer RPCs are preserved.
BEGIN;
CREATE OR REPLACE FUNCTION public.valid_product_flavors(p_value jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE r jsonb; BEGIN
 IF p_value IS NULL OR jsonb_typeof(p_value)<>'array' OR jsonb_array_length(p_value)>30 THEN RETURN false; END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(p_value) LOOP
  IF jsonb_typeof(r)<>'object' OR NOT(r ?& ARRAY['id','name','price','isAvailable'])
   OR r-ARRAY['id','name','price','isAvailable']<>'{}'::jsonb
   OR jsonb_typeof(r->'id')<>'string' OR (r->>'id')!~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
   OR jsonb_typeof(r->'name')<>'string' OR length(r->>'name') NOT BETWEEN 1 AND 80
   OR r->>'name'<>btrim(r->>'name') OR (r->>'name') ~ '[<>[:cntrl:]]'
   OR jsonb_typeof(r->'isAvailable')<>'boolean'
   OR (r->'price'<>'null'::jsonb AND (jsonb_typeof(r->'price')<>'number' OR (r->>'price')::numeric<=0 OR (r->>'price')::numeric>999999.99))
   THEN RETURN false; END IF;
 END LOOP;
 RETURN (SELECT count(*)=count(DISTINCT x->>'id') AND count(*)=count(DISTINCT lower(x->>'name')) FROM jsonb_array_elements(p_value) x);
 EXCEPTION WHEN OTHERS THEN RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.valid_product_flavors(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.valid_product_flavors(jsonb) TO authenticated,service_role;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS flavors jsonb NOT NULL DEFAULT '[]';
ALTER TABLE public.menu_items ADD CONSTRAINT menu_items_flavors_check CHECK(public.valid_product_flavors(flavors));

-- Versioned entrypoints let older deployed backends keep their archive contract.
CREATE OR REPLACE FUNCTION public.menu_transfer_start_with_flavors(p_business_id uuid,p_owner_id uuid,p_kind text,p_parts integer DEFAULT 1)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; doc jsonb; content text; chunks jsonb='[]'; n integer;
BEGIN
 result:=public.menu_transfer_start(p_business_id,p_owner_id,p_kind,p_parts);
 IF p_kind='export' THEN
  SELECT string_agg(part,'' ORDER BY ord)::jsonb INTO doc FROM public.menu_transfers t,
   jsonb_array_elements_text(t.parts) WITH ORDINALITY x(part,ord) WHERE t.id=(result->>'id')::uuid;
  doc:=jsonb_set(doc,'{items}',coalesce((SELECT jsonb_agg(x.item||jsonb_build_object('flavors',i.flavors) ORDER BY x.ord)
   FROM jsonb_array_elements(doc->'items') WITH ORDINALITY x(item,ord)
   JOIN public.menu_items i ON i.id=(x.item->>'id')::uuid AND i.business_id=p_business_id),'[]'::jsonb));
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
CREATE OR REPLACE FUNCTION public.menu_transfer_apply_with_flavors(p_business_id uuid,p_owner_id uuid,p_id uuid,p_document jsonb,p_catalog boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; done boolean;
BEGIN
 PERFORM public.lock_business_capacity(p_business_id);
 SELECT completed INTO done FROM public.menu_transfers WHERE id=p_id AND business_id=p_business_id AND owner_id=p_owner_id FOR UPDATE;
 result:=public.menu_transfer_apply(p_business_id,p_owner_id,p_id,p_document,p_catalog);
 IF p_catalog AND done=false THEN
  UPDATE public.menu_items i SET flavors=coalesce(x.item->'flavors','[]'::jsonb)
   FROM jsonb_array_elements(p_document->'items') x(item) WHERE i.id=(x.item->>'id')::uuid AND i.business_id=p_business_id;
 END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.menu_transfer_start_with_flavors(uuid,uuid,text,integer),public.menu_transfer_apply_with_flavors(uuid,uuid,uuid,jsonb,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.menu_transfer_start_with_flavors(uuid,uuid,text,integer),public.menu_transfer_apply_with_flavors(uuid,uuid,uuid,jsonb,boolean) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
