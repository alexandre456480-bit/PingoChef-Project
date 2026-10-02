-- Owner phase 1. Apply after 20261002010000_admin_phase3_purge.sql.
-- No content is deleted, passwords changed or existing sessions revoked.
BEGIN;

INSERT INTO public.plan_feature_definitions(feature_key,value_type,description) VALUES
 ('MAX_PRODUCTS','number','Total de produtos por estabelecimento'),
 ('MAX_CATEGORIES','number','Total de categorias por estabelecimento'),
 ('ANALYTICS_BASIC','boolean','Analytics essencial'),
 ('ANALYTICS_ADVANCED','boolean','Analytics avançado'),
 ('ANALYTICS_EXPORT','boolean','Exportação de Analytics'),
 ('QR_GENERATOR','boolean','Geração de QR Code'),
 ('QR_CUSTOMIZATION','boolean','Personalização de QR Code')
ON CONFLICT (feature_key) DO NOTHING;

INSERT INTO public.plans(code,name,active) VALUES
 ('FREE','Free',true),('BASIC','Basic',true),('MEDIUM','Medium',true),('PRO','Pro',true)
ON CONFLICT (code) DO UPDATE SET active=true;

INSERT INTO public.plan_entitlements(plan_id,feature_key,value)
SELECT p.id,e.key,e.value FROM public.plans p CROSS JOIN LATERAL jsonb_each(
 CASE p.code
 WHEN 'FREE' THEN '{"MAX_PRODUCTS":10,"MAX_CATEGORIES":4,"MAX_VIDEOS":1,"VIDEO_UPLOAD":true,"ANALYTICS_BASIC":false,"ANALYTICS_ADVANCED":false,"ANALYTICS_EXPORT":false,"QR_GENERATOR":false,"QR_CUSTOMIZATION":false}'::jsonb
 WHEN 'BASIC' THEN '{"MAX_PRODUCTS":30,"MAX_CATEGORIES":10,"MAX_VIDEOS":7,"VIDEO_UPLOAD":true,"ANALYTICS_BASIC":true,"ANALYTICS_ADVANCED":false,"ANALYTICS_EXPORT":false,"QR_GENERATOR":false,"QR_CUSTOMIZATION":false}'::jsonb
 WHEN 'MEDIUM' THEN '{"MAX_PRODUCTS":70,"MAX_CATEGORIES":25,"MAX_VIDEOS":25,"VIDEO_UPLOAD":true,"ANALYTICS_BASIC":true,"ANALYTICS_ADVANCED":true,"ANALYTICS_EXPORT":false,"QR_GENERATOR":true,"QR_CUSTOMIZATION":true}'::jsonb
 WHEN 'PRO' THEN '{"MAX_PRODUCTS":150,"MAX_CATEGORIES":40,"MAX_VIDEOS":40,"VIDEO_UPLOAD":true,"ANALYTICS_BASIC":true,"ANALYTICS_ADVANCED":true,"ANALYTICS_EXPORT":true,"QR_GENERATOR":true,"QR_CUSTOMIZATION":true}'::jsonb
 END) e WHERE p.code IN ('FREE','BASIC','MEDIUM','PRO')
ON CONFLICT (plan_id,feature_key) DO UPDATE SET value=EXCLUDED.value;

CREATE OR REPLACE FUNCTION public.validate_plan_entitlement_value()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_type text; BEGIN
 SELECT value_type INTO v_type FROM public.plan_feature_definitions WHERE feature_key=NEW.feature_key;
 IF v_type IS NULL OR jsonb_typeof(NEW.value)<>v_type THEN RAISE EXCEPTION 'Invalid plan feature'; END IF;
 IF v_type='number' AND ((NEW.value::text)::numeric<0 OR (NEW.feature_key LIKE 'MAX_%'
   AND ((NEW.value::text)::numeric<>trunc((NEW.value::text)::numeric) OR (NEW.value::text)::numeric>2147483647))) THEN
  RAISE EXCEPTION 'Invalid plan feature';
 END IF;
 RETURN NEW;
END $$;

-- Fail without changing commercial data that needs manual interpretation.
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.subscriptions WHERE plan_id IS NULL AND provider IS NOT NULL) THEN
  RAISE EXCEPTION 'Provider subscriptions without a plan require preflight review';
 END IF;
 IF EXISTS (SELECT 1 FROM public.menu_items i JOIN public.categories c ON c.id=i.category_id WHERE i.business_id<>c.business_id)
 OR EXISTS (SELECT 1 FROM public.subcategories s JOIN public.categories c ON c.id=s.category_id WHERE s.business_id<>c.business_id)
 OR EXISTS (SELECT 1 FROM public.menu_items i JOIN public.subcategories s ON s.id=i.subcategory_id
   WHERE i.business_id<>s.business_id OR i.category_id<>s.category_id) THEN
  RAISE EXCEPTION 'Cross-tenant category relationships require preflight review';
 END IF;
END $$;

ALTER TABLE public.subscriptions
 ADD COLUMN assignment_source text NOT NULL DEFAULT 'LEGACY'
  CHECK (assignment_source IN ('PUBLIC','ADMIN_GRANT','BILLING','LEGACY')),
 ADD COLUMN assigned_by uuid REFERENCES public.admin_identities(user_id),
 ADD COLUMN assignment_reason text,
 ADD COLUMN assigned_at timestamptz NOT NULL DEFAULT now();

UPDATE public.subscriptions SET plan_id=(SELECT id FROM public.plans WHERE code='FREE') WHERE plan_id IS NULL;
INSERT INTO public.subscriptions(business_id,plan_id,status,provider,assignment_source)
SELECT b.id,p.id,'active',NULL,'LEGACY' FROM public.businesses b CROSS JOIN public.plans p
WHERE p.code='FREE' AND NOT EXISTS(SELECT 1 FROM public.subscriptions s WHERE s.business_id=b.id);
ALTER TABLE public.subscriptions ALTER COLUMN plan_id SET NOT NULL;

CREATE FUNCTION public.initialize_free_subscription() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 INSERT INTO public.subscriptions(business_id,plan_id,status,provider,assignment_source,started_at)
 SELECT NEW.id,id,'active',NULL,'PUBLIC',now() FROM public.plans WHERE code='FREE' AND active;
 IF NOT FOUND THEN RAISE EXCEPTION 'FREE plan unavailable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER initialize_free_subscription AFTER INSERT ON public.businesses
 FOR EACH ROW EXECUTE FUNCTION public.initialize_free_subscription();

-- Deferred assertion allows purge to remove subscription and business in one
-- transaction, while rejecting a committed business without its subscription.
CREATE FUNCTION public.assert_business_subscription() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid; BEGIN
 IF TG_TABLE_NAME='businesses' THEN v_id:=NEW.id; ELSE v_id:=OLD.business_id; END IF;
 IF EXISTS(SELECT 1 FROM public.businesses WHERE id=v_id)
  AND NOT EXISTS(SELECT 1 FROM public.subscriptions WHERE business_id=v_id) THEN
  RAISE EXCEPTION 'Business requires a subscription';
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER business_requires_subscription AFTER INSERT ON public.businesses
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.assert_business_subscription();
CREATE CONSTRAINT TRIGGER subscription_removal_guard AFTER DELETE OR UPDATE OF business_id ON public.subscriptions
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.assert_business_subscription();

CREATE OR REPLACE FUNCTION public.business_is_commercially_eligible(p_business_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.commercial_settings WHERE NOT billing_enforced)
 OR EXISTS(SELECT 1 FROM public.subscription_adjustments WHERE business_id=p_business_id
  AND type='FREE_DAYS' AND starts_at<=now() AND ends_at>now())
 OR EXISTS(SELECT 1 FROM public.subscriptions s JOIN public.plans p ON p.id=s.plan_id AND p.active
  CROSS JOIN public.commercial_settings c WHERE s.business_id=p_business_id AND c.billing_enforced
  AND ((s.status='active' AND s.provider IS NULL AND (p.code='FREE' OR s.assignment_source IN ('ADMIN_GRANT','LEGACY')))
   OR (s.status IN ('trialing','active','past_due','grace') AND s.current_period_end IS NOT NULL
    AND (s.current_period_end>now() OR coalesce(s.grace_until,s.current_period_end+make_interval(days=>c.grace_days))>now()))));
$$;

CREATE FUNCTION public.business_usage(p_business_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object(
  'products',(SELECT count(*) FROM public.menu_items WHERE business_id=p_business_id),
  'categories',(SELECT count(*) FROM public.categories WHERE business_id=p_business_id),
  'videos',(SELECT count(DISTINCT menu_item_id) FROM public.product_media WHERE business_id=p_business_id
   AND media_type='video' AND status IN ('waiting','uploading','processing','ready')));
$$;
CREATE FUNCTION public.business_entitlement_snapshot(p_business_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('plan',jsonb_build_object('code',p.code,'name',p.name),
  'subscription',jsonb_build_object('status',s.status,'provider',s.provider,'assignmentSource',s.assignment_source,
   'currentPeriodEnd',s.current_period_end),
  'entitlements',CASE WHEN p.active AND public.business_is_account_active(p_business_id) AND s.status IN ('trialing','active','past_due','grace')
    AND public.business_is_commercially_eligible(p_business_id)
   THEN coalesce((SELECT jsonb_object_agg(feature_key,value) FROM public.plan_entitlements WHERE plan_id=p.id),'{}'::jsonb)
   ELSE '{}'::jsonb END,'usage',public.business_usage(p_business_id))
 FROM public.subscriptions s JOIN public.plans p ON p.id=s.plan_id WHERE s.business_id=p_business_id;
$$;
REVOKE ALL ON FUNCTION public.business_usage(uuid),public.business_entitlement_snapshot(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.business_usage(uuid),public.business_entitlement_snapshot(uuid) TO service_role;

-- All creation and subscription changes for a tenant share this lock. Counting
-- is performed AFTER acquiring it, inside the database transaction.
CREATE FUNCTION public.lock_business_capacity(p_business_id uuid) RETURNS void
LANGUAGE plpgsql VOLATILE SET search_path='' AS $$ BEGIN
 IF current_setting('transaction_isolation') NOT IN ('read committed','serializable') THEN
  RAISE EXCEPTION 'Capacity writes require read committed or serializable isolation';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('business-capacity:'||p_business_id::text,0));
END $$;
CREATE FUNCTION public.lock_subscription_capacity() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 PERFORM public.lock_business_capacity(NEW.business_id);
 IF TG_OP='UPDATE' AND NEW.business_id IS DISTINCT FROM OLD.business_id THEN
  RAISE EXCEPTION 'Subscription business is immutable';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER lock_subscription_capacity BEFORE INSERT OR UPDATE ON public.subscriptions
 FOR EACH ROW EXECUTE FUNCTION public.lock_subscription_capacity();

CREATE FUNCTION public.assert_business_capacity(p_business_id uuid,p_resource text)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_feature text; v_limit integer; v_used integer; BEGIN
 PERFORM public.lock_business_capacity(p_business_id);
 IF NOT public.business_is_account_active(p_business_id) THEN RAISE EXCEPTION 'ACCOUNT_NOT_ACTIVE' USING ERRCODE='P0001'; END IF;
 v_feature:=CASE p_resource WHEN 'products' THEN 'MAX_PRODUCTS' WHEN 'categories' THEN 'MAX_CATEGORIES' WHEN 'videos' THEN 'MAX_VIDEOS' END;
 IF v_feature IS NULL THEN RAISE EXCEPTION 'Invalid resource'; END IF;
 v_limit:=coalesce((public.business_feature_entitlement(p_business_id,v_feature)#>>'{}')::integer,0);
 v_used:=(public.business_usage(p_business_id)->>p_resource)::integer;
 IF v_used>=v_limit THEN
  RAISE EXCEPTION 'LIMIT_EXCEEDED' USING ERRCODE='P0001',
   DETAIL=jsonb_build_object('resource',p_resource,'used',v_used,'limit',v_limit)::text;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.assert_business_capacity(uuid,text),public.lock_business_capacity(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.assert_business_capacity(uuid,text),public.lock_business_capacity(uuid) TO service_role;

CREATE FUNCTION public.guard_content_capacity() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF TG_OP='UPDATE' AND NEW.business_id IS DISTINCT FROM OLD.business_id THEN RAISE EXCEPTION 'Tenant is immutable'; END IF;
 IF TG_OP='INSERT' THEN
  IF TG_TABLE_NAME='menu_items' THEN PERFORM public.assert_business_capacity(NEW.business_id,'products');
  ELSIF TG_TABLE_NAME='categories' THEN PERFORM public.assert_business_capacity(NEW.business_id,'categories');
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_product_capacity BEFORE INSERT OR UPDATE OF business_id ON public.menu_items
 FOR EACH ROW EXECUTE FUNCTION public.guard_content_capacity();
CREATE TRIGGER guard_category_capacity BEFORE INSERT OR UPDATE OF business_id ON public.categories
 FOR EACH ROW EXECUTE FUNCTION public.guard_content_capacity();

CREATE FUNCTION public.guard_video_capacity() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF TG_OP='UPDATE' AND (NEW.business_id IS DISTINCT FROM OLD.business_id OR NEW.menu_item_id IS DISTINCT FROM OLD.menu_item_id) THEN
  RAISE EXCEPTION 'Media tenant and product are immutable';
 END IF;
 IF NEW.media_type='video' AND NEW.status IN ('waiting','uploading','processing','ready') THEN
  PERFORM public.lock_business_capacity(NEW.business_id);
  IF NOT EXISTS(SELECT 1 FROM public.product_media WHERE business_id=NEW.business_id
    AND menu_item_id=NEW.menu_item_id AND id<>NEW.id AND media_type='video'
    AND status IN ('waiting','uploading','processing','ready'))
   AND (TG_OP='INSERT' OR OLD.media_type<>'video' OR OLD.status NOT IN ('waiting','uploading','processing','ready')) THEN
   PERFORM public.assert_business_capacity(NEW.business_id,'videos');
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_video_capacity BEFORE INSERT OR UPDATE ON public.product_media
 FOR EACH ROW EXECUTE FUNCTION public.guard_video_capacity();

-- Includes global daily/IP counters, not just the individual product lock.
CREATE FUNCTION public.lock_video_attempt_capacity() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 PERFORM public.lock_business_capacity(NEW.business_id); RETURN NEW;
END $$;
CREATE TRIGGER lock_video_attempt_capacity BEFORE INSERT ON public.video_upload_attempts
 FOR EACH ROW EXECUTE FUNCTION public.lock_video_attempt_capacity();

ALTER FUNCTION public.reserve_video_upload(uuid,uuid,uuid,text,bigint,text,integer,integer,integer,integer,text,uuid)
 RENAME TO reserve_video_upload_before_owner_limits;
REVOKE ALL ON FUNCTION public.reserve_video_upload_before_owner_limits(uuid,uuid,uuid,text,bigint,text,integer,integer,integer,integer,text,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.reserve_video_upload(p_business_id uuid,p_user_id uuid,p_menu_item_id uuid,p_ip_hash text,
 p_declared_file_size_bytes bigint,p_declared_mime_type text,p_daily_limit integer,p_pending_limit integer,
 p_rate_limit integer,p_rate_window_seconds integer,p_aspect_ratio text DEFAULT '16:9',p_replaces_media_id uuid DEFAULT NULL)
RETURNS TABLE(reserved_media_id uuid,denial_code text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$ BEGIN
 PERFORM public.lock_business_capacity(p_business_id);
 PERFORM pg_advisory_xact_lock(hashtextextended('video-ip:'||p_ip_hash,0));
 IF NOT public.business_is_account_active(p_business_id)
  OR public.business_feature_entitlement(p_business_id,'VIDEO_UPLOAD') IS DISTINCT FROM 'true'::jsonb THEN
  RETURN QUERY SELECT NULL::uuid,'BUSINESS_NOT_AUTHORIZED'::text; RETURN;
 END IF;
 RETURN QUERY SELECT * FROM public.reserve_video_upload_before_owner_limits(p_business_id,p_user_id,p_menu_item_id,
  p_ip_hash,p_declared_file_size_bytes,p_declared_mime_type,p_daily_limit,p_pending_limit,p_rate_limit,
  p_rate_window_seconds,p_aspect_ratio,p_replaces_media_id);
END $$;
REVOKE ALL ON FUNCTION public.reserve_video_upload(uuid,uuid,uuid,text,bigint,text,integer,integer,integer,integer,text,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_video_upload(uuid,uuid,uuid,text,bigint,text,integer,integer,integer,integer,text,uuid) TO service_role;

ALTER TABLE public.categories ADD CONSTRAINT categories_business_id_id_unique UNIQUE(business_id,id);
ALTER TABLE public.subcategories ADD CONSTRAINT subcategories_business_category_id_unique UNIQUE(business_id,category_id,id);
ALTER TABLE public.subcategories ADD CONSTRAINT subcategories_category_tenant_fk
 FOREIGN KEY(business_id,category_id) REFERENCES public.categories(business_id,id) ON DELETE CASCADE;
ALTER TABLE public.menu_items ADD CONSTRAINT menu_items_category_tenant_fk
 FOREIGN KEY(business_id,category_id) REFERENCES public.categories(business_id,id) ON DELETE CASCADE;
ALTER TABLE public.menu_items ADD CONSTRAINT menu_items_subcategory_tenant_fk
 FOREIGN KEY(business_id,category_id,subcategory_id) REFERENCES public.subcategories(business_id,category_id,id)
 DEFERRABLE INITIALLY DEFERRED;

CREATE FUNCTION public.admin_assign_business_plan(p_actor uuid,p_business_id uuid,p_plan_code text,p_reason text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_plan uuid; v_previous uuid; BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.admin_identities WHERE user_id=p_actor AND active AND revoked_at IS NULL) THEN RAISE EXCEPTION 'Admin unauthorized'; END IF;
 IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Reason required'; END IF;
 SELECT id INTO v_plan FROM public.plans WHERE code=p_plan_code AND active;
 IF v_plan IS NULL THEN RAISE EXCEPTION 'Plan unavailable'; END IF;
 PERFORM public.lock_business_capacity(p_business_id);
 IF NOT public.business_is_account_active(p_business_id) THEN RAISE EXCEPTION 'ACCOUNT_NOT_ACTIVE'; END IF;
 SELECT plan_id INTO v_previous FROM public.subscriptions WHERE business_id=p_business_id FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM public.subscriptions WHERE business_id=p_business_id AND provider IS NOT NULL) THEN
  RAISE EXCEPTION 'BILLING_MANAGED_SUBSCRIPTION';
 END IF;
 UPDATE public.subscriptions SET plan_id=v_plan,status='active',provider=NULL,assignment_source='ADMIN_GRANT',
  assigned_by=p_actor,assignment_reason=btrim(p_reason),assigned_at=now(),updated_at=now()
 WHERE business_id=p_business_id;
 INSERT INTO public.admin_audit_log(actor_user_id,action,target_type,target_id,details)
 VALUES(p_actor,'PLAN_ASSIGNED','business',p_business_id::text,jsonb_build_object('fromPlanId',v_previous,'toPlanCode',p_plan_code,'reason',btrim(p_reason)));
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.admin_assign_business_plan(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_assign_business_plan(uuid,uuid,text,text) TO service_role;
COMMIT;
