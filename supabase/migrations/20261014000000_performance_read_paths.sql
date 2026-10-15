-- Apply after Supabase 20261012020000. Additive rollout: verify migration,
-- then enable independent PERFORMANCE_REORDER_RPC_ENABLED / PERFORMANCE_ANALYTICS_BATCH_RPC_ENABLED.
-- No lifecycle/RLS changes. Analytics requires real staging evidence before activation.
BEGIN;
-- INVOKER: the owner JWT keeps all existing table RLS policies. No arbitrary
-- identifiers, inserts, upserts, tenant reassignment or dynamic SQL.
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

-- A bounded report batches existing protected queries; their entitlement,
-- history, lifecycle, source and tenant validation remains authoritative.
CREATE OR REPLACE FUNCTION public.analytics_report(p_business uuid,p_start date,p_end date,
 p_bucket text DEFAULT 'day',p_source text DEFAULT NULL,p_qr uuid DEFAULT NULL,
 p_previous_start date DEFAULT NULL,p_previous_end date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE snapshot jsonb; adv boolean; pro boolean; result jsonb; BEGIN
 snapshot:=public.business_entitlement_snapshot(p_business);
 adv:=coalesce((snapshot->'entitlements'->>'ANALYTICS_ADVANCED')::boolean,false);
 pro:=coalesce((snapshot->'entitlements'->>'ANALYTICS_EXPORT')::boolean,false);
 IF (p_previous_start IS NULL)<>(p_previous_end IS NULL) THEN RAISE EXCEPTION 'INVALID_ANALYTICS_RANGE'; END IF;
 IF p_previous_start IS NOT NULL AND NOT adv THEN RAISE EXCEPTION 'ANALYTICS_FORBIDDEN'; END IF;
 result:=jsonb_build_object(
  'summary',public.analytics_query(p_business,p_start,p_end,'summary',p_bucket=>p_bucket,p_source=>p_source,p_qr=>p_qr),
  'series',public.analytics_query(p_business,p_start,p_end,'series',p_bucket=>p_bucket,p_source=>p_source,p_qr=>p_qr),
  'viewed',public.analytics_query(p_business,p_start,p_end,'ranking',p_metric=>'product_views',p_bucket=>p_bucket,p_source=>p_source,p_qr=>p_qr,p_limit=>5),
  'liked',public.analytics_query(p_business,p_start,p_end,'ranking',p_metric=>'likes',p_bucket=>p_bucket,p_source=>p_source,p_qr=>p_qr,p_limit=>5),
  'categories',CASE WHEN adv THEN public.analytics_query(p_business,p_start,p_end,'ranking',p_metric=>'categories',p_bucket=>p_bucket,p_source=>p_source,p_qr=>p_qr,p_limit=>5) END,
  'sources',CASE WHEN adv THEN public.analytics_query(p_business,p_start,p_end,'sources',p_bucket=>p_bucket,p_source=>p_source,p_qr=>p_qr) END,
  'hours',CASE WHEN adv THEN public.analytics_query(p_business,p_start,p_end,'hours',p_bucket=>p_bucket,p_source=>p_source,p_qr=>p_qr) END,
  'qr',CASE WHEN pro THEN public.analytics_query(p_business,p_start,p_end,'qr',p_bucket=>p_bucket,p_source=>p_source,p_qr=>p_qr) END,
  'previous',CASE WHEN p_previous_start IS NOT NULL THEN public.analytics_query(p_business,p_previous_start,p_previous_end,'summary',p_source=>p_source,p_qr=>p_qr) END);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.analytics_report(uuid,date,date,text,text,uuid,date,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_report(uuid,date,date,text,text,uuid,date,date) TO service_role;
COMMIT;
