-- Durable deletion workflow. External identifiers remain until provider cleanup succeeds.
CREATE TABLE public.account_purge_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL UNIQUE,
  owner_user_id uuid,
  phase text NOT NULL DEFAULT 'EXTERNAL' CHECK (phase IN ('EXTERNAL','AUTH','COMPLETE')),
  attempts integer NOT NULL DEFAULT 0,
  lease_until timestamptz,
  last_error_code text CHECK (last_error_code ~ '^[A-Z_]{1,60}$'),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX account_purge_jobs_retry_idx ON public.account_purge_jobs(phase,lease_until)
  WHERE phase <> 'COMPLETE';
CREATE TABLE public.account_purge_resources (
  job_id uuid NOT NULL REFERENCES public.account_purge_jobs(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('MUX_ASSET','MUX_UPLOAD','STORAGE_OBJECT')),
  reference text NOT NULL CHECK (length(reference) BETWEEN 1 AND 1000),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','DELETED')),
  deleted_at timestamptz,
  PRIMARY KEY(job_id,kind,reference)
);
CREATE TABLE public.account_purge_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES public.account_purge_jobs(id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK (event_type IN ('STARTED','EXTERNAL_FAILED','RESOURCE_DELETED',
    'DATABASE_REMOVED','AUTH_FAILED','COMPLETE')),
  code text CHECK (code ~ '^[A-Z_]{1,60}$'),
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX account_purge_events_job_time_idx ON public.account_purge_events(job_id,occurred_at DESC);
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['account_purge_jobs','account_purge_resources','account_purge_events'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
    EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO service_role',t);
  END LOOP;
END $$;
REVOKE UPDATE,DELETE ON public.account_purge_events FROM service_role;
GRANT USAGE,SELECT ON SEQUENCE public.account_purge_events_id_seq TO service_role;

CREATE FUNCTION public.guard_started_purge_reversal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF OLD.lifecycle_status='PENDING_DELETION' AND NEW.lifecycle_status<>'PENDING_DELETION'
    AND EXISTS (SELECT 1 FROM public.account_purge_jobs
      WHERE business_id=OLD.business_id AND phase<>'COMPLETE') THEN
    RAISE EXCEPTION 'Account purge already started';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_started_purge_reversal BEFORE UPDATE ON public.business_account_state
  FOR EACH ROW EXECUTE FUNCTION public.guard_started_purge_reversal();

CREATE FUNCTION public.claim_due_account_purge(p_lease_seconds integer DEFAULT 300)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_job public.account_purge_jobs%ROWTYPE; v_business uuid; v_owner uuid;
BEGIN
  IF p_lease_seconds NOT BETWEEN 60 AND 900 THEN RAISE EXCEPTION 'Invalid purge lease'; END IF;
  SELECT * INTO v_job FROM public.account_purge_jobs
    WHERE phase<>'COMPLETE' AND (lease_until IS NULL OR lease_until<now())
    ORDER BY started_at,id FOR UPDATE SKIP LOCKED LIMIT 1;
  IF FOUND THEN
    UPDATE public.account_purge_jobs SET lease_until=now()+make_interval(secs=>p_lease_seconds),
      attempts=attempts+1,last_error_code=NULL WHERE id=v_job.id RETURNING * INTO v_job;
  ELSE
    SELECT s.business_id,b.owner_user_id INTO v_business,v_owner
      FROM public.business_account_state s JOIN public.businesses b ON b.id=s.business_id
      WHERE s.lifecycle_status='PENDING_DELETION' AND s.deletion_scheduled_at<=now()
        AND NOT EXISTS (SELECT 1 FROM public.account_purge_jobs j WHERE j.business_id=s.business_id)
      ORDER BY s.deletion_scheduled_at,s.business_id FOR UPDATE OF s SKIP LOCKED LIMIT 1;
    IF NOT FOUND THEN RETURN NULL; END IF;
    INSERT INTO public.account_purge_jobs(business_id,owner_user_id,attempts,lease_until)
      VALUES(v_business,v_owner,1,now()+make_interval(secs=>p_lease_seconds))
      RETURNING * INTO v_job;
    INSERT INTO public.account_purge_events(job_id,event_type) VALUES(v_job.id,'STARTED');
  END IF;
  IF v_job.phase='EXTERNAL' THEN
    INSERT INTO public.account_purge_resources(job_id,kind,reference)
      SELECT v_job.id,'MUX_ASSET',mux_asset_id FROM public.product_media
      WHERE business_id=v_job.business_id AND mux_asset_id IS NOT NULL ON CONFLICT DO NOTHING;
    INSERT INTO public.account_purge_resources(job_id,kind,reference)
      SELECT v_job.id,'MUX_UPLOAD',mux_upload_id FROM public.product_media
      WHERE business_id=v_job.business_id AND mux_upload_id IS NOT NULL ON CONFLICT DO NOTHING;
    INSERT INTO public.account_purge_resources(job_id,kind,reference)
      SELECT v_job.id,'STORAGE_OBJECT',storage_object_path FROM public.product_media
      WHERE business_id=v_job.business_id AND storage_object_path IS NOT NULL ON CONFLICT DO NOTHING;
  END IF;
  RETURN jsonb_build_object('jobId',v_job.id,'businessId',v_job.business_id,
    'ownerUserId',v_job.owner_user_id,'phase',v_job.phase,
    'resources',coalesce((SELECT jsonb_agg(jsonb_build_object('kind',kind,'reference',reference)
      ORDER BY kind,reference) FROM public.account_purge_resources
      WHERE job_id=v_job.id AND status='PENDING'),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.claim_due_account_purge(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_account_purge(integer) TO service_role;

CREATE FUNCTION public.mark_account_purge_resource(p_job_id uuid,p_kind text,p_reference text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.account_purge_resources SET status='DELETED',deleted_at=coalesce(deleted_at,now())
    WHERE job_id=p_job_id AND kind=p_kind AND reference=p_reference AND status='PENDING'
      AND EXISTS (SELECT 1 FROM public.account_purge_jobs
        WHERE id=p_job_id AND phase='EXTERNAL' AND lease_until>now());
  IF FOUND THEN
    INSERT INTO public.account_purge_events(job_id,event_type) VALUES(p_job_id,'RESOURCE_DELETED');
    RETURN true;
  END IF;
  RETURN EXISTS (SELECT 1 FROM public.account_purge_resources WHERE job_id=p_job_id
    AND kind=p_kind AND reference=p_reference AND status='DELETED');
END $$;
REVOKE ALL ON FUNCTION public.mark_account_purge_resource(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mark_account_purge_resource(uuid,text,text) TO service_role;

CREATE FUNCTION public.add_account_purge_storage_resource(p_job_id uuid,p_reference text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_business uuid;
BEGIN
  SELECT business_id INTO v_business FROM public.account_purge_jobs
    WHERE id=p_job_id AND phase='EXTERNAL' AND lease_until>now();
  IF NOT FOUND OR p_reference NOT LIKE v_business::text || '/%'
    OR length(p_reference)>1000 OR position('..' in p_reference)>0 THEN
    RAISE EXCEPTION 'Invalid storage purge resource';
  END IF;
  INSERT INTO public.account_purge_resources(job_id,kind,reference)
    VALUES(p_job_id,'STORAGE_OBJECT',p_reference) ON CONFLICT DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.add_account_purge_storage_resource(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.add_account_purge_storage_resource(uuid,text) TO service_role;

CREATE FUNCTION public.add_account_purge_storage_resources(p_job_id uuid,p_references text[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_business uuid; v_count integer;
BEGIN
  SELECT business_id INTO v_business FROM public.account_purge_jobs
    WHERE id=p_job_id AND phase='EXTERNAL' AND lease_until>now();
  IF NOT FOUND OR cardinality(p_references)>100 OR EXISTS (
    SELECT 1 FROM unnest(p_references) r
    WHERE r IS NULL OR r NOT LIKE v_business::text || '/%'
      OR length(r)>1000 OR position('..' in r)>0) THEN
    RAISE EXCEPTION 'Invalid storage purge inventory';
  END IF;
  INSERT INTO public.account_purge_resources(job_id,kind,reference)
    SELECT p_job_id,'STORAGE_OBJECT',r FROM unnest(p_references) r WHERE true ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.add_account_purge_storage_resources(uuid,text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.add_account_purge_storage_resources(uuid,text[]) TO service_role;

CREATE FUNCTION public.release_account_purge_lease(p_job_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  UPDATE public.account_purge_jobs SET lease_until=NULL
    WHERE id=p_job_id AND phase='EXTERNAL' AND lease_until>now();
$$;
REVOKE ALL ON FUNCTION public.release_account_purge_lease(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.release_account_purge_lease(uuid) TO service_role;

CREATE FUNCTION public.fail_account_purge(p_job_id uuid,p_phase text,p_code text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_code !~ '^[A-Z_]{1,60}$' OR p_phase NOT IN ('EXTERNAL','AUTH') THEN
    RAISE EXCEPTION 'Invalid purge failure';
  END IF;
  UPDATE public.account_purge_jobs SET lease_until=now()+interval '5 minutes',last_error_code=p_code
    WHERE id=p_job_id AND phase=p_phase;
  IF FOUND THEN
    INSERT INTO public.account_purge_events(job_id,event_type,code)
      VALUES(p_job_id,CASE WHEN p_phase='AUTH' THEN 'AUTH_FAILED' ELSE 'EXTERNAL_FAILED' END,p_code);
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.fail_account_purge(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fail_account_purge(uuid,text,text) TO service_role;

CREATE FUNCTION public.remove_account_data_after_external_purge(p_job_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_job public.account_purge_jobs%ROWTYPE; v_email text;
BEGIN
  SELECT * INTO v_job FROM public.account_purge_jobs WHERE id=p_job_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_job.phase='AUTH' THEN RETURN true; END IF;
  IF v_job.phase<>'EXTERNAL' OR v_job.lease_until<=now() THEN
    RAISE EXCEPTION 'Purge lease unavailable';
  END IF;
  IF EXISTS (SELECT 1 FROM public.account_purge_resources WHERE job_id=p_job_id AND status<>'DELETED') THEN
    RAISE EXCEPTION 'External purge incomplete';
  END IF;
  -- New references may have appeared after initial inventory due to a delayed provider event.
  INSERT INTO public.account_purge_resources(job_id,kind,reference)
    SELECT p_job_id,'MUX_ASSET',mux_asset_id FROM public.product_media
    WHERE business_id=v_job.business_id AND mux_asset_id IS NOT NULL ON CONFLICT DO NOTHING;
  INSERT INTO public.account_purge_resources(job_id,kind,reference)
    SELECT p_job_id,'MUX_UPLOAD',mux_upload_id FROM public.product_media
    WHERE business_id=v_job.business_id AND mux_upload_id IS NOT NULL ON CONFLICT DO NOTHING;
  INSERT INTO public.account_purge_resources(job_id,kind,reference)
    SELECT p_job_id,'STORAGE_OBJECT',storage_object_path FROM public.product_media
    WHERE business_id=v_job.business_id AND storage_object_path IS NOT NULL ON CONFLICT DO NOTHING;
  IF EXISTS (SELECT 1 FROM public.account_purge_resources WHERE job_id=p_job_id AND status<>'DELETED') THEN
    RETURN false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.business_account_state
    WHERE business_id=v_job.business_id AND lifecycle_status='PENDING_DELETION'
      AND deletion_scheduled_at<=now() FOR UPDATE) THEN
    RAISE EXCEPTION 'Purge state changed';
  END IF;
  IF EXISTS (SELECT 1 FROM public.admin_identities WHERE user_id=v_job.owner_user_id) THEN
    RAISE EXCEPTION 'Admin owner requires manual review';
  END IF;
  SELECT lower(email) INTO v_email FROM auth.users WHERE id=v_job.owner_user_id;
  DELETE FROM public.customer_invitations
    WHERE consumed_by=v_job.owner_user_id OR (v_email IS NOT NULL AND email=v_email);
  DELETE FROM public.platform_events WHERE business_id=v_job.business_id OR user_id=v_job.owner_user_id;
  DELETE FROM public.subscription_events WHERE business_id=v_job.business_id;
  DELETE FROM public.subscription_adjustments WHERE business_id=v_job.business_id;
  DELETE FROM public.subscriptions WHERE business_id=v_job.business_id;
  DELETE FROM auth.sessions WHERE user_id=v_job.owner_user_id;
  UPDATE public.admin_audit_log SET details='{}'::jsonb
    WHERE target_type='business' AND target_id=v_job.business_id::text;
  DELETE FROM public.businesses WHERE id=v_job.business_id;
  UPDATE public.account_purge_jobs SET phase='AUTH',last_error_code=NULL WHERE id=p_job_id;
  INSERT INTO public.account_purge_events(job_id,event_type) VALUES(p_job_id,'DATABASE_REMOVED');
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.remove_account_data_after_external_purge(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.remove_account_data_after_external_purge(uuid) TO service_role;

CREATE FUNCTION public.complete_account_purge(p_job_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.account_purge_jobs SET phase='COMPLETE',owner_user_id=NULL,lease_until=NULL,
    last_error_code=NULL,completed_at=now()
    WHERE id=p_job_id AND phase='AUTH' AND lease_until>now();
  IF NOT FOUND THEN RETURN false; END IF;
  DELETE FROM public.account_purge_resources WHERE job_id=p_job_id;
  INSERT INTO public.account_purge_events(job_id,event_type) VALUES(p_job_id,'COMPLETE');
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.complete_account_purge(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.complete_account_purge(uuid) TO service_role;
