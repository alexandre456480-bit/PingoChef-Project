-- Restore the bounded, owner-scoped atomic menu reorder RPC without changing existing rows.
BEGIN;
CREATE OR REPLACE FUNCTION public.reorder_business_menu(p_business uuid,p_resource text,p_orders jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE expected integer; affected integer; BEGIN
 IF p_resource IS NULL OR p_resource NOT IN ('products','categories','subcategories')
 OR p_orders IS NULL OR jsonb_typeof(p_orders)<>'array' THEN RAISE EXCEPTION 'INVALID_MENU_ORDER'; END IF;
 expected:=jsonb_array_length(p_orders);
 IF expected>(CASE WHEN p_resource='products' THEN 300 ELSE 200 END)
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_orders) x WHERE jsonb_typeof(x)<>'object'
  OR NOT(x ? 'id' AND x ? 'displayOrder') OR x-ARRAY['id','displayOrder']<>'{}'::jsonb
  OR jsonb_typeof(x->'id')<>'string' OR jsonb_typeof(x->'displayOrder')<>'number'
  OR (x->>'id')!~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
  OR (x->>'displayOrder')::numeric<>trunc((x->>'displayOrder')::numeric)
  OR (x->>'displayOrder')::numeric NOT BETWEEN -2147483648 AND 2147483647)
 OR expected<>(SELECT count(DISTINCT x->>'id') FROM jsonb_array_elements(p_orders) x)
 THEN RAISE EXCEPTION 'INVALID_MENU_ORDER'; END IF;
 IF current_user<>'service_role' AND NOT EXISTS(
  SELECT 1 FROM public.businesses WHERE id=p_business AND owner_user_id=auth.uid()
 ) THEN RAISE EXCEPTION 'REORDER_RESOURCE_NOT_FOUND'; END IF;
 IF NOT public.business_is_account_active(p_business) THEN RAISE EXCEPTION 'ACCOUNT_NOT_ACTIVE'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('menu-order:'||p_business::text||':'||p_resource,0));
 IF p_resource='products' THEN
  UPDATE public.menu_items t SET display_order=x."displayOrder",updated_at=now()
  FROM jsonb_to_recordset(p_orders) AS x(id uuid,"displayOrder" integer)
  WHERE t.business_id=p_business AND t.id=x.id;
 ELSIF p_resource='categories' THEN
  UPDATE public.categories t SET display_order=x."displayOrder"
  FROM jsonb_to_recordset(p_orders) AS x(id uuid,"displayOrder" integer)
  WHERE t.business_id=p_business AND t.id=x.id;
 ELSE
  UPDATE public.subcategories t SET display_order=x."displayOrder"
  FROM jsonb_to_recordset(p_orders) AS x(id uuid,"displayOrder" integer)
  WHERE t.business_id=p_business AND t.id=x.id;
 END IF;
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>expected THEN RAISE EXCEPTION 'REORDER_RESOURCE_NOT_FOUND'; END IF;
 RETURN affected;
END $$;
REVOKE ALL ON FUNCTION public.reorder_business_menu(uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reorder_business_menu(uuid,text,jsonb) TO authenticated,service_role;

NOTIFY pgrst,'reload schema';
COMMIT;
