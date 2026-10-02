-- Phase 3: provider-neutral commercial state and measured operational aggregates.
-- Apply after 20261001000000_admin_dashboard_analytics.sql.

CREATE TABLE public.plan_feature_definitions (
  feature_key text PRIMARY KEY CHECK (feature_key ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  value_type text NOT NULL CHECK (value_type IN ('boolean','number')),
  description text NOT NULL
);
INSERT INTO public.plan_feature_definitions(feature_key,value_type,description) VALUES
  ('VIDEO_UPLOAD','boolean','Permite upload de vídeo'),
  ('MAX_VIDEOS','number','Máximo de vídeos por estabelecimento'),
  ('MAX_IMAGES_PER_PRODUCT','number','Máximo de imagens por produto'),
  ('ADVANCED_ANALYTICS','boolean','Analytics avançado para cliente'),
  ('CUSTOM_QR','boolean','QR personalizado'),
  ('REMOVE_PINGOCHEF_BRANDING','boolean','Remove marca PingoChef');
ALTER TABLE public.plan_entitlements ADD CONSTRAINT plan_entitlements_defined_feature
  FOREIGN KEY (feature_key) REFERENCES public.plan_feature_definitions(feature_key) NOT VALID;
CREATE FUNCTION public.validate_plan_entitlement_value()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_type text;
BEGIN
  SELECT value_type INTO v_type FROM public.plan_feature_definitions WHERE feature_key=NEW.feature_key;
  IF v_type IS NULL OR jsonb_typeof(NEW.value) <> v_type
    OR (v_type='number' AND (NEW.value::text)::numeric < 0) THEN
    RAISE EXCEPTION 'Invalid plan feature';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER validate_plan_entitlement_value BEFORE INSERT OR UPDATE ON public.plan_entitlements
  FOR EACH ROW EXECUTE FUNCTION public.validate_plan_entitlement_value();
ALTER TABLE public.plan_feature_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_feature_definitions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.plan_feature_definitions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.plan_feature_definitions TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.plan_feature_definitions TO service_role;
CREATE POLICY plan_feature_catalog_read ON public.plan_feature_definitions FOR SELECT TO authenticated USING (true);

ALTER TABLE public.subscriptions ADD COLUMN last_provider_event_at timestamptz;
ALTER TABLE public.subscriptions ADD COLUMN payment_method text
  CHECK (payment_method IS NULL OR payment_method IN ('card','pix'));
CREATE TABLE public.billing_webhook_events (
  provider text NOT NULL CHECK (provider ~ '^[a-z][a-z0-9_]{1,39}$'),
  event_id text NOT NULL CHECK (length(event_id) BETWEEN 1 AND 255),
  event_type text NOT NULL CHECK (length(event_type) BETWEEN 1 AND 100),
  payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  provider_occurred_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','processed','failed')),
  attempts integer NOT NULL DEFAULT 1 CHECK (attempts > 0),
  last_error_code text CHECK (last_error_code ~ '^[A-Z_]{1,60}$'),
  PRIMARY KEY(provider,event_id)
);
CREATE INDEX billing_webhook_events_status_time_idx
  ON public.billing_webhook_events(status,received_at DESC);
ALTER TABLE public.billing_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_webhook_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.billing_webhook_events FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.billing_webhook_events TO service_role;

-- Only a verified provider adapter may call this service-role RPC. It stores no
-- raw webhook, payment instrument, signature, card information or customer PII.
CREATE FUNCTION public.apply_verified_billing_event(
  p_provider text,p_event_id text,p_event_type text,p_payload_sha256 text,
  p_occurred_at timestamptz,p_provider_subscription_id text,p_status text,
  p_period_end timestamptz,p_grace_until timestamptz DEFAULT NULL,
  p_payment_method text DEFAULT NULL
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_event public.billing_webhook_events%ROWTYPE; v_sub public.subscriptions%ROWTYPE;
  v_grace_days integer;
BEGIN
  IF p_provider !~ '^[a-z][a-z0-9_]{1,39}$' OR length(p_event_id) NOT BETWEEN 1 AND 255
    OR length(p_event_type) NOT BETWEEN 1 AND 100
    OR p_payload_sha256 !~ '^[0-9a-f]{64}$'
    OR p_provider_subscription_id IS NULL OR length(p_provider_subscription_id) NOT BETWEEN 1 AND 255
    OR p_status IS NULL OR p_status NOT IN ('pending','trialing','active','past_due','grace','suspended','canceled')
    OR (p_payment_method IS NOT NULL AND p_payment_method NOT IN ('card','pix'))
    OR p_occurred_at IS NULL OR p_occurred_at > now() + interval '1 day' THEN
    RAISE EXCEPTION 'Invalid normalized billing event';
  END IF;
  INSERT INTO public.billing_webhook_events(provider,event_id,event_type,payload_sha256,provider_occurred_at)
    VALUES(p_provider,p_event_id,p_event_type,p_payload_sha256,p_occurred_at)
    ON CONFLICT(provider,event_id) DO UPDATE SET attempts=public.billing_webhook_events.attempts+1;
  SELECT * INTO v_event FROM public.billing_webhook_events
    WHERE provider=p_provider AND event_id=p_event_id FOR UPDATE;
  IF v_event.payload_sha256 <> p_payload_sha256 THEN
    RAISE EXCEPTION 'Billing event ID reused with different payload';
  END IF;
  IF v_event.status='processed' THEN RETURN 'duplicate'; END IF;
  SELECT * INTO v_sub FROM public.subscriptions
    WHERE provider=p_provider AND provider_subscription_id=p_provider_subscription_id FOR UPDATE;
  IF NOT FOUND THEN
    UPDATE public.billing_webhook_events SET status='failed',last_error_code='SUBSCRIPTION_UNKNOWN'
      WHERE provider=p_provider AND event_id=p_event_id;
    RETURN 'unmatched';
  END IF;
  IF v_sub.last_provider_event_at IS NOT NULL AND p_occurred_at < v_sub.last_provider_event_at THEN
    UPDATE public.billing_webhook_events SET status='processed',processed_at=now(),last_error_code='STALE_EVENT'
      WHERE provider=p_provider AND event_id=p_event_id;
    RETURN 'stale';
  END IF;
  SELECT grace_days INTO v_grace_days FROM public.commercial_settings WHERE singleton;
  UPDATE public.subscriptions SET status=p_status,
    current_period_end=coalesce(p_period_end,current_period_end),
    grace_until=CASE WHEN p_status IN ('past_due','grace')
      THEN coalesce(p_grace_until,
        coalesce(p_period_end,current_period_end) + make_interval(days => coalesce(v_grace_days,3)))
      ELSE NULL END,
    payment_method=coalesce(p_payment_method,payment_method),
    last_provider_event_at=p_occurred_at,updated_at=now()
    WHERE id=v_sub.id;
  UPDATE public.billing_webhook_events SET status='processed',processed_at=now(),last_error_code=NULL
    WHERE provider=p_provider AND event_id=p_event_id;
  RETURN 'processed';
END $$;
REVOKE ALL ON FUNCTION public.apply_verified_billing_event(text,text,text,text,timestamptz,text,text,timestamptz,timestamptz,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_verified_billing_event(text,text,text,text,timestamptz,text,text,timestamptz,timestamptz,text)
  TO service_role;

-- Called by a scheduled backend worker. Billing remains disabled by default.
CREATE FUNCTION public.advance_subscription_lifecycle(p_limit integer DEFAULT 100)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_count integer;
BEGIN
  IF p_limit NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Invalid batch size'; END IF;
  WITH due AS (
    SELECT s.id FROM public.subscriptions s CROSS JOIN public.commercial_settings c
    WHERE c.billing_enforced AND s.status IN ('trialing','active','past_due','grace')
      AND s.current_period_end <= now()
    ORDER BY s.current_period_end,s.id FOR UPDATE OF s SKIP LOCKED LIMIT p_limit
  )
  UPDATE public.subscriptions s SET
    status=CASE WHEN coalesce(s.grace_until,
      s.current_period_end+make_interval(days => c.grace_days))>now() THEN 'grace' ELSE 'suspended' END,
    grace_until=coalesce(s.grace_until,s.current_period_end+make_interval(days => c.grace_days)),
    updated_at=now()
  FROM due,public.commercial_settings c
  WHERE s.id=due.id AND c.singleton
    AND s.status IS DISTINCT FROM CASE WHEN coalesce(s.grace_until,
      s.current_period_end+make_interval(days => c.grace_days))>now() THEN 'grace' ELSE 'suspended' END;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.advance_subscription_lifecycle(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.advance_subscription_lifecycle(integer) TO service_role;

CREATE TABLE public.api_request_metrics (
  minute_bucket timestamptz NOT NULL,
  route_group text NOT NULL CHECK (route_group ~ '^/api/v1/[a-z/-]{1,80}$'),
  method text NOT NULL CHECK (method IN ('GET','POST','PUT','PATCH','DELETE','OPTIONS')),
  status_code integer NOT NULL CHECK (status_code BETWEEN 100 AND 599),
  requests bigint NOT NULL DEFAULT 0 CHECK (requests >= 0),
  duration_sum_ms bigint NOT NULL DEFAULT 0 CHECK (duration_sum_ms >= 0),
  duration_max_ms integer NOT NULL DEFAULT 0 CHECK (duration_max_ms >= 0),
  PRIMARY KEY(minute_bucket,route_group,method,status_code)
);
CREATE INDEX api_request_metrics_bucket_idx ON public.api_request_metrics(minute_bucket DESC);
ALTER TABLE public.api_request_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_request_metrics FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.api_request_metrics FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.api_request_metrics TO service_role;
CREATE FUNCTION public.record_api_request_metric(p_route text,p_method text,p_status integer,p_duration_ms integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_route !~ '^/api/v1/[a-z/-]{1,80}$' OR p_method NOT IN ('GET','POST','PUT','PATCH','DELETE','OPTIONS')
    OR p_status NOT BETWEEN 100 AND 599 OR p_duration_ms NOT BETWEEN 0 AND 3600000 THEN
    RAISE EXCEPTION 'Invalid API metric';
  END IF;
  INSERT INTO public.api_request_metrics(minute_bucket,route_group,method,status_code,
    requests,duration_sum_ms,duration_max_ms)
  VALUES(date_trunc('minute',now()),p_route,p_method,p_status,1,p_duration_ms,p_duration_ms)
  ON CONFLICT(minute_bucket,route_group,method,status_code) DO UPDATE SET
    requests=public.api_request_metrics.requests+1,
    duration_sum_ms=public.api_request_metrics.duration_sum_ms+EXCLUDED.duration_sum_ms,
    duration_max_ms=greatest(public.api_request_metrics.duration_max_ms,EXCLUDED.duration_max_ms);
END $$;
REVOKE ALL ON FUNCTION public.record_api_request_metric(text,text,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_api_request_metric(text,text,integer,integer) TO service_role;

CREATE FUNCTION public.admin_commercial_report(p_from timestamptz,p_to timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_from>=p_to OR p_to-p_from>interval '2 years' OR p_to>now()+interval '1 day' THEN
    RAISE EXCEPTION 'Invalid commercial interval';
  END IF;
  RETURN jsonb_build_object(
    'statuses',coalesce((SELECT jsonb_object_agg(status,total) FROM
      (SELECT status,count(*) total FROM public.subscriptions GROUP BY status) s),'{}'::jsonb),
    'newSubscriptions',(SELECT count(*) FROM public.subscriptions WHERE created_at>=p_from AND created_at<p_to),
    'cancellations',(SELECT count(DISTINCT subscription_id) FROM public.subscription_events
      WHERE occurred_at>=p_from AND occurred_at<p_to AND metadata->>'status'='canceled'),
    'planDistribution',coalesce((SELECT jsonb_agg(jsonb_build_object('plan',code,'count',total)) FROM
      (SELECT coalesce(p.code,'NO_PLAN') code,count(*) total FROM public.subscriptions s
        LEFT JOIN public.plans p ON p.id=s.plan_id GROUP BY p.code ORDER BY total DESC) x),'[]'::jsonb),
    'graceDays',(SELECT grace_days FROM public.commercial_settings WHERE singleton),
    'billingEnforced',(SELECT billing_enforced FROM public.commercial_settings WHERE singleton),
    'financial',jsonb_build_object('mrr',NULL,'recognizedRevenue',NULL,'approvedPayments',NULL,
      'churn',NULL,'arpu',NULL,'delinquentAmount',NULL,'revenueByPlan',NULL,
      'availability','PROVIDER_NOT_CONFIGURED')
  );
END $$;
REVOKE ALL ON FUNCTION public.admin_commercial_report(timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_commercial_report(timestamptz,timestamptz) TO service_role;

CREATE FUNCTION public.admin_infrastructure_report(p_from timestamptz,p_to timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_from>=p_to OR p_to-p_from>interval '2 years' OR p_to>now()+interval '1 day' THEN
    RAISE EXCEPTION 'Invalid infrastructure interval';
  END IF;
  RETURN jsonb_build_object(
    'mux',jsonb_build_object(
      'status',coalesce((SELECT jsonb_object_agg(status,total) FROM
        (SELECT status,count(*) total FROM public.product_media WHERE media_type='video' GROUP BY status) x),'{}'::jsonb),
      'uploads',(SELECT count(*) FROM public.video_upload_attempts WHERE created_at>=p_from AND created_at<p_to),
      'declaredUploadBytes',(SELECT coalesce(sum(declared_file_size_bytes),0) FROM public.video_upload_attempts
        WHERE created_at>=p_from AND created_at<p_to),
      'deliveryBytes',NULL,'providerStorageBytes',NULL),
    'storage',jsonb_build_object(
      'trackedImages',(SELECT count(*) FROM public.product_media WHERE media_type='image' AND source='storage'),
      'newTrackedImages',(SELECT count(*) FROM public.product_media WHERE media_type='image' AND source='storage'
        AND created_at>=p_from AND created_at<p_to),'storageBytes',NULL),
    'database',jsonb_build_object('businesses',(SELECT count(*) FROM public.businesses),
      'products',(SELECT count(*) FROM public.menu_items),'media',(SELECT count(*) FROM public.product_media),
      'databaseBytes',NULL),
    'api',jsonb_build_object(
      'requests',(SELECT coalesce(sum(requests),0) FROM public.api_request_metrics
        WHERE minute_bucket>=p_from AND minute_bucket<p_to),
      'errors5xx',(SELECT coalesce(sum(requests),0) FROM public.api_request_metrics
        WHERE minute_bucket>=p_from AND minute_bucket<p_to AND status_code>=500),
      'rateLimits',(SELECT coalesce(sum(requests),0) FROM public.api_request_metrics
        WHERE minute_bucket>=p_from AND minute_bucket<p_to AND status_code=429),
      'averageLatencyMs',(SELECT round(sum(duration_sum_ms)::numeric/nullif(sum(requests),0))
        FROM public.api_request_metrics WHERE minute_bucket>=p_from AND minute_bucket<p_to),
      'maxLatencyMs',(SELECT max(duration_max_ms) FROM public.api_request_metrics
        WHERE minute_bucket>=p_from AND minute_bucket<p_to)),
    'byBusiness',coalesce((SELECT jsonb_agg(jsonb_build_object('businessId',business_id,
      'uploads',total) ORDER BY total DESC) FROM
      (SELECT business_id,count(*) total FROM public.video_upload_attempts
        WHERE created_at>=p_from AND created_at<p_to GROUP BY business_id ORDER BY total DESC LIMIT 10) top),'[]'::jsonb),
    'byBusinessStorage',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'businessId',business_id,'trackedImages',total,'newTrackedImages',recent) ORDER BY total DESC)
      FROM (SELECT business_id,count(*) total,
        count(*) FILTER (WHERE created_at>=p_from AND created_at<p_to) recent
        FROM public.product_media WHERE media_type='image' AND source='storage'
        GROUP BY business_id ORDER BY total DESC LIMIT 10) storage_top),'[]'::jsonb),
    'alerts',coalesce((SELECT jsonb_agg(jsonb_build_object('code',code,'businessId',business_id,
      'count',total,'threshold',threshold) ORDER BY total DESC) FROM (
        SELECT 'UPLOAD_SURGE'::text code,business_id,count(*) total,15::bigint threshold
        FROM public.video_upload_attempts WHERE created_at>=p_from AND created_at<p_to
        GROUP BY business_id,date_trunc('day',created_at) HAVING count(*)>=15
        UNION ALL
        SELECT 'IMAGE_SURGE',business_id,count(*),30::bigint FROM public.product_media
        WHERE media_type='image' AND source='storage' AND created_at>=p_from AND created_at<p_to
        GROUP BY business_id,date_trunc('day',created_at) HAVING count(*)>=30
        UNION ALL
        SELECT 'VIDEO_REJECTIONS',business_id,count(*),3::bigint FROM public.product_media
        WHERE media_type='video' AND status IN ('rejected','errored')
          AND updated_at>=p_from AND updated_at<p_to GROUP BY business_id HAVING count(*)>=3
        UNION ALL
        SELECT 'FAILED_MUX_WEBHOOK',NULL::uuid,count(*),3::bigint FROM public.mux_webhook_events
        WHERE status='failed' AND updated_at>=p_from AND updated_at<p_to HAVING count(*)>=3
        UNION ALL
        SELECT 'FAILED_BILLING_WEBHOOK',NULL::uuid,count(*),1::bigint FROM public.billing_webhook_events
        WHERE status='failed' AND received_at>=p_from AND received_at<p_to HAVING count(*)>=1
        UNION ALL
        SELECT 'ADMIN_LOGIN_ATTEMPTS',NULL::uuid,count(*),5::bigint FROM public.admin_login_attempts
        WHERE occurred_at>=p_from AND occurred_at<p_to HAVING count(*)>=5
        UNION ALL
        SELECT 'API_RATE_LIMITS',NULL::uuid,sum(requests),20::bigint FROM public.api_request_metrics
        WHERE status_code=429 AND minute_bucket>=p_from AND minute_bucket<p_to HAVING sum(requests)>=20
        UNION ALL
        SELECT 'API_5XX',NULL::uuid,sum(requests),10::bigint FROM public.api_request_metrics
        WHERE status_code>=500 AND minute_bucket>=p_from AND minute_bucket<p_to HAVING sum(requests)>=10
      ) anomalies),'[]'::jsonb),
    'measurement',jsonb_build_object('api','BEST_EFFORT_PERSISTED',
      'mux','DATABASE_EVENTS','storageBytes','UNAVAILABLE','costs','UNAVAILABLE')
  );
END $$;
REVOKE ALL ON FUNCTION public.admin_infrastructure_report(timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_infrastructure_report(timestamptz,timestamptz) TO service_role;

-- Audit entries must not keep even a hash of an administrative session token.
UPDATE public.admin_audit_log SET target_id=actor_user_id::text WHERE target_type='admin_session';
-- User-Agent is caller-controlled and could have contained a credential.
UPDATE public.admin_audit_log SET user_agent=NULL WHERE user_agent IS NOT NULL;
CREATE FUNCTION public.scrub_admin_session_audit_target()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.target_type='admin_session' THEN NEW.target_id:=NEW.actor_user_id::text; END IF;
  NEW.user_agent:=NULL;
  RETURN NEW;
END $$;
CREATE TRIGGER zz_scrub_admin_session_audit_target BEFORE INSERT ON public.admin_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.scrub_admin_session_audit_target();
