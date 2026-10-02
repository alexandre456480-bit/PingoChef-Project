-- Administrative phase 1. Apply after 20260930000000_admin_foundation.sql.
-- Billing is deliberately disabled until an operator explicitly enables it.
CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z][A-Z0-9_]{1,49}$'),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 100),
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.plan_entitlements (
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  feature_key text NOT NULL CHECK (feature_key ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  value jsonb NOT NULL CHECK (jsonb_typeof(value) IN ('boolean','number','string')),
  PRIMARY KEY (plan_id, feature_key)
);
CREATE TABLE public.commercial_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  billing_enforced boolean NOT NULL DEFAULT false,
  grace_days integer NOT NULL DEFAULT 3 CHECK (grace_days BETWEEN 0 AND 30),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.commercial_settings(singleton) VALUES (true);
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL UNIQUE REFERENCES public.businesses(id) ON DELETE RESTRICT,
  plan_id uuid REFERENCES public.plans(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('pending','trialing','active','past_due','grace','suspended','canceled')),
  started_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  grace_until timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (current_period_start IS NULL OR current_period_end IS NULL OR current_period_start < current_period_end),
  CHECK (grace_until IS NULL OR current_period_end IS NULL OR grace_until >= current_period_end)
);
CREATE UNIQUE INDEX subscriptions_provider_customer_idx ON public.subscriptions(provider, provider_customer_id)
  WHERE provider IS NOT NULL AND provider_customer_id IS NOT NULL;
CREATE UNIQUE INDEX subscriptions_provider_subscription_idx ON public.subscriptions(provider, provider_subscription_id)
  WHERE provider IS NOT NULL AND provider_subscription_id IS NOT NULL;
CREATE INDEX subscriptions_status_period_idx ON public.subscriptions(status, current_period_end);
CREATE TABLE public.subscription_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE RESTRICT,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  event_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX subscription_events_business_time_idx ON public.subscription_events(business_id, occurred_at DESC);
CREATE TABLE public.subscription_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  type text NOT NULL CHECK (type = 'FREE_DAYS'),
  value integer NOT NULL CHECK (value BETWEEN 1 AND 365),
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 3 AND 500),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  created_by_admin uuid NOT NULL REFERENCES public.admin_identities(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX subscription_adjustments_business_end_idx
  ON public.subscription_adjustments(business_id, ends_at DESC);

-- Immutable application events. Metadata is empty by default and never stores PII.
CREATE TABLE public.platform_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_name text NOT NULL CHECK (event_name IN (
    'ACCOUNT_CREATED','BUSINESS_CONFIGURED','FIRST_CATEGORY_CREATED','FIRST_PRODUCT_CREATED',
    'DESIGN_CONFIGURED','MENU_PUBLISHED','VIDEO_UPLOADED','LOGIN')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (metadata = '{}'::jsonb),
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX platform_events_name_time_idx ON public.platform_events(event_name, occurred_at DESC);
CREATE INDEX platform_events_business_time_idx ON public.platform_events(business_id, occurred_at DESC);
CREATE INDEX platform_events_occurred_idx ON public.platform_events(occurred_at DESC);
CREATE UNIQUE INDEX platform_events_first_once_idx ON public.platform_events(business_id, event_name)
  WHERE event_name IN ('ACCOUNT_CREATED','BUSINESS_CONFIGURED','FIRST_CATEGORY_CREATED',
    'FIRST_PRODUCT_CREATED','DESIGN_CONFIGURED','MENU_PUBLISHED');

ALTER TABLE public.admin_audit_log ADD COLUMN ip inet;
ALTER TABLE public.admin_audit_log ADD COLUMN user_agent text;
ALTER TABLE public.admin_audit_log ADD COLUMN request_id uuid;
CREATE INDEX admin_audit_log_action_time_idx ON public.admin_audit_log(action, created_at DESC);
ALTER TABLE public.admin_sessions ADD COLUMN reauthenticated_at timestamptz;
ALTER TABLE public.customer_invitations ADD COLUMN attempt_count integer NOT NULL DEFAULT 0
  CHECK (attempt_count BETWEEN 0 AND 5);

CREATE FUNCTION public.reserve_admin_login_attempt(p_email_hash text)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id bigint;
BEGIN
  IF p_email_hash !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Invalid login hash'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('admin-login:' || p_email_hash,0));
  IF (SELECT count(*) FROM public.admin_login_attempts
      WHERE email_hash = p_email_hash AND occurred_at >= now() - interval '15 minutes') >= 5 THEN
    RETURN NULL;
  END IF;
  INSERT INTO public.admin_login_attempts(email_hash) VALUES (p_email_hash) RETURNING id INTO v_id;
  RETURN v_id;
END $$;
CREATE FUNCTION public.clear_admin_login_attempt(p_id bigint, p_email_hash text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  DELETE FROM public.admin_login_attempts WHERE id = p_id AND email_hash = p_email_hash;
END $$;
REVOKE ALL ON FUNCTION public.reserve_admin_login_attempt(text),
  public.clear_admin_login_attempt(bigint,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_admin_login_attempt(text),
  public.clear_admin_login_attempt(bigint,text) TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_customer_invitation(p_code_hash text, p_email text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_invitation public.customer_invitations%ROWTYPE; v_reservation uuid := gen_random_uuid();
BEGIN
  SELECT * INTO v_invitation FROM public.customer_invitations
    WHERE code_hash = p_code_hash FOR UPDATE;
  IF NOT FOUND OR v_invitation.attempt_count >= 5 THEN RETURN NULL; END IF;
  UPDATE public.customer_invitations SET attempt_count = attempt_count + 1 WHERE id = v_invitation.id;
  IF v_invitation.email <> lower(btrim(p_email)) OR v_invitation.expires_at <= now()
    OR NOT (v_invitation.status = 'ISSUED' OR
      (v_invitation.status = 'RESERVED' AND v_invitation.reserved_at < now() - interval '10 minutes')) THEN
    RETURN NULL;
  END IF;
  UPDATE public.customer_invitations SET status = 'RESERVED', reservation_id = v_reservation,
    reserved_at = now() WHERE id = v_invitation.id;
  RETURN v_reservation;
END $$;

CREATE FUNCTION public.record_subscription_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.subscription_events(subscription_id,business_id,event_type,metadata)
      VALUES (NEW.id,NEW.business_id,'CREATED',jsonb_build_object('status',NEW.status,'plan_id',NEW.plan_id));
  ELSIF NEW.status IS DISTINCT FROM OLD.status
    OR NEW.plan_id IS DISTINCT FROM OLD.plan_id
    OR NEW.current_period_end IS DISTINCT FROM OLD.current_period_end THEN
    INSERT INTO public.subscription_events(subscription_id,business_id,event_type,metadata)
      VALUES (NEW.id,NEW.business_id,'CHANGED',
        jsonb_build_object('status',NEW.status,'plan_id',NEW.plan_id));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER record_subscription_change AFTER INSERT OR UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.record_subscription_change();

CREATE FUNCTION public.guard_new_media_for_inactive_business()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.business_is_account_active(NEW.business_id)
    OR NOT public.business_is_commercially_eligible(NEW.business_id) THEN
    RAISE EXCEPTION 'Business is not eligible for uploads';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_new_media_for_inactive_business BEFORE INSERT ON public.product_media
  FOR EACH ROW EXECUTE FUNCTION public.guard_new_media_for_inactive_business();
CREATE TRIGGER guard_new_video_attempt_for_inactive_business BEFORE INSERT ON public.video_upload_attempts
  FOR EACH ROW EXECUTE FUNCTION public.guard_new_media_for_inactive_business();

CREATE FUNCTION public.normalize_admin_audit_action()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_headers jsonb;
BEGIN
  v_headers := coalesce(nullif(current_setting('request.headers',true),'')::jsonb,'{}'::jsonb);
  NEW.ip := coalesce(NEW.ip,nullif(v_headers->>'x-admin-client-ip','')::inet);
  NEW.user_agent := coalesce(NEW.user_agent,left(v_headers->>'x-admin-user-agent',512));
  NEW.request_id := coalesce(NEW.request_id,nullif(v_headers->>'x-admin-request-id','')::uuid);
  NEW.action := CASE NEW.action
    WHEN 'admin.login' THEN 'ADMIN_LOGIN'
    WHEN 'admin.logout' THEN 'SESSIONS_REVOKED'
    WHEN 'invitation.created' THEN 'INVITE_CREATED'
    WHEN 'invitation.revoked' THEN 'INVITE_REVOKED'
    WHEN 'business.lifecycle_changed' THEN CASE
      WHEN NEW.details->>'to' = 'SUSPENDED' AND NEW.details->>'from' = 'ACTIVE'
        THEN 'BUSINESS_SUSPENDED'
      WHEN NEW.details->>'to' = 'ACTIVE' AND NEW.details->>'from' = 'SUSPENDED'
        THEN 'BUSINESS_REACTIVATED'
      WHEN NEW.details->>'to' = 'PENDING_DELETION' THEN 'DELETION_SCHEDULED'
      WHEN NEW.details->>'from' = 'PENDING_DELETION' THEN 'DELETION_CANCELED'
      ELSE 'BUSINESS_LIFECYCLE_CHANGED' END
    ELSE NEW.action END;
  RETURN NEW;
END $$;
CREATE TRIGGER normalize_admin_audit_action BEFORE INSERT ON public.admin_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.normalize_admin_audit_action();

CREATE OR REPLACE FUNCTION public.set_business_lifecycle(
  p_actor uuid, p_business_id uuid, p_next_status text, p_reason text,
  p_retention_days integer DEFAULT 30
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_current text; v_legacy_status text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_identities
    WHERE user_id = p_actor AND active AND revoked_at IS NULL) THEN
    RAISE EXCEPTION 'Admin unauthorized';
  END IF;
  SELECT lifecycle_status INTO v_current FROM public.business_account_state
    WHERE business_id = p_business_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  SELECT status INTO v_legacy_status FROM public.businesses WHERE id = p_business_id FOR UPDATE;
  IF NOT (
    (v_current = 'ACTIVE' AND p_next_status IN ('SUSPENDED','PENDING_DELETION')) OR
    (v_current = 'SUSPENDED' AND p_next_status IN ('ACTIVE','PENDING_DELETION')) OR
    (v_current = 'PENDING_DELETION' AND p_next_status IN ('ACTIVE','SUSPENDED'))
  ) THEN RAISE EXCEPTION 'Invalid lifecycle transition'; END IF;
  IF p_next_status = 'PENDING_DELETION' AND
    (p_retention_days < 1 OR p_retention_days > 365) THEN
    RAISE EXCEPTION 'Invalid retention period';
  END IF;
  IF p_next_status = 'ACTIVE' THEN
    IF v_legacy_status = 'SUSPENDED' THEN
      UPDATE public.businesses SET status = 'ACTIVE', updated_at = now() WHERE id = p_business_id;
    ELSIF v_legacy_status <> 'ACTIVE' THEN
      RAISE EXCEPTION 'Legacy business requires migration';
    END IF;
  END IF;
  UPDATE public.business_account_state SET lifecycle_status = p_next_status,
    suspended_at = CASE WHEN p_next_status = 'SUSPENDED' AND v_current = 'ACTIVE' THEN now()
      WHEN p_next_status = 'ACTIVE' THEN NULL ELSE suspended_at END,
    suspended_reason = CASE WHEN p_next_status = 'SUSPENDED'
      THEN coalesce(nullif(btrim(p_reason),''),suspended_reason)
      WHEN p_next_status = 'ACTIVE' THEN NULL ELSE suspended_reason END,
    deletion_scheduled_at = CASE WHEN p_next_status = 'PENDING_DELETION'
      THEN now() + make_interval(days => p_retention_days) ELSE NULL END,
    updated_at = now()
  WHERE business_id = p_business_id;
  INSERT INTO public.admin_audit_log(actor_user_id,action,target_type,target_id,details)
    VALUES (p_actor,'business.lifecycle_changed','business',p_business_id::text,
      jsonb_build_object('from',v_current,'to',p_next_status,'reason',p_reason));
  RETURN true;
END $$;

-- The expected source state is checked under the same row lock as the update.
CREATE FUNCTION public.admin_transition_business(p_actor uuid, p_business_id uuid,
  p_expected_status text, p_next_status text, p_reason text, p_retention_days integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_status text;
BEGIN
  SELECT lifecycle_status INTO v_status FROM public.business_account_state
    WHERE business_id = p_business_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF NOT (v_status = p_expected_status OR
    (p_expected_status = 'ACTIVE_OR_SUSPENDED' AND v_status IN ('ACTIVE','SUSPENDED'))) THEN
    RAISE EXCEPTION 'Invalid lifecycle transition';
  END IF;
  RETURN public.set_business_lifecycle(p_actor,p_business_id,p_next_status,p_reason,p_retention_days);
END $$;
REVOKE ALL ON FUNCTION public.admin_transition_business(uuid,uuid,text,text,text,integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_transition_business(uuid,uuid,text,text,text,integer)
  TO service_role;

CREATE FUNCTION public.admin_cancel_business_deletion(p_actor uuid, p_business_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_status text; v_suspended_at timestamptz; v_restore text;
BEGIN
  SELECT lifecycle_status,suspended_at INTO v_status,v_suspended_at
    FROM public.business_account_state WHERE business_id = p_business_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_status <> 'PENDING_DELETION' THEN RAISE EXCEPTION 'Invalid lifecycle transition'; END IF;
  v_restore := CASE WHEN v_suspended_at IS NULL THEN 'ACTIVE' ELSE 'SUSPENDED' END;
  PERFORM public.set_business_lifecycle(p_actor,p_business_id,v_restore,NULL,30);
  RETURN v_restore;
END $$;
REVOKE ALL ON FUNCTION public.admin_cancel_business_deletion(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cancel_business_deletion(uuid,uuid) TO service_role;

CREATE FUNCTION public.reauthenticate_admin_session(p_actor uuid, p_session_hash text,
  p_ip inet DEFAULT NULL, p_user_agent text DEFAULT NULL, p_request_id uuid DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.admin_sessions SET reauthenticated_at = now()
    WHERE user_id = p_actor AND session_hash = p_session_hash AND revoked_at IS NULL
      AND expires_at > now() AND last_seen_at > now() - interval '30 minutes';
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO public.admin_audit_log(actor_user_id,action,target_type,target_id,ip,user_agent,request_id)
    VALUES (p_actor,'ADMIN_REAUTHENTICATED','admin_session',p_session_hash,
      p_ip,left(p_user_agent,512),p_request_id);
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.reauthenticate_admin_session(uuid,text,inet,text,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reauthenticate_admin_session(uuid,text,inet,text,uuid)
  TO service_role;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['plans','plan_entitlements','commercial_settings','subscriptions',
    'subscription_events','subscription_adjustments','platform_events'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO service_role', t);
  END LOOP;
END $$;
REVOKE UPDATE, DELETE ON public.subscription_events, public.subscription_adjustments,
  public.platform_events FROM service_role;
GRANT USAGE, SELECT ON SEQUENCE public.subscription_events_id_seq,
  public.platform_events_id_seq TO service_role;
-- Owners may inspect their own commercial state, never another tenant or mutate it.
GRANT SELECT (id,business_id,plan_id,status,started_at,current_period_start,
  current_period_end,grace_until,cancel_at_period_end,created_at,updated_at)
  ON public.subscriptions TO authenticated;
GRANT SELECT (id,business_id,type,value,reason,starts_at,ends_at,created_at)
  ON public.subscription_adjustments TO authenticated;
GRANT SELECT ON public.plans, public.plan_entitlements TO authenticated;
CREATE POLICY subscriptions_owner_read ON public.subscriptions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.owner_user_id = auth.uid()));
CREATE POLICY adjustments_owner_read ON public.subscription_adjustments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.owner_user_id = auth.uid()));
CREATE POLICY plans_authenticated_read ON public.plans FOR SELECT TO authenticated USING (active);
CREATE POLICY entitlements_authenticated_read ON public.plan_entitlements FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.plans p WHERE p.id = plan_id AND p.active));

CREATE OR REPLACE FUNCTION public.business_is_commercially_eligible(p_business_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.commercial_settings c WHERE NOT c.billing_enforced)
    OR EXISTS (SELECT 1 FROM public.subscription_adjustments a
      WHERE a.business_id = p_business_id AND a.type = 'FREE_DAYS'
        AND a.starts_at <= now() AND a.ends_at > now())
    OR EXISTS (SELECT 1 FROM public.subscriptions s CROSS JOIN public.commercial_settings c
      WHERE s.business_id = p_business_id AND c.billing_enforced
        AND s.status IN ('trialing','active','past_due','grace')
        AND s.current_period_end IS NOT NULL
        AND (s.current_period_end > now()
          OR coalesce(s.grace_until, s.current_period_end + make_interval(days => c.grace_days)) > now()));
$$;

CREATE FUNCTION public.business_feature_entitlement(p_business_id uuid, p_feature_key text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT e.value FROM public.subscriptions s
    JOIN public.plans p ON p.id = s.plan_id AND p.active
    JOIN public.plan_entitlements e ON e.plan_id = p.id
    WHERE s.business_id = p_business_id AND e.feature_key = p_feature_key
      AND s.status IN ('trialing','active','past_due','grace')
      AND public.business_is_account_active(p_business_id)
      AND public.business_is_commercially_eligible(p_business_id);
$$;
REVOKE ALL ON FUNCTION public.business_feature_entitlement(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.business_feature_entitlement(uuid,text) TO service_role;

CREATE FUNCTION public.grant_free_days(p_actor uuid, p_business_id uuid, p_days integer,
  p_reason text, p_ip inet DEFAULT NULL, p_user_agent text DEFAULT NULL, p_request_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_start timestamptz; v_id uuid; v_status text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_identities WHERE user_id = p_actor AND active AND revoked_at IS NULL) THEN
    RAISE EXCEPTION 'Admin unauthorized';
  END IF;
  IF p_days NOT BETWEEN 1 AND 365 OR length(btrim(p_reason)) NOT BETWEEN 3 AND 500 THEN
    RAISE EXCEPTION 'Invalid free period';
  END IF;
  SELECT lifecycle_status INTO v_status FROM public.business_account_state
    WHERE business_id = p_business_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_status = 'DELETED' THEN RAISE EXCEPTION 'Business deleted'; END IF;
  SELECT greatest(now(), coalesce(max(ends_at), now())) INTO v_start
    FROM public.subscription_adjustments WHERE business_id = p_business_id AND type = 'FREE_DAYS';
  INSERT INTO public.subscription_adjustments(business_id,type,value,reason,starts_at,ends_at,created_by_admin)
    VALUES (p_business_id,'FREE_DAYS',p_days,btrim(p_reason),v_start,
      v_start + make_interval(days => p_days),p_actor) RETURNING id INTO v_id;
  INSERT INTO public.admin_audit_log(actor_user_id,action,target_type,target_id,details,ip,user_agent,request_id)
    VALUES (p_actor,'FREE_PERIOD_GRANTED','business',p_business_id::text,
      jsonb_build_object('adjustment_id',v_id,'days',p_days,'reason',btrim(p_reason)),
      p_ip,left(p_user_agent,512),p_request_id);
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.grant_free_days(uuid,uuid,integer,text,inet,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_free_days(uuid,uuid,integer,text,inet,text,uuid) TO service_role;

-- Stable event producers run in the same transaction as the underlying write.
CREATE FUNCTION public.record_platform_first_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_name text; v_business_id uuid; v_user_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'businesses' THEN
    IF TG_OP = 'INSERT' THEN v_name := 'ACCOUNT_CREATED';
    ELSIF NEW.name IS DISTINCT FROM OLD.name OR NEW.description IS DISTINCT FROM OLD.description
      OR NEW.logo_url IS DISTINCT FROM OLD.logo_url THEN v_name := 'BUSINESS_CONFIGURED';
    END IF;
    v_business_id := NEW.id; v_user_id := NEW.owner_user_id;
  ELSIF TG_TABLE_NAME = 'categories' THEN
    v_name := 'FIRST_CATEGORY_CREATED'; v_business_id := NEW.business_id;
  ELSIF TG_TABLE_NAME = 'menu_items' THEN
    v_name := 'FIRST_PRODUCT_CREATED'; v_business_id := NEW.business_id;
  ELSIF TG_TABLE_NAME = 'design_settings' THEN
    v_name := 'DESIGN_CONFIGURED'; v_business_id := NEW.business_id;
  ELSIF TG_TABLE_NAME = 'business_account_state' THEN
    IF TG_OP = 'UPDATE' AND OLD.is_published = false AND NEW.is_published = true THEN
      v_name := 'MENU_PUBLISHED'; v_business_id := NEW.business_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'product_media' THEN
    IF NEW.media_type = 'video' AND NEW.status = 'ready' THEN
      IF TG_OP = 'INSERT' THEN
        v_name := 'VIDEO_UPLOADED'; v_business_id := NEW.business_id;
      ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
        v_name := 'VIDEO_UPLOADED'; v_business_id := NEW.business_id;
      END IF;
    END IF;
  END IF;
  IF v_name IS NOT NULL THEN
    IF v_user_id IS NULL THEN
      SELECT owner_user_id INTO v_user_id FROM public.businesses WHERE id = v_business_id;
    END IF;
    INSERT INTO public.platform_events(business_id,user_id,event_name)
      VALUES (v_business_id,v_user_id,v_name) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER platform_business_created AFTER INSERT OR UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.record_platform_first_event();
CREATE TRIGGER platform_first_category AFTER INSERT ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.record_platform_first_event();
CREATE TRIGGER platform_first_product AFTER INSERT ON public.menu_items
  FOR EACH ROW EXECUTE FUNCTION public.record_platform_first_event();
CREATE TRIGGER platform_design_configured AFTER INSERT OR UPDATE ON public.design_settings
  FOR EACH ROW EXECUTE FUNCTION public.record_platform_first_event();
CREATE TRIGGER platform_menu_published AFTER UPDATE ON public.business_account_state
  FOR EACH ROW EXECUTE FUNCTION public.record_platform_first_event();
CREATE TRIGGER platform_video_uploaded AFTER INSERT OR UPDATE ON public.product_media
  FOR EACH ROW EXECUTE FUNCTION public.record_platform_first_event();

-- Index-friendly aggregation: the WHERE clause constrains occurred_at first.
CREATE FUNCTION public.admin_overview_metrics(p_from timestamptz, p_to timestamptz,
  p_timezone text, p_granularity text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_result jsonb;
BEGIN
  IF p_from >= p_to OR p_to > now() + interval '1 day'
    OR p_to - p_from > interval '2 years'
    OR p_granularity NOT IN ('hour','day','week','month','year')
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = p_timezone) THEN
    RAISE EXCEPTION 'Invalid metrics interval';
  END IF;
  SELECT jsonb_build_object(
    'events', coalesce((SELECT jsonb_object_agg(event_name,total) FROM (
      SELECT event_name,count(*) AS total FROM public.platform_events
      WHERE occurred_at >= p_from AND occurred_at < p_to GROUP BY event_name
    ) counts), '{}'::jsonb),
    'series', coalesce((SELECT jsonb_agg(jsonb_build_object('bucket',bucket,'eventName',event_name,
      'count',total) ORDER BY bucket,event_name) FROM (
      SELECT date_trunc(p_granularity, occurred_at, p_timezone) AS bucket,
        event_name,count(*) AS total FROM public.platform_events
      WHERE occurred_at >= p_from AND occurred_at < p_to
      GROUP BY 1,2
    ) buckets), '[]'::jsonb),
    'businesses', (SELECT count(*) FROM public.businesses),
    'lifecycle', coalesce((SELECT jsonb_object_agg(lifecycle_status,total) FROM (
      SELECT lifecycle_status,count(*) AS total FROM public.business_account_state
      GROUP BY lifecycle_status
    ) states), '{}'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.admin_overview_metrics(timestamptz,timestamptz,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_overview_metrics(timestamptz,timestamptz,text,text)
  TO service_role;
