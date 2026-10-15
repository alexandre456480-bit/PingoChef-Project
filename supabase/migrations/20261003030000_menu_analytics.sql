-- Menu analytics is collected independently of plans. Reading is entitlement-gated.
CREATE TABLE public.analytics_settings (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
 raw_retention_days integer NOT NULL DEFAULT 90 CHECK(raw_retention_days BETWEEN 7 AND 730),
 aggregate_retention_days integer NOT NULL DEFAULT 3650 CHECK(aggregate_retention_days BETWEEN 365 AND 7300),
 basic_history_days integer NOT NULL DEFAULT 31 CHECK(basic_history_days BETWEEN 1 AND 90),
 advanced_history_days integer NOT NULL DEFAULT 730 CHECK(advanced_history_days BETWEEN 31 AND 3650),
 complete_history_days integer NOT NULL DEFAULT 3650 CHECK(complete_history_days BETWEEN 31 AND 7300),
 collection_started_at timestamptz NOT NULL DEFAULT now(),
 CHECK(basic_history_days<=advanced_history_days AND advanced_history_days<=complete_history_days),
 CHECK(complete_history_days<=aggregate_retention_days)
);
INSERT INTO public.analytics_settings(singleton) VALUES(true);
-- Reserved registry for identifying traffic from future QR creation. No QR generator in this phase.
CREATE TABLE public.analytics_qr_refs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 label text NOT NULL CHECK(length(label) BETWEEN 1 AND 120), active boolean NOT NULL DEFAULT true,
 UNIQUE(business_id,id)
);
CREATE TABLE public.analytics_events (
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 id uuid NOT NULL, visitor_id text CHECK(visitor_id ~ '^[a-f0-9]{64}$'), page_id uuid,
 event_name text NOT NULL CHECK(event_name IN ('MENU_VIEW','CATEGORY_VIEW','PRODUCT_VIEW','LIKE','VIDEO_PLAY','VIDEO_25','VIDEO_50','VIDEO_100','QR_ENTRY')),
 menu_item_id uuid, category_id uuid,
 source text NOT NULL CHECK(source IN ('direct','qr','instagram','facebook','google','whatsapp','other','unattributed')),
 qr_id uuid, occurred_at timestamptz NOT NULL DEFAULT now(), metadata jsonb NOT NULL DEFAULT '{}',
 dedupe_key text NOT NULL CHECK(length(dedupe_key)<=400),
 PRIMARY KEY(business_id,id), UNIQUE(business_id,dedupe_key),
 CHECK(jsonb_typeof(metadata)='object' AND pg_column_size(metadata)<=512)
);
CREATE INDEX analytics_events_time_idx ON public.analytics_events(occurred_at);
CREATE INDEX analytics_events_tenant_time_idx ON public.analytics_events(business_id,occurred_at DESC);
CREATE TABLE public.analytics_daily (
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 day date NOT NULL,event_name text NOT NULL,source text NOT NULL,qr_key uuid NOT NULL,
 event_count bigint NOT NULL CHECK(event_count>0), PRIMARY KEY(business_id,day,event_name,source,qr_key)
);
CREATE TABLE public.analytics_hourly (
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 day date NOT NULL,hour smallint NOT NULL CHECK(hour BETWEEN 0 AND 23),event_name text NOT NULL,
 source text NOT NULL,qr_key uuid NOT NULL,event_count bigint NOT NULL CHECK(event_count>0),
 PRIMARY KEY(business_id,day,hour,event_name,source,qr_key)
);
CREATE TABLE public.analytics_dimensions_daily (
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 day date NOT NULL,event_name text NOT NULL,dimension text NOT NULL CHECK(dimension IN ('product','category')),
 dimension_key uuid NOT NULL,source text NOT NULL,qr_key uuid NOT NULL,event_count bigint NOT NULL CHECK(event_count>0),
 PRIMARY KEY(business_id,day,event_name,dimension,dimension_key,source,qr_key)
);
CREATE TABLE public.analytics_visitors_daily (
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 day date NOT NULL,visitor_id text NOT NULL CHECK(visitor_id ~ '^[a-f0-9]{64}$'),source text NOT NULL,qr_key uuid NOT NULL,
 hours_mask bigint NOT NULL CHECK(hours_mask BETWEEN 1 AND 16777215),
 PRIMARY KEY(business_id,day,visitor_id,source,qr_key)
);
CREATE TABLE public.analytics_ingest_quotas (
 subject_hash text NOT NULL CHECK(subject_hash ~ '^[a-f0-9]{64}$'),window_start timestamptz NOT NULL,
 count integer NOT NULL CHECK(count>=0),PRIMARY KEY(subject_hash,window_start)
);
CREATE INDEX analytics_daily_retention_idx ON public.analytics_daily(day);
CREATE INDEX analytics_hourly_retention_idx ON public.analytics_hourly(day);
CREATE INDEX analytics_dimensions_retention_idx ON public.analytics_dimensions_daily(day);
CREATE INDEX analytics_visitors_retention_idx ON public.analytics_visitors_daily(day);
DO $$DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['analytics_settings','analytics_qr_refs','analytics_events','analytics_daily','analytics_hourly',
 'analytics_dimensions_daily','analytics_visitors_daily','analytics_ingest_quotas'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
  EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
 END LOOP;
END $$;

CREATE FUNCTION public.analytics_guard_timezone() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=NEW.timezone) THEN RAISE EXCEPTION 'INVALID_ANALYTICS_TIMEZONE'; END IF;
 IF NEW.timezone<>OLD.timezone AND EXISTS(SELECT 1 FROM public.analytics_daily LIMIT 1) THEN
  RAISE EXCEPTION 'ANALYTICS_TIMEZONE_REQUIRES_BACKFILL';
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER analytics_guard_timezone BEFORE UPDATE ON public.analytics_settings FOR EACH ROW EXECUTE FUNCTION public.analytics_guard_timezone();

-- Incremental, synchronous database aggregation: a committed event and its counters cannot diverge.
CREATE FUNCTION public.analytics_aggregate_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d date;h smallint;q uuid:=coalesce(NEW.qr_id,'00000000-0000-0000-0000-000000000000');z text;BEGIN
 SELECT timezone INTO z FROM public.analytics_settings WHERE singleton;
 d:=(NEW.occurred_at AT TIME ZONE z)::date;h:=extract(hour FROM NEW.occurred_at AT TIME ZONE z);
 INSERT INTO public.analytics_daily VALUES(NEW.business_id,d,NEW.event_name,NEW.source,q,1)
 ON CONFLICT(business_id,day,event_name,source,qr_key) DO UPDATE SET event_count=public.analytics_daily.event_count+1;
 INSERT INTO public.analytics_hourly VALUES(NEW.business_id,d,h,NEW.event_name,NEW.source,q,1)
 ON CONFLICT(business_id,day,hour,event_name,source,qr_key) DO UPDATE SET event_count=public.analytics_hourly.event_count+1;
 IF NEW.menu_item_id IS NOT NULL THEN
  INSERT INTO public.analytics_dimensions_daily VALUES(NEW.business_id,d,NEW.event_name,'product',NEW.menu_item_id,NEW.source,q,1)
  ON CONFLICT(business_id,day,event_name,dimension,dimension_key,source,qr_key) DO UPDATE SET event_count=public.analytics_dimensions_daily.event_count+1;
 END IF;
 IF NEW.category_id IS NOT NULL THEN
  INSERT INTO public.analytics_dimensions_daily VALUES(NEW.business_id,d,NEW.event_name,'category',NEW.category_id,NEW.source,q,1)
  ON CONFLICT(business_id,day,event_name,dimension,dimension_key,source,qr_key) DO UPDATE SET event_count=public.analytics_dimensions_daily.event_count+1;
 END IF;
 IF NEW.event_name='MENU_VIEW' AND NEW.visitor_id IS NOT NULL THEN
  INSERT INTO public.analytics_visitors_daily VALUES(NEW.business_id,d,NEW.visitor_id,NEW.source,q,(1::bigint<<h))
  ON CONFLICT(business_id,day,visitor_id,source,qr_key) DO UPDATE SET hours_mask=public.analytics_visitors_daily.hours_mask|EXCLUDED.hours_mask;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER analytics_aggregate_event AFTER INSERT ON public.analytics_events FOR EACH ROW EXECUTE FUNCTION public.analytics_aggregate_event();

-- Only a successfully persisted, deduplicated like becomes an analytics LIKE. Public ingestion cannot forge one.
CREATE FUNCTION public.analytics_record_like() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c uuid;BEGIN
 SELECT category_id INTO c FROM public.menu_items WHERE id=NEW.item_id AND business_id=NEW.business_id;
 INSERT INTO public.analytics_events(business_id,id,event_name,menu_item_id,category_id,source,occurred_at,dedupe_key)
 VALUES(NEW.business_id,gen_random_uuid(),'LIKE',NEW.item_id,c,'unattributed',now(),'like:'||NEW.id::text)
 ON CONFLICT DO NOTHING;RETURN NEW;
END $$;
CREATE TRIGGER analytics_record_like AFTER INSERT ON public.anonymous_likes FOR EACH ROW EXECUTE FUNCTION public.analytics_record_like();

CREATE FUNCTION public.analytics_ingest(p_business uuid,p_visitor text,p_page uuid,p_ip_hash text,p_events jsonb,
 p_source text,p_qr uuid DEFAULT NULL,p_ip_limit integer DEFAULT 1500,p_visitor_limit integer DEFAULT 180)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e jsonb;n integer;v_count integer;v_inserted integer:=0;v_item uuid;v_category uuid;v_media uuid;v_play uuid;
 v_name text;v_key text;v_id uuid;v_window timestamptz:=date_trunc('minute',now());s text;BEGIN
 IF p_visitor IS NULL OR p_ip_hash IS NULL OR p_events IS NULL OR p_source IS NULL OR p_visitor!~'^[a-f0-9]{64}$' OR p_ip_hash!~'^[a-f0-9]{64}$' OR p_page IS NULL
 OR jsonb_typeof(p_events)<>'array' OR jsonb_array_length(p_events) NOT BETWEEN 1 AND 20
 OR p_source NOT IN ('direct','qr','instagram','facebook','google','whatsapp','other')
 OR p_ip_limit NOT BETWEEN 20 AND 100000 OR p_visitor_limit NOT BETWEEN 20 AND 2000 THEN RAISE EXCEPTION 'INVALID_ANALYTICS_EVENT'; END IF;
 IF NOT public.business_is_publicly_eligible(p_business) THEN RAISE EXCEPTION 'ANALYTICS_MENU_UNAVAILABLE'; END IF;
 IF p_qr IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.analytics_qr_refs WHERE id=p_qr AND business_id=p_business AND active) THEN RAISE EXCEPTION 'INVALID_ANALYTICS_RESOURCE'; END IF;
 n:=jsonb_array_length(p_events);
 -- Stable lock order across instances. Replayed and rate-denied batches consume the abuse budget.
 FOR s IN SELECT x FROM unnest(ARRAY[p_ip_hash,p_visitor])x ORDER BY x LOOP
  INSERT INTO public.analytics_ingest_quotas VALUES(s,v_window,n)
  ON CONFLICT(subject_hash,window_start) DO UPDATE SET count=public.analytics_ingest_quotas.count+n RETURNING count INTO v_count;
  IF v_count>(CASE WHEN s=p_ip_hash THEN p_ip_limit ELSE p_visitor_limit END) THEN
   RETURN -1;
  END IF;
 END LOOP;
 FOR e IN SELECT * FROM jsonb_array_elements(p_events) LOOP
  v_name:=e->>'eventName';v_id:=(e->>'id')::uuid;v_item:=nullif(e->>'itemId','')::uuid;
  v_category:=nullif(e->>'categoryId','')::uuid;v_media:=nullif(e->>'mediaId','')::uuid;v_play:=nullif(e->>'playId','')::uuid;
  IF v_id IS NULL OR v_name IS NULL OR v_name NOT IN ('MENU_VIEW','CATEGORY_VIEW','PRODUCT_VIEW','VIDEO_PLAY','VIDEO_25','VIDEO_50','VIDEO_100','QR_ENTRY') THEN RAISE EXCEPTION 'INVALID_ANALYTICS_EVENT'; END IF;
  IF v_item IS NOT NULL THEN
   SELECT category_id INTO v_category FROM public.menu_items WHERE id=v_item AND business_id=p_business AND is_available;
   IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_ANALYTICS_RESOURCE'; END IF;
  END IF;
  IF v_category IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.categories WHERE id=v_category AND business_id=p_business AND is_active) THEN RAISE EXCEPTION 'INVALID_ANALYTICS_RESOURCE'; END IF;
  IF v_name='CATEGORY_VIEW' AND (v_category IS NULL OR v_item IS NOT NULL) THEN RAISE EXCEPTION 'INVALID_ANALYTICS_EVENT'; END IF;
  IF v_name IN ('PRODUCT_VIEW','VIDEO_PLAY','VIDEO_25','VIDEO_50','VIDEO_100') AND v_item IS NULL THEN RAISE EXCEPTION 'INVALID_ANALYTICS_EVENT'; END IF;
  IF v_name IN ('MENU_VIEW','QR_ENTRY') AND (v_item IS NOT NULL OR v_category IS NOT NULL) THEN RAISE EXCEPTION 'INVALID_ANALYTICS_EVENT'; END IF;
  IF v_name='QR_ENTRY' AND p_source<>'qr' THEN RAISE EXCEPTION 'INVALID_ANALYTICS_EVENT'; END IF;
  IF v_name LIKE 'VIDEO_%' THEN
   IF v_play IS NULL OR v_media IS NULL OR NOT EXISTS(SELECT 1 FROM public.product_media WHERE id=v_media
    AND business_id=p_business AND menu_item_id=v_item AND media_type='video' AND status='ready' AND is_published) THEN RAISE EXCEPTION 'INVALID_ANALYTICS_RESOURCE'; END IF;
  ELSIF v_play IS NOT NULL OR v_media IS NOT NULL THEN RAISE EXCEPTION 'INVALID_ANALYTICS_EVENT'; END IF;
  v_key:=p_visitor||':'||p_page::text||':'||v_name||':'||coalesce(v_item::text,v_category::text,'menu')||':'||coalesce(v_play::text,'');
  INSERT INTO public.analytics_events(business_id,id,visitor_id,page_id,event_name,menu_item_id,category_id,source,qr_id,metadata,dedupe_key)
  VALUES(p_business,v_id,p_visitor,p_page,v_name,v_item,v_category,p_source,p_qr,
   CASE WHEN v_media IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('mediaId',v_media,'playId',v_play) END,v_key)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_count=ROW_COUNT;v_inserted:=v_inserted+v_count;
 END LOOP;RETURN v_inserted;
END $$;
REVOKE ALL ON FUNCTION public.analytics_ingest(uuid,text,uuid,text,jsonb,text,uuid,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_ingest(uuid,text,uuid,text,jsonb,text,uuid,integer,integer) TO service_role;

-- Every report reads aggregates/presence, never raw events. All query modes enforce real database entitlements.
CREATE FUNCTION public.analytics_query(p_business uuid,p_start date,p_end date,p_kind text,
 p_metric text DEFAULT 'product_views',p_bucket text DEFAULT 'day',p_source text DEFAULT NULL,p_qr uuid DEFAULT NULL,
 p_item uuid DEFAULT NULL,p_offset integer DEFAULT 0,p_limit integer DEFAULT 10)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a jsonb;cfg public.analytics_settings%ROWTYPE;adv boolean;pro boolean;history integer;today date;
 event text;dim text;result jsonb;BEGIN
 a:=public.business_entitlement_snapshot(p_business);
 IF NOT public.business_is_account_active(p_business) OR NOT coalesce((a->'entitlements'->>'ANALYTICS_BASIC')::boolean,false) THEN RAISE EXCEPTION 'ANALYTICS_FORBIDDEN'; END IF;
 adv:=coalesce((a->'entitlements'->>'ANALYTICS_ADVANCED')::boolean,false);pro:=coalesce((a->'entitlements'->>'ANALYTICS_EXPORT')::boolean,false);
 SELECT * INTO cfg FROM public.analytics_settings WHERE singleton;
 history:=CASE WHEN pro THEN cfg.complete_history_days WHEN adv THEN cfg.advanced_history_days ELSE cfg.basic_history_days END;
 today:=(now() AT TIME ZONE cfg.timezone)::date;
 IF p_start IS NULL OR p_end IS NULL OR p_end<p_start OR p_end>today OR p_start<today-history+1 THEN RAISE EXCEPTION 'INVALID_ANALYTICS_RANGE'; END IF;
 IF p_kind IS NULL OR p_bucket IS NULL OR p_kind NOT IN ('summary','series','ranking','sources','hours','qr','product-trend')
 OR p_bucket NOT IN ('hour','day','week','month') OR (p_bucket='hour' AND p_start<>p_end)
 OR p_offset NOT BETWEEN 0 AND 100000 OR p_limit NOT BETWEEN 1 AND 5000 THEN RAISE EXCEPTION 'INVALID_ANALYTICS_QUERY'; END IF;
 IF ((p_kind IN ('sources','hours','product-trend') OR (p_kind='ranking' AND p_metric='categories') OR p_source IS NOT NULL) AND NOT adv)
 OR ((p_kind='qr' OR p_qr IS NOT NULL) AND NOT pro) THEN RAISE EXCEPTION 'ANALYTICS_FORBIDDEN'; END IF;
 IF p_source IS NOT NULL AND p_source NOT IN ('direct','qr','instagram','facebook','google','whatsapp','other','unattributed') THEN RAISE EXCEPTION 'INVALID_ANALYTICS_QUERY'; END IF;
 IF p_qr IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.analytics_qr_refs WHERE id=p_qr AND business_id=p_business) THEN RAISE EXCEPTION 'INVALID_ANALYTICS_RESOURCE'; END IF;
 IF p_kind='summary' THEN
  SELECT jsonb_build_object('menuViews',coalesce(sum(event_count)FILTER(WHERE event_name='MENU_VIEW'),0),
   'productViews',coalesce(sum(event_count)FILTER(WHERE event_name='PRODUCT_VIEW'),0),
   'videoPlays',coalesce(sum(event_count)FILTER(WHERE event_name='VIDEO_PLAY'),0),
   'video25',coalesce(sum(event_count)FILTER(WHERE event_name='VIDEO_25'),0),
   'video50',coalesce(sum(event_count)FILTER(WHERE event_name='VIDEO_50'),0),
   'video100',coalesce(sum(event_count)FILTER(WHERE event_name='VIDEO_100'),0),
   'likes',coalesce(sum(event_count)FILTER(WHERE event_name='LIKE'),0),
   'qrEntries',coalesce(sum(event_count)FILTER(WHERE event_name='QR_ENTRY'),0),
   'visitors',(SELECT count(DISTINCT visitor_id) FROM public.analytics_visitors_daily WHERE business_id=p_business AND day BETWEEN p_start AND p_end
    AND(p_source IS NULL OR source=p_source) AND(p_qr IS NULL OR qr_key=p_qr))) INTO result
  FROM public.analytics_daily WHERE business_id=p_business AND day BETWEEN p_start AND p_end
   AND(p_source IS NULL OR source=p_source) AND(p_qr IS NULL OR qr_key=p_qr);
  IF NOT adv THEN result:=result-ARRAY['qrEntries','video25','video50','video100']; END IF;
 ELSIF p_kind='series' THEN
  IF p_bucket='hour' THEN
   SELECT jsonb_agg(jsonb_build_object('date',p_start,'hour',h,'menuViews',coalesce(d.views,0),'productViews',coalesce(d.products,0),
    'videoPlays',coalesce(d.videos,0),'visitors',(SELECT count(DISTINCT visitor_id) FROM public.analytics_visitors_daily WHERE business_id=p_business
     AND day=p_start AND(hours_mask&(1::bigint<<h))<>0 AND(p_source IS NULL OR source=p_source)AND(p_qr IS NULL OR qr_key=p_qr)))ORDER BY h) INTO result
   FROM generate_series(0,23)h LEFT JOIN(
    SELECT hour,sum(event_count)FILTER(WHERE event_name='MENU_VIEW')views,sum(event_count)FILTER(WHERE event_name='PRODUCT_VIEW')products,
     sum(event_count)FILTER(WHERE event_name='VIDEO_PLAY')videos FROM public.analytics_hourly WHERE business_id=p_business AND day=p_start
     AND(p_source IS NULL OR source=p_source)AND(p_qr IS NULL OR qr_key=p_qr)GROUP BY hour)d ON d.hour=h;
  ELSE
   WITH bins AS(SELECT DISTINCT greatest(date_trunc(p_bucket,x)::date,p_start)bucket FROM generate_series(p_start::timestamp,p_end::timestamp,interval '1 day')x),
   d AS(SELECT greatest(date_trunc(p_bucket,day)::date,p_start)bucket,sum(event_count)FILTER(WHERE event_name='MENU_VIEW')views,
    sum(event_count)FILTER(WHERE event_name='PRODUCT_VIEW')products,sum(event_count)FILTER(WHERE event_name='VIDEO_PLAY')videos
    FROM public.analytics_daily WHERE business_id=p_business AND day BETWEEN p_start AND p_end
     AND(p_source IS NULL OR source=p_source)AND(p_qr IS NULL OR qr_key=p_qr)GROUP BY 1),
   v AS(SELECT greatest(date_trunc(p_bucket,day)::date,p_start)bucket,count(DISTINCT visitor_id)visitors FROM public.analytics_visitors_daily
    WHERE business_id=p_business AND day BETWEEN p_start AND p_end AND(p_source IS NULL OR source=p_source)AND(p_qr IS NULL OR qr_key=p_qr)GROUP BY 1)
   SELECT jsonb_agg(jsonb_build_object('date',b.bucket,'menuViews',coalesce(d.views,0),'productViews',coalesce(d.products,0),
    'videoPlays',coalesce(d.videos,0),'visitors',coalesce(v.visitors,0))ORDER BY b.bucket) INTO result FROM bins b LEFT JOIN d USING(bucket)LEFT JOIN v USING(bucket);
  END IF;
 ELSIF p_kind IN ('ranking','product-trend') THEN
  event:=CASE p_metric WHEN 'product_views' THEN 'PRODUCT_VIEW' WHEN 'likes' THEN 'LIKE' WHEN 'video_plays' THEN 'VIDEO_PLAY' WHEN 'categories' THEN 'CATEGORY_VIEW' ELSE NULL END;
  IF event IS NULL THEN RAISE EXCEPTION 'INVALID_ANALYTICS_QUERY'; END IF;
  dim:=CASE WHEN p_metric='categories' THEN 'category' ELSE 'product' END;
  IF p_kind='product-trend' THEN
   IF p_item IS NULL OR NOT EXISTS(SELECT 1 FROM public.menu_items WHERE id=p_item AND business_id=p_business) THEN RAISE EXCEPTION 'INVALID_ANALYTICS_RESOURCE'; END IF;
   WITH bins AS(SELECT DISTINCT greatest(date_trunc(CASE WHEN p_bucket='hour' THEN 'day' ELSE p_bucket END,x)::date,p_start)bucket
    FROM generate_series(p_start::timestamp,p_end::timestamp,interval '1 day')x),
   counts AS(SELECT greatest(date_trunc(CASE WHEN p_bucket='hour' THEN 'day' ELSE p_bucket END,day)::date,p_start)bucket,sum(event_count)n
    FROM public.analytics_dimensions_daily WHERE business_id=p_business AND day BETWEEN p_start AND p_end
    AND dimension='product' AND dimension_key=p_item AND event_name='PRODUCT_VIEW' AND(p_source IS NULL OR source=p_source)AND(p_qr IS NULL OR qr_key=p_qr)GROUP BY 1)
   SELECT coalesce(jsonb_agg(jsonb_build_object('date',bins.bucket,'value',coalesce(n,0))ORDER BY bins.bucket),'[]') INTO result FROM bins LEFT JOIN counts USING(bucket);
  ELSE
   WITH counts AS(SELECT dimension_key id,sum(event_count)value FROM public.analytics_dimensions_daily WHERE business_id=p_business AND day BETWEEN p_start AND p_end
    AND dimension=dim AND event_name=event AND(p_source IS NULL OR source=p_source)AND(p_qr IS NULL OR qr_key=p_qr)GROUP BY dimension_key),
   rows AS(SELECT c.id,c.value,coalesce(CASE WHEN dim='category' THEN cat.name ELSE item.name END,CASE WHEN dim='category' THEN 'Categoria removida' ELSE 'Produto removido' END)name,
    CASE WHEN dim='category' THEN cat.id IS NULL ELSE item.id IS NULL END removed
    FROM counts c LEFT JOIN public.categories cat ON dim='category' AND cat.id=c.id AND cat.business_id=p_business
     LEFT JOIN public.menu_items item ON dim='product'AND item.id=c.id AND item.business_id=p_business ORDER BY c.value DESC,c.id OFFSET p_offset LIMIT p_limit)
   SELECT jsonb_build_object('total',(SELECT count(*)FROM counts),'rows',coalesce((SELECT jsonb_agg(to_jsonb(rows)ORDER BY value DESC,id)FROM rows),'[]')) INTO result;
  END IF;
 ELSIF p_kind='sources' THEN
  SELECT coalesce(jsonb_agg(jsonb_build_object('name',source,'value',n)ORDER BY n DESC,source),'[]') INTO result FROM(
   SELECT source,sum(event_count)n FROM public.analytics_daily WHERE business_id=p_business AND day BETWEEN p_start AND p_end AND event_name='MENU_VIEW'
    AND(p_source IS NULL OR source=p_source)AND(p_qr IS NULL OR qr_key=p_qr)GROUP BY source)r;
 ELSIF p_kind='hours' THEN
  SELECT jsonb_agg(jsonb_build_object('hour',h,'value',coalesce(n,0))ORDER BY h) INTO result FROM generate_series(0,23)h LEFT JOIN(
   SELECT hour,sum(event_count)n FROM public.analytics_hourly WHERE business_id=p_business AND day BETWEEN p_start AND p_end AND event_name='MENU_VIEW'
    AND(p_source IS NULL OR source=p_source)AND(p_qr IS NULL OR qr_key=p_qr)GROUP BY hour)r ON r.hour=h;
 ELSIF p_kind='qr' THEN
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',q.id,'name',coalesce(q.label,'QR removido/não identificado'),'value',r.n)ORDER BY r.n DESC),'[]') INTO result FROM(
   SELECT qr_key,sum(event_count)n FROM public.analytics_daily WHERE business_id=p_business AND day BETWEEN p_start AND p_end AND event_name='QR_ENTRY'
    AND(p_source IS NULL OR source=p_source)AND(p_qr IS NULL OR qr_key=p_qr)GROUP BY qr_key)r
    LEFT JOIN public.analytics_qr_refs q ON q.id=r.qr_key AND q.business_id=p_business;
 END IF;RETURN coalesce(result,'[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.analytics_query(uuid,date,date,text,text,text,text,uuid,uuid,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_query(uuid,date,date,text,text,text,text,uuid,uuid,integer,integer) TO service_role;

CREATE FUNCTION public.maintain_menu_analytics() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cfg public.analytics_settings%ROWTYPE;n integer;today date;BEGIN
 SELECT * INTO cfg FROM public.analytics_settings WHERE singleton;today:=(now()AT TIME ZONE cfg.timezone)::date;
 DELETE FROM public.analytics_events WHERE occurred_at<now()-make_interval(days=>cfg.raw_retention_days);GET DIAGNOSTICS n=ROW_COUNT;
 DELETE FROM public.analytics_ingest_quotas WHERE window_start<now()-interval '2 days';
 DELETE FROM public.analytics_daily WHERE day<today-cfg.aggregate_retention_days+1;
 DELETE FROM public.analytics_hourly WHERE day<today-cfg.aggregate_retention_days+1;
 DELETE FROM public.analytics_dimensions_daily WHERE day<today-cfg.aggregate_retention_days+1;
 DELETE FROM public.analytics_visitors_daily WHERE day<today-cfg.aggregate_retention_days+1;
 RETURN jsonb_build_object('rawDeleted',n,'rawRetentionDays',cfg.raw_retention_days,'aggregateRetentionDays',cfg.aggregate_retention_days);
END $$;
REVOKE ALL ON FUNCTION public.maintain_menu_analytics() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.maintain_menu_analytics() TO service_role;
