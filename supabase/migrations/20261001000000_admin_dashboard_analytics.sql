-- Admin dashboard queries and explicit publication. Apply after admin phase 1.
CREATE INDEX IF NOT EXISTS businesses_created_at_id_idx ON public.businesses(created_at DESC,id);
CREATE INDEX IF NOT EXISTS menu_items_business_created_idx ON public.menu_items(business_id,created_at DESC);
CREATE INDEX IF NOT EXISTS platform_events_business_name_time_idx
  ON public.platform_events(business_id,event_name,occurred_at DESC);
CREATE INDEX IF NOT EXISTS customer_invitations_consumed_idx
  ON public.customer_invitations(consumed_at) WHERE consumed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS mux_webhook_events_failed_time_idx
  ON public.mux_webhook_events(updated_at DESC) WHERE status = 'failed';

-- Existing businesses retain their current publication state. New accounts
-- begin unpublished and enter the public catalog only through publish flow.
ALTER TABLE public.business_account_state ALTER COLUMN is_published SET DEFAULT false;
ALTER TABLE public.business_account_state ADD COLUMN sessions_revoked_at timestamptz;

CREATE OR REPLACE FUNCTION public.business_is_account_active(p_business_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.businesses b
    JOIN public.business_account_state s ON s.business_id = b.id
    WHERE b.id = p_business_id AND b.status = 'ACTIVE' AND s.lifecycle_status = 'ACTIVE'
      AND (auth.uid() IS NULL OR s.sessions_revoked_at IS NULL
        OR to_timestamp(coalesce((auth.jwt()->>'iat')::double precision,0)) > s.sessions_revoked_at)
  );
$$;

CREATE FUNCTION public.publish_business_menu(p_business_id uuid,p_owner_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_owner uuid;
BEGIN
  SELECT owner_user_id INTO v_owner FROM public.businesses WHERE id = p_business_id;
  IF NOT FOUND OR v_owner <> p_owner_id OR NOT public.business_is_account_active(p_business_id) THEN
    RETURN false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.menu_items WHERE business_id = p_business_id) THEN
    RAISE EXCEPTION 'Menu needs a product before publication';
  END IF;
  UPDATE public.business_account_state SET is_published = true,updated_at = now()
    WHERE business_id = p_business_id;
  INSERT INTO public.platform_events(business_id,user_id,event_name)
    VALUES (p_business_id,p_owner_id,'MENU_PUBLISHED') ON CONFLICT DO NOTHING;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.publish_business_menu(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.publish_business_menu(uuid,uuid) TO service_role;

-- Revocation stops refresh sessions and places a cutoff on already issued JWTs.
CREATE FUNCTION public.admin_revoke_customer_sessions(p_actor uuid,p_business_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_owner uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_identities
    WHERE user_id = p_actor AND active AND revoked_at IS NULL) THEN
    RAISE EXCEPTION 'Admin unauthorized';
  END IF;
  SELECT owner_user_id INTO v_owner FROM public.businesses WHERE id = p_business_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE public.business_account_state SET sessions_revoked_at = now(),updated_at = now()
    WHERE business_id = p_business_id;
  DELETE FROM auth.sessions WHERE user_id = v_owner;
  INSERT INTO public.admin_audit_log(actor_user_id,action,target_type,target_id,details)
    VALUES (p_actor,'SESSIONS_REVOKED','business',p_business_id::text,
      jsonb_build_object('owner_user_id',v_owner));
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.admin_revoke_customer_sessions(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_customer_sessions(uuid,uuid) TO service_role;

CREATE FUNCTION public.admin_dashboard_report(p_from timestamptz,p_to timestamptz,
  p_timezone text,p_granularity text,p_compare_from timestamptz DEFAULT NULL,
  p_compare_to timestamptz DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_overview jsonb; v_result jsonb;
BEGIN
  IF p_from >= p_to OR p_to-p_from > interval '2 years' OR p_to > now()+interval '1 day'
    OR p_granularity NOT IN ('hour','day','week','month','year')
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=p_timezone)
    OR ((p_compare_from IS NULL) <> (p_compare_to IS NULL))
    OR (p_compare_from IS NOT NULL AND (p_compare_from >= p_compare_to
      OR p_compare_to-p_compare_from > interval '2 years')) THEN
    RAISE EXCEPTION 'Invalid dashboard interval';
  END IF;
  v_overview := public.admin_overview_metrics(p_from,p_to,p_timezone,p_granularity);
  SELECT jsonb_build_object(
    'overview',v_overview,
    'snapshot',jsonb_build_object(
      'clientsTotal',(SELECT count(*) FROM public.businesses),
      'clientsActive',(SELECT count(*) FROM public.business_account_state WHERE lifecycle_status='ACTIVE'),
      'clientsSuspended',(SELECT count(*) FROM public.business_account_state WHERE lifecycle_status='SUSPENDED'),
      'pendingDeletion',(SELECT count(*) FROM public.business_account_state WHERE lifecycle_status='PENDING_DELETION'),
      'menusPublished',(SELECT count(*) FROM public.business_account_state WHERE is_published),
      'products',(SELECT count(*) FROM public.menu_items),
      'images',(SELECT count(*) FROM public.product_media WHERE media_type='image' AND status='ready')
        +(SELECT count(*) FROM public.menu_items i WHERE i.image_url IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM public.product_media m WHERE m.menu_item_id=i.id
            AND m.media_type='image' AND m.status='ready')),
      'videos',(SELECT count(*) FROM public.product_media WHERE media_type='video' AND status='ready'),
      'subscriptionsActive',(SELECT count(*) FROM public.subscriptions WHERE status='active'),
      'subscriptionsGrace',(SELECT count(*) FROM public.subscriptions WHERE status='grace'),
      'subscriptionsPastDue',(SELECT count(*) FROM public.subscriptions WHERE status='past_due'),
      'subscriptionsCanceled',(SELECT count(*) FROM public.subscriptions WHERE status='canceled'),
      'active7d',(SELECT count(DISTINCT business_id) FROM public.platform_events
        WHERE event_name='LOGIN' AND occurred_at>=now()-interval '7 days'),
      'active30d',(SELECT count(DISTINCT business_id) FROM public.platform_events
        WHERE event_name='LOGIN' AND occurred_at>=now()-interval '30 days')
    ),
    'period',jsonb_build_object(
      'newClients',(SELECT count(*) FROM public.businesses WHERE created_at>=p_from AND created_at<p_to),
      'previousNewClients',(SELECT count(*) FROM public.businesses WHERE p_compare_from IS NOT NULL
        AND created_at>=p_compare_from AND created_at<p_compare_to),
      'productsCreated',(SELECT count(*) FROM public.menu_items WHERE created_at>=p_from AND created_at<p_to),
      'previousProductsCreated',(SELECT count(*) FROM public.menu_items WHERE p_compare_from IS NOT NULL
        AND created_at>=p_compare_from AND created_at<p_compare_to),
      'imagesAdded',(SELECT count(*) FROM public.product_media WHERE media_type='image'
        AND status='ready' AND created_at>=p_from AND created_at<p_to),
      'previousImagesAdded',(SELECT count(*) FROM public.product_media WHERE p_compare_from IS NOT NULL
        AND media_type='image' AND status='ready' AND created_at>=p_compare_from AND created_at<p_compare_to),
      'videosAdded',(SELECT count(*) FROM public.product_media WHERE media_type='video'
        AND status='ready' AND created_at>=p_from AND created_at<p_to),
      'previousVideosAdded',(SELECT count(*) FROM public.product_media WHERE p_compare_from IS NOT NULL
        AND media_type='video' AND status='ready' AND created_at>=p_compare_from AND created_at<p_compare_to),
      'publications',(SELECT count(*) FROM public.platform_events
        WHERE event_name='MENU_PUBLISHED' AND occurred_at>=p_from AND occurred_at<p_to),
      'previousPublications',(SELECT count(*) FROM public.platform_events WHERE p_compare_from IS NOT NULL
        AND event_name='MENU_PUBLISHED' AND occurred_at>=p_compare_from AND occurred_at<p_compare_to)
    ),
    'attention',jsonb_build_object(
      'grace',(SELECT count(*) FROM public.subscriptions WHERE status='grace'),
      'failedWebhooks',(SELECT count(*) FROM public.mux_webhook_events
        WHERE status='failed' AND updated_at>=p_from AND updated_at<p_to),
      'rejectedUploads',(SELECT count(*) FROM public.product_media
        WHERE status='rejected' AND updated_at>=p_from AND updated_at<p_to),
      'adminLoginAttempts',(SELECT count(*) FROM public.admin_login_attempts
        WHERE occurred_at>=p_from AND occurred_at<p_to)
    ),
    'funnel',coalesce((SELECT jsonb_build_object(
      'account',count(*),
      'business',count(*) FILTER (WHERE e.business_id IS NOT NULL),
      'category',count(*) FILTER (WHERE e.business_id IS NOT NULL AND c.business_id IS NOT NULL),
      'product',count(*) FILTER (WHERE e.business_id IS NOT NULL AND c.business_id IS NOT NULL AND p.business_id IS NOT NULL),
      'design',count(*) FILTER (WHERE e.business_id IS NOT NULL AND c.business_id IS NOT NULL AND p.business_id IS NOT NULL AND d.business_id IS NOT NULL),
      'published',count(*) FILTER (WHERE e.business_id IS NOT NULL AND c.business_id IS NOT NULL AND p.business_id IS NOT NULL AND d.business_id IS NOT NULL AND pub.business_id IS NOT NULL)
    ) FROM public.businesses b
    LEFT JOIN (SELECT DISTINCT business_id FROM public.platform_events WHERE event_name='BUSINESS_CONFIGURED') e ON e.business_id=b.id
    LEFT JOIN (SELECT DISTINCT business_id FROM public.categories) c ON c.business_id=b.id
    LEFT JOIN (SELECT DISTINCT business_id FROM public.menu_items) p ON p.business_id=b.id
    LEFT JOIN (SELECT DISTINCT business_id FROM public.design_settings) d ON d.business_id=b.id
    LEFT JOIN (SELECT DISTINCT business_id FROM public.platform_events WHERE event_name='MENU_PUBLISHED') pub ON pub.business_id=b.id
    WHERE b.created_at>=p_from AND b.created_at<p_to),'{}'::jsonb),
    'series',coalesce((SELECT jsonb_agg(jsonb_build_object('bucket',bucket,'metric',metric,'value',total)
      ORDER BY bucket,metric) FROM (
        SELECT date_trunc(p_granularity,created_at,p_timezone) bucket,'newClients'::text metric,count(*) total
        FROM public.businesses WHERE created_at>=p_from AND created_at<p_to GROUP BY 1
        UNION ALL
        SELECT bucket,'clientsTotal',
          (SELECT count(*) FROM public.businesses WHERE created_at<p_from)
          + sum(total) OVER (ORDER BY bucket)
        FROM (SELECT date_trunc(p_granularity,created_at,p_timezone) bucket,count(*) total
          FROM public.businesses WHERE created_at>=p_from AND created_at<p_to GROUP BY 1) growth
        UNION ALL
        SELECT date_trunc(p_granularity,created_at,p_timezone),'productsCreated',count(*)
        FROM public.menu_items WHERE created_at>=p_from AND created_at<p_to GROUP BY 1
        UNION ALL
        SELECT date_trunc(p_granularity,occurred_at,p_timezone),'logins',count(*)
        FROM public.platform_events WHERE event_name='LOGIN' AND occurred_at>=p_from AND occurred_at<p_to GROUP BY 1
        UNION ALL
        SELECT date_trunc(p_granularity,occurred_at,p_timezone),'activeBusinesses',count(DISTINCT business_id)
        FROM public.platform_events WHERE event_name='LOGIN' AND occurred_at>=p_from AND occurred_at<p_to GROUP BY 1
        UNION ALL
        SELECT date_trunc(p_granularity,created_at,p_timezone),'imagesAdded',count(*)
        FROM public.product_media WHERE media_type='image' AND status='ready'
          AND created_at>=p_from AND created_at<p_to GROUP BY 1
        UNION ALL
        SELECT date_trunc(p_granularity,created_at,p_timezone),'videosAdded',count(*)
        FROM public.product_media WHERE media_type='video' AND status='ready'
          AND created_at>=p_from AND created_at<p_to GROUP BY 1
        UNION ALL
        SELECT date_trunc(p_granularity,occurred_at,p_timezone),'publications',count(*)
        FROM public.platform_events WHERE event_name='MENU_PUBLISHED'
          AND occurred_at>=p_from AND occurred_at<p_to GROUP BY 1
      ) s),'[]'::jsonb),
    'templates',coalesce((SELECT jsonb_agg(jsonb_build_object('template',template_id,'count',total)
      ORDER BY total DESC) FROM (SELECT template_id,count(*) total FROM public.design_settings
        GROUP BY template_id ORDER BY total DESC LIMIT 10) t),'[]'::jsonb),
    'timings',jsonb_build_object(
      'inviteToSignupSeconds',(SELECT round(avg(extract(epoch FROM consumed_at-created_at)))
        FROM public.customer_invitations WHERE consumed_at>=p_from AND consumed_at<p_to),
      'signupToPublishSeconds',(SELECT round(avg(extract(epoch FROM e.occurred_at-b.created_at)))
        FROM public.platform_events e JOIN public.businesses b ON b.id=e.business_id
        WHERE e.event_name='MENU_PUBLISHED' AND e.occurred_at>=p_from AND e.occurred_at<p_to)
    )
  ) INTO v_result;
  RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.admin_dashboard_report(timestamptz,timestamptz,text,text,timestamptz,timestamptz)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_report(timestamptz,timestamptz,text,text,timestamptz,timestamptz)
  TO service_role;

CREATE FUNCTION public.admin_business_list(p_search text,p_lifecycle text,p_subscription text,
  p_plan text,p_published boolean,p_created_from timestamptz,p_created_to timestamptz,
  p_page integer,p_limit integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_result jsonb;
BEGIN
  IF p_page NOT BETWEEN 1 AND 10000 OR p_limit NOT BETWEEN 1 AND 100
    OR (p_created_from IS NOT NULL AND p_created_to IS NOT NULL AND p_created_from>=p_created_to)
    OR (p_lifecycle IS NOT NULL AND p_lifecycle NOT IN ('ACTIVE','SUSPENDED','PENDING_DELETION','DELETED'))
    OR (p_subscription IS NOT NULL AND p_subscription NOT IN
      ('pending','trialing','active','past_due','grace','suspended','canceled')) THEN
    RAISE EXCEPTION 'Invalid business list filter';
  END IF;
  WITH filtered AS (
    SELECT b.id,b.owner_user_id,b.name,b.slug,b.created_at,u.email,
      a.lifecycle_status,a.is_published,s.status AS subscription_status,p.code AS plan_code
    FROM public.businesses b JOIN auth.users u ON u.id=b.owner_user_id
    JOIN public.business_account_state a ON a.business_id=b.id
    LEFT JOIN public.subscriptions s ON s.business_id=b.id
    LEFT JOIN public.plans p ON p.id=s.plan_id
    WHERE (p_search IS NULL OR b.name ILIKE '%'||p_search||'%'
      OR b.slug ILIKE '%'||p_search||'%' OR u.email ILIKE '%'||p_search||'%'
      OR b.id::text=p_search)
      AND (p_lifecycle IS NULL OR a.lifecycle_status=p_lifecycle)
      AND (p_subscription IS NULL OR s.status=p_subscription)
      AND (p_plan IS NULL OR p.code=p_plan)
      AND (p_published IS NULL OR a.is_published=p_published)
      AND (p_created_from IS NULL OR b.created_at>=p_created_from)
      AND (p_created_to IS NULL OR b.created_at<p_created_to)
  ), page_rows AS (
    SELECT * FROM filtered ORDER BY created_at DESC,id DESC
    OFFSET (p_page-1)*p_limit LIMIT p_limit
  )
  SELECT jsonb_build_object(
    'total',(SELECT count(*) FROM filtered),
    'rows',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id',r.id,'name',r.name,'slug',r.slug,'email',r.email,
      'lifecycleStatus',r.lifecycle_status,'published',r.is_published,
      'subscriptionStatus',r.subscription_status,'plan',r.plan_code,'createdAt',r.created_at,
      'products',(SELECT count(*) FROM public.menu_items i WHERE i.business_id=r.id),
      'images',(SELECT count(*) FROM public.product_media m WHERE m.business_id=r.id AND m.media_type='image' AND m.status='ready'),
      'videos',(SELECT count(*) FROM public.product_media m WHERE m.business_id=r.id AND m.media_type='video' AND m.status='ready'),
      'lastActivity',(SELECT max(e.occurred_at) FROM public.platform_events e WHERE e.business_id=r.id)
    ) ORDER BY r.created_at DESC,r.id DESC) FROM page_rows r),'[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.admin_business_list(text,text,text,text,boolean,timestamptz,timestamptz,integer,integer)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_business_list(text,text,text,text,boolean,timestamptz,timestamptz,integer,integer)
  TO service_role;
