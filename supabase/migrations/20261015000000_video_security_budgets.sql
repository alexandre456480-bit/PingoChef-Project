-- Additive video-only hardening. Commercial plans and existing capacity RPCs are unchanged.
CREATE TABLE public.video_security_state (
 scope text PRIMARY KEY,
 business_id uuid UNIQUE REFERENCES public.businesses(id) ON DELETE CASCADE,
 state text NOT NULL DEFAULT 'NORMAL' CHECK(state IN ('NORMAL','SOFT_ALERT','HARD_BLOCK')),
 expires_at timestamptz,
 manual_until timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK((scope='global' AND business_id IS NULL) OR (business_id IS NOT NULL AND scope='business:'||business_id::text))
);
INSERT INTO public.video_security_state(scope) VALUES('global');
CREATE TABLE public.video_usage_daily (
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 day date NOT NULL,
 media_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
 metric text NOT NULL CHECK(metric ~ '^[a-z_]{1,50}$'),
 count bigint NOT NULL DEFAULT 0 CHECK(count>=0),
 estimated_delivery_seconds numeric NOT NULL DEFAULT 0 CHECK(estimated_delivery_seconds>=0),
 PRIMARY KEY(business_id,day,media_id,metric)
);
CREATE INDEX video_usage_daily_day_idx ON public.video_usage_daily(day);
CREATE TABLE public.video_provider_usage_daily (
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 media_id uuid NOT NULL, day date NOT NULL,
 delivered_seconds numeric NOT NULL CHECK(delivered_seconds>=0), synced_at timestamptz NOT NULL,
 PRIMARY KEY(business_id,media_id,day)
);
CREATE TABLE public.video_abuse_events (
 business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
 scope text GENERATED ALWAYS AS(coalesce(business_id::text,'global')) STORED,
 endpoint text NOT NULL CHECK(endpoint IN ('playback','upload','maintenance','webhook','admin')),
 code text NOT NULL CHECK(code ~ '^[A-Z_]{1,60}$'),
 window_start timestamptz NOT NULL,
 media_id uuid,
 occurrences bigint NOT NULL DEFAULT 1,
 PRIMARY KEY(scope,endpoint,code,window_start)
);
CREATE INDEX video_abuse_events_time_idx ON public.video_abuse_events(window_start);
CREATE TABLE public.video_maintenance_state (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 lease_token uuid, lease_until timestamptz,
 upload_page integer NOT NULL DEFAULT 1 CHECK(upload_page>0),
 asset_page integer NOT NULL DEFAULT 1 CHECK(asset_page>0),
 usage_day date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date-2,
 usage_page integer NOT NULL DEFAULT 1 CHECK(usage_page>0),
 last_completed_at timestamptz
);
INSERT INTO public.video_maintenance_state(singleton) VALUES(true);
ALTER TABLE public.product_media ADD COLUMN upload_idempotency_hash text
 CHECK(upload_idempotency_hash IS NULL OR upload_idempotency_hash ~ '^[a-f0-9]{64}$');
CREATE UNIQUE INDEX product_media_upload_idempotency_idx ON public.product_media(business_id,upload_idempotency_hash)
 WHERE upload_idempotency_hash IS NOT NULL;

DO $$DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['video_security_state','video_usage_daily','video_provider_usage_daily','video_abuse_events','video_maintenance_state'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
  EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
 END LOOP;
END $$;

CREATE FUNCTION public.record_video_metric(p_business uuid,p_media uuid,p_metric text,p_seconds numeric DEFAULT 0)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 INSERT INTO public.video_usage_daily(business_id,day,media_id,metric,count,estimated_delivery_seconds)
 VALUES(p_business,(now() AT TIME ZONE 'UTC')::date,coalesce(p_media,'00000000-0000-0000-0000-000000000000'),p_metric,1,greatest(p_seconds,0))
 ON CONFLICT(business_id,day,media_id,metric) DO UPDATE SET count=public.video_usage_daily.count+1,
 estimated_delivery_seconds=public.video_usage_daily.estimated_delivery_seconds+EXCLUDED.estimated_delivery_seconds;
$$;
CREATE FUNCTION public.record_video_abuse(p_business uuid,p_media uuid,p_endpoint text,p_code text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 INSERT INTO public.video_abuse_events(business_id,endpoint,code,window_start,media_id)
 VALUES(p_business,p_endpoint,p_code,date_trunc('minute',now()),p_media)
 ON CONFLICT(scope,endpoint,code,window_start) DO UPDATE SET occurrences=public.video_abuse_events.occurrences+1;
$$;

-- Uses the existing shared counter storage. Fixed order and bounded counters, no raw IP.
CREATE FUNCTION public.consume_video_security_budget(p_endpoint text,p_business_id uuid,p_media_id uuid,
 p_session_hash text,p_ip_hash text,p_preview boolean,p_owner_id uuid,p_playback_id text,p_policy jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.video_security_state%ROWTYPE;g public.video_security_state%ROWTYPE;
 m public.product_media%ROWTYPE;v_allowed boolean:=true;v_code text:='OK';v_scope text;v_subject text;
 v_limit integer;v_seconds integer;v_window integer;v_count integer;v_total integer:=0;v_denied integer:=0;
 v_soft integer;v_hard integer;v_hard_denials integer;v_state text:='NORMAL';v_auto boolean;
 v_rules jsonb;v_rule jsonb;v_bucket timestamptz;
BEGIN
 IF p_endpoint IS NULL OR p_endpoint NOT IN ('playback','upload') OR p_business_id IS NULL
 OR p_session_hash IS NULL OR p_session_hash!~'^[a-f0-9]{64}$' OR p_ip_hash IS NULL OR p_ip_hash!~'^[a-f0-9]{64}$'
 OR p_preview IS NULL OR p_policy IS NULL OR jsonb_typeof(p_policy)<>'object'
 THEN RAISE EXCEPTION 'INVALID_VIDEO_SECURITY_INPUT'; END IF;
 IF p_endpoint='playback' THEN
  SELECT * INTO m FROM public.product_media WHERE id=p_media_id AND business_id=p_business_id
   AND media_type='video' AND source='mux' AND status='ready' AND mux_playback_id=p_playback_id
   AND mux_asset_id IS NOT NULL AND duration_seconds>0 AND duration_seconds<=15;
  IF NOT FOUND OR (NOT p_preview AND (NOT m.is_published OR NOT public.business_is_publicly_eligible(p_business_id)))
   OR (p_preview AND NOT public.business_is_account_active(p_business_id))
   OR NOT EXISTS(SELECT 1 FROM public.menu_items WHERE id=m.menu_item_id AND business_id=p_business_id AND (p_preview OR is_available))
  THEN RETURN jsonb_build_object('allowed',false,'code','MEDIA_NOT_AVAILABLE','state','NORMAL'); END IF;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM public.businesses WHERE id=p_business_id AND owner_user_id=p_owner_id AND status='ACTIVE')
   OR NOT public.business_is_account_active(p_business_id)
  THEN RETURN jsonb_build_object('allowed',false,'code','MEDIA_NOT_AVAILABLE','state','NORMAL'); END IF;
 END IF;
 v_window:=(p_policy->>'windowSeconds')::integer;
 v_soft:=(p_policy->>'softThreshold')::integer;v_hard:=(p_policy->>'hardThreshold')::integer;
 v_hard_denials:=(p_policy->>'hardDenials')::integer;v_auto:=(p_policy->>'autoCircuit')::boolean;
 IF v_window IS NULL OR v_window NOT BETWEEN 10 AND 3600 OR v_soft IS NULL OR v_soft<1
 OR v_hard IS NULL OR v_hard<=v_soft OR v_hard_denials IS NULL OR v_hard_denials<1 OR v_auto IS NULL
 OR (p_policy->>'blockSeconds')::integer NOT BETWEEN 30 AND 3600 THEN RAISE EXCEPTION 'INVALID_VIDEO_POLICY'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('video-security:'||p_business_id::text,0));
 INSERT INTO public.video_security_state(scope,business_id) VALUES('business:'||p_business_id::text,p_business_id) ON CONFLICT DO NOTHING;
 SELECT * INTO b FROM public.video_security_state WHERE business_id=p_business_id FOR UPDATE;
 SELECT * INTO g FROM public.video_security_state WHERE scope='global';
 IF b.expires_at<=now() THEN
  UPDATE public.video_security_state SET state='NORMAL',expires_at=NULL,manual_until=NULL,updated_at=now()
   WHERE business_id=p_business_id RETURNING * INTO b;
 END IF;
 v_state:=b.state;
 IF p_endpoint='playback' AND ((g.state='HARD_BLOCK' AND (g.expires_at IS NULL OR g.expires_at>now())) OR b.state='HARD_BLOCK') THEN
  v_allowed:=false;v_code:='VIDEO_TEMPORARILY_UNAVAILABLE';
 ELSE
  IF p_endpoint='playback' THEN
   v_rules:=jsonb_build_array(
    jsonb_build_array('video-play-global',repeat('0',64),p_policy->'globalLimit',v_window),
    jsonb_build_array('video-play-business',replace(p_business_id::text,'-','')||repeat('0',32),p_policy->'businessLimit',v_window),
    jsonb_build_array('video-play-session',p_session_hash,p_policy->'sessionLimit',v_window),
    jsonb_build_array('video-play-burst',p_session_hash,p_policy->'burstLimit',10),
    jsonb_build_array('video-play-ip',p_ip_hash,p_policy->'ipLimit',v_window),
    jsonb_build_array('video-play-media',replace(p_media_id::text,'-','')||repeat('0',32),p_policy->'mediaLimit',v_window));
  ELSE
   v_rules:=jsonb_build_array(
    jsonb_build_array('video-upload-business',replace(p_business_id::text,'-','')||repeat('0',32),p_policy->'uploadLimit',p_policy->'uploadWindow'),
    jsonb_build_array('video-upload-owner',replace(p_owner_id::text,'-','')||repeat('0',32),p_policy->'uploadLimit',p_policy->'uploadWindow'),
    jsonb_build_array('video-upload-ip',p_ip_hash,p_policy->'uploadLimit',p_policy->'uploadWindow'),
    jsonb_build_array('video-upload-day',replace(p_business_id::text,'-','')||repeat('0',32),p_policy->'uploadDailyLimit',86400),
    jsonb_build_array('video-upload-owner-day',replace(p_owner_id::text,'-','')||repeat('0',32),p_policy->'uploadDailyLimit',86400));
  END IF;
  FOR v_rule IN SELECT value FROM jsonb_array_elements(v_rules) LOOP
   v_scope:=v_rule->>0;v_subject:=v_rule->>1;v_limit:=(v_rule->>2)::integer;v_seconds:=(v_rule->>3)::integer;
   IF v_limit IS NULL OR v_limit NOT BETWEEN 1 AND 10000 OR v_seconds IS NULL OR v_seconds NOT BETWEEN 10 AND 86400
    THEN RAISE EXCEPTION 'INVALID_VIDEO_POLICY'; END IF;
   v_bucket:=to_timestamp(floor(extract(epoch FROM now())/v_seconds)*v_seconds);
   INSERT INTO public.shared_request_quotas(scope,subject_hash,window_start,count) VALUES(v_scope,v_subject,v_bucket,1)
   ON CONFLICT(scope,subject_hash,window_start) DO UPDATE SET count=least(public.shared_request_quotas.count+1,1000000)
   RETURNING count INTO v_count;
   IF v_scope='video-play-business' THEN v_total:=v_count; END IF;
   IF v_count>v_limit THEN v_allowed:=false;v_code:='RATE_LIMITED'; END IF;
  END LOOP;
  IF p_endpoint='playback' AND NOT v_allowed THEN
   v_bucket:=to_timestamp(floor(extract(epoch FROM now())/v_window)*v_window);
   INSERT INTO public.shared_request_quotas VALUES('video-play-denials',replace(p_business_id::text,'-','')||repeat('0',32),v_bucket,1)
   ON CONFLICT(scope,subject_hash,window_start) DO UPDATE SET count=least(public.shared_request_quotas.count+1,1000000)
   RETURNING count INTO v_denied;
  END IF;
  IF p_endpoint='playback' AND coalesce(b.manual_until<=now(),true) THEN
   IF v_auto AND v_total>=v_hard AND v_denied>=v_hard_denials THEN
    v_state:='HARD_BLOCK';v_allowed:=false;v_code:='VIDEO_TEMPORARILY_UNAVAILABLE';
   ELSIF v_total>=v_soft THEN v_state:='SOFT_ALERT'; END IF;
   IF v_state<>b.state THEN
    UPDATE public.video_security_state SET state=v_state,
     expires_at=now()+make_interval(secs=>CASE WHEN v_state='HARD_BLOCK' THEN (p_policy->>'blockSeconds')::integer ELSE v_window END),updated_at=now()
     WHERE business_id=p_business_id;
    PERFORM public.record_video_abuse(p_business_id,p_media_id,'playback',CASE WHEN v_state='HARD_BLOCK' THEN 'CIRCUIT_BREAKER_HARD' ELSE 'CIRCUIT_BREAKER_SOFT' END);
   END IF;
  END IF;
 END IF;
 PERFORM public.record_video_metric(p_business_id,p_media_id,CASE WHEN p_endpoint='playback' THEN 'playback_token_requests' ELSE 'upload_intents' END);
 PERFORM public.record_video_metric(p_business_id,p_media_id,p_endpoint||CASE WHEN v_allowed THEN '_allowed' ELSE '_blocked' END,
  CASE WHEN p_endpoint='playback' AND v_allowed THEN m.duration_seconds ELSE 0 END);
 IF NOT v_allowed THEN
  PERFORM public.record_video_abuse(p_business_id,p_media_id,p_endpoint,
   CASE WHEN v_code='RATE_LIMITED' THEN CASE WHEN p_endpoint='playback' THEN 'PLAYBACK_TOKEN_ABUSE' ELSE 'UPLOAD_INTENT_ABUSE' END ELSE 'CIRCUIT_BREAKER_HARD' END);
  IF v_code='RATE_LIMITED' THEN PERFORM public.record_video_metric(p_business_id,p_media_id,'rate_limit_hits'); END IF;
 END IF;
 RETURN jsonb_build_object('allowed',v_allowed,'code',v_code,'state',v_state);
END $$;

-- Idempotency lock wraps the current entitlement/reservation authority. No URL/JWT stored.
CREATE FUNCTION public.reserve_video_upload_secure(p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r record;m public.product_media%ROWTYPE;b uuid:=(p_input->>'businessId')::uuid;k text:=p_input->>'idempotencyHash';
BEGIN
 PERFORM public.lock_business_capacity(b);
 IF NOT EXISTS(SELECT 1 FROM public.businesses WHERE id=b AND owner_user_id=(p_input->>'userId')::uuid AND status='ACTIVE')
  THEN RETURN jsonb_build_object('denialCode','BUSINESS_NOT_AUTHORIZED'); END IF;
 IF k IS NOT NULL THEN
  IF k!~'^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'INVALID_IDEMPOTENCY_KEY'; END IF;
  SELECT * INTO m FROM public.product_media WHERE business_id=b AND upload_idempotency_hash=k;
  IF FOUND THEN
   IF m.menu_item_id<>(p_input->>'menuItemId')::uuid OR m.aspect_ratio<>p_input->>'aspectRatio'
    OR m.declared_file_size_bytes<>(p_input->>'declaredFileSizeBytes')::bigint
    OR m.declared_mime_type<>p_input->>'declaredMimeType'
    OR m.replaces_media_id IS DISTINCT FROM (p_input->>'replacesMediaId')::uuid
    THEN RETURN jsonb_build_object('denialCode','IDEMPOTENCY_CONFLICT'); END IF;
   RETURN jsonb_build_object('mediaId',m.id,'reused',true,'uploadId',m.mux_upload_id,'expiresAt',m.upload_expires_at);
  END IF;
 END IF;
 SELECT * INTO r FROM public.reserve_video_upload(b,(p_input->>'userId')::uuid,(p_input->>'menuItemId')::uuid,
  p_input->>'ipHash',(p_input->>'declaredFileSizeBytes')::bigint,p_input->>'declaredMimeType',
  (p_input->>'dailyLimit')::integer,(p_input->>'pendingLimit')::integer,(p_input->>'rateLimit')::integer,
  (p_input->>'rateWindowSeconds')::integer,p_input->>'aspectRatio',(p_input->>'replacesMediaId')::uuid);
 IF r.reserved_media_id IS NOT NULL THEN UPDATE public.product_media SET upload_idempotency_hash=k WHERE id=r.reserved_media_id; END IF;
 RETURN jsonb_build_object('mediaId',r.reserved_media_id,'denialCode',r.denial_code,'reused',false);
END $$;

CREATE FUNCTION public.claim_video_maintenance(p_token uuid,p_seconds integer DEFAULT 240)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.video_maintenance_state%ROWTYPE;BEGIN
 IF p_token IS NULL OR p_seconds NOT BETWEEN 30 AND 900 THEN RAISE EXCEPTION 'INVALID_VIDEO_LEASE'; END IF;
 UPDATE public.video_maintenance_state SET lease_token=p_token,lease_until=now()+make_interval(secs=>p_seconds)
 WHERE singleton AND (lease_until IS NULL OR lease_until<now()) RETURNING * INTO r;
 IF NOT FOUND THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('uploadPage',r.upload_page,'assetPage',r.asset_page,'usageDay',r.usage_day,'usagePage',r.usage_page);
END $$;
CREATE FUNCTION public.finish_video_maintenance(p_token uuid,p_upload_page integer,p_asset_page integer,p_usage_day date DEFAULT NULL,p_usage_page integer DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE public.video_maintenance_state SET upload_page=greatest(1,p_upload_page),asset_page=greatest(1,p_asset_page),
  usage_day=coalesce(p_usage_day,usage_day),usage_page=coalesce(p_usage_page,usage_page),
  lease_token=NULL,lease_until=NULL,last_completed_at=now() WHERE singleton AND lease_token=p_token AND lease_until>now();
 RETURN FOUND;
END $$;

CREATE FUNCTION public.maintain_video_security_state()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 DELETE FROM public.shared_request_quotas WHERE scope LIKE 'video-%' AND window_start<now()-interval '2 days';
 DELETE FROM public.video_abuse_events WHERE window_start<now()-interval '30 days';
 DELETE FROM public.video_usage_daily WHERE day<(now() AT TIME ZONE 'UTC')::date-90;
 DELETE FROM public.video_provider_usage_daily WHERE day<(now() AT TIME ZONE 'UTC')::date-90;
 DELETE FROM public.video_upload_attempts WHERE created_at<now()-interval '7 days';
 DELETE FROM public.mux_webhook_events WHERE status IN ('processed','ignored') AND updated_at<now()-interval '30 days';
END $$;

CREATE FUNCTION public.track_video_lifecycle() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.source='mux' AND NEW.status IS DISTINCT FROM OLD.status THEN
  IF NEW.status IN ('ready','rejected','errored') THEN
   PERFORM public.record_video_metric(NEW.business_id,NEW.id,CASE WHEN NEW.status='ready' THEN 'uploads_ready'
    WHEN NEW.status='rejected' THEN 'uploads_rejected' WHEN NEW.last_error_code='UPLOAD_EXPIRED' THEN 'uploads_expired' ELSE 'uploads_failed' END);
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER track_video_lifecycle AFTER UPDATE ON public.product_media FOR EACH ROW EXECUTE FUNCTION public.track_video_lifecycle();

CREATE FUNCTION public.guard_video_provider_binding() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF OLD.source='mux' AND ((OLD.mux_asset_id IS NOT NULL AND NEW.mux_asset_id IS DISTINCT FROM OLD.mux_asset_id)
  OR (OLD.mux_upload_id IS NOT NULL AND NEW.mux_upload_id IS DISTINCT FROM OLD.mux_upload_id))
 THEN RAISE EXCEPTION 'VIDEO_PROVIDER_BINDING_IMMUTABLE'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_video_provider_binding BEFORE UPDATE ON public.product_media FOR EACH ROW EXECUTE FUNCTION public.guard_video_provider_binding();

CREATE FUNCTION public.admin_set_video_security_state(p_actor uuid,p_business_id uuid,p_state text,p_seconds integer,p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_scope text:=CASE WHEN p_business_id IS NULL THEN 'global' ELSE 'business:'||p_business_id::text END;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.admin_identities WHERE user_id=p_actor AND active AND revoked_at IS NULL)
  THEN RAISE EXCEPTION 'Admin unauthorized'; END IF;
 IF p_state IS NULL OR p_state NOT IN ('NORMAL','SOFT_ALERT','HARD_BLOCK') OR p_seconds IS NULL OR p_seconds NOT BETWEEN 60 AND 86400
 OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'INVALID_VIDEO_OVERRIDE'; END IF;
 IF p_business_id IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended('video-security:'||p_business_id::text,0)); END IF;
 INSERT INTO public.video_security_state(scope,business_id,state,expires_at,manual_until)
 VALUES(v_scope,p_business_id,p_state,now()+make_interval(secs=>p_seconds),now()+make_interval(secs=>p_seconds))
 ON CONFLICT(scope) DO UPDATE SET state=EXCLUDED.state,expires_at=EXCLUDED.expires_at,manual_until=EXCLUDED.manual_until,updated_at=now();
 INSERT INTO public.admin_audit_log(actor_user_id,action,target_type,target_id,details)
 VALUES(p_actor,'VIDEO_SECURITY_OVERRIDE','video_security',v_scope,jsonb_build_object('state',p_state,'seconds',p_seconds,'reason',btrim(p_reason)));
 IF p_business_id IS NOT NULL THEN PERFORM public.record_video_abuse(p_business_id,NULL,'admin','VIDEO_SECURITY_OVERRIDE'); END IF;
END $$;

CREATE FUNCTION public.admin_video_security_report(p_days integer DEFAULT 1,p_page integer DEFAULT 1)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_result jsonb;BEGIN
 IF p_days IS NULL OR p_days NOT IN (1,7,30) OR p_page IS NULL OR p_page NOT BETWEEN 1 AND 10000 THEN RAISE EXCEPTION 'INVALID_VIDEO_REPORT'; END IF;
 WITH usage AS (
  SELECT business_id,jsonb_object_agg(metric,total) AS metrics,sum(seconds) AS seconds FROM (
   SELECT business_id,metric,sum(count) total,sum(estimated_delivery_seconds) seconds FROM public.video_usage_daily
   WHERE day>=(now() AT TIME ZONE 'UTC')::date-(p_days-1) GROUP BY business_id,metric
  ) x GROUP BY business_id
 ), rows AS (
  SELECT b.id AS "businessId",b.name,
   (SELECT p.code FROM public.subscriptions s JOIN public.plans p ON p.id=s.plan_id WHERE s.business_id=b.id LIMIT 1) AS plan,
   (SELECT count(*) FROM public.product_media m WHERE m.business_id=b.id AND m.media_type='video' AND m.status='ready') AS "activeVideos",
   coalesce(u.metrics,'{}'::jsonb) metrics,coalesce(u.seconds,0) AS "estimatedDeliverySeconds",
   (SELECT sum(pu.delivered_seconds) FROM public.video_provider_usage_daily pu WHERE pu.business_id=b.id
    AND pu.day>=(now() AT TIME ZONE 'UTC')::date-(p_days-1)) AS "providerReportedDeliverySeconds",
   CASE WHEN st.expires_at>now() OR st.expires_at IS NULL THEN coalesce(st.state,'NORMAL') ELSE 'NORMAL' END AS state,
   st.expires_at AS "expiresAt"
  FROM public.businesses b LEFT JOIN usage u ON u.business_id=b.id LEFT JOIN public.video_security_state st ON st.business_id=b.id
  ORDER BY coalesce((u.metrics->>'playback_token_requests')::bigint,0) DESC,b.id LIMIT 50 OFFSET (p_page-1)*50
 ) SELECT jsonb_build_object('businesses',coalesce(jsonb_agg(to_jsonb(rows)),'[]'::jsonb)) INTO v_result FROM rows;
 RETURN v_result||jsonb_build_object('page',p_page,'days',p_days,'measurement','ESTIMATED',
  'globalState',(SELECT CASE WHEN expires_at>now() OR expires_at IS NULL THEN state ELSE 'NORMAL' END FROM public.video_security_state WHERE scope='global'),
  'total',(SELECT count(*) FROM public.businesses),
  'media',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) FROM (
   SELECT business_id AS "businessId",media_id AS "mediaId",coalesce(sum(count) FILTER(WHERE metric='playback_token_requests'),0) requests,
    sum(estimated_delivery_seconds) AS "estimatedDeliverySeconds"
   FROM public.video_usage_daily WHERE day>=(now() AT TIME ZONE 'UTC')::date-(p_days-1) AND metric IN ('playback_token_requests','playback_allowed')
   GROUP BY business_id,media_id ORDER BY coalesce(sum(count) FILTER(WHERE metric='playback_token_requests'),0) DESC,business_id,media_id LIMIT 50) x),
  'events',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) FROM (
   SELECT business_id AS "businessId",media_id AS "mediaId",endpoint,code,window_start AS "createdAt",occurrences
   FROM public.video_abuse_events WHERE window_start>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'-make_interval(days=>p_days-1)
   ORDER BY window_start DESC,business_id LIMIT 100) x));
END $$;

DO $$DECLARE f record;BEGIN
 FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname IN ('record_video_metric','record_video_abuse','consume_video_security_budget',
  'reserve_video_upload_secure','claim_video_maintenance','finish_video_maintenance','maintain_video_security_state','track_video_lifecycle',
  'guard_video_provider_binding','admin_set_video_security_state','admin_video_security_report') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
 END LOOP;
END $$;
