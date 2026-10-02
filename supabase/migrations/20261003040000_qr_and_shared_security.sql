-- Phase 4: stable QR identities, bounded configuration and shared abuse budgets.
ALTER TABLE public.analytics_qr_refs
 ADD COLUMN public_identifier uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
 ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(),
 ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(),
 ADD COLUMN revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 ADD COLUMN configuration jsonb NOT NULL DEFAULT '{"color":"#2C1024","frame":"card","caption":"Acesse nosso cardápio","logoPng":null}',
 ADD COLUMN status text GENERATED ALWAYS AS (CASE WHEN active THEN 'ACTIVE' ELSE 'PAUSED' END) STORED,
 ADD CONSTRAINT qr_configuration_bounded CHECK(jsonb_typeof(configuration)='object' AND octet_length(configuration::text)<=50000);

CREATE TABLE public.qr_settings (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 max_codes_per_business integer NOT NULL DEFAULT 20 CHECK(max_codes_per_business BETWEEN 1 AND 100)
);
INSERT INTO public.qr_settings(singleton) VALUES(true);
CREATE TABLE public.shared_request_quotas (
 scope text NOT NULL CHECK(scope ~ '^[a-z-]{1,40}$'),
 subject_hash text NOT NULL CHECK(subject_hash ~ '^[a-f0-9]{64}$'),
 window_start timestamptz NOT NULL, count integer NOT NULL CHECK(count>0),
 PRIMARY KEY(scope,subject_hash,window_start)
);
CREATE INDEX shared_request_quotas_retention_idx ON public.shared_request_quotas(window_start);
CREATE TABLE public.analytics_qr_entry_windows (
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 visitor_id text NOT NULL CHECK(visitor_id ~ '^[a-f0-9]{64}$'),
 qr_key uuid NOT NULL, last_entry_at timestamptz NOT NULL,
 PRIMARY KEY(business_id,visitor_id,qr_key)
);
CREATE INDEX analytics_qr_entry_windows_retention_idx ON public.analytics_qr_entry_windows(last_entry_at);
DO $$DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['qr_settings','shared_request_quotas','analytics_qr_entry_windows'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
  EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
 END LOOP;
END $$;

-- Atomic counters shared by every instance; quota denials commit, never raise inside the RPC.
CREATE FUNCTION public.reserve_shared_request(p_scope text,p_subject_hash text,p_limit integer,p_window_seconds integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_window timestamptz;v_count integer;BEGIN
 IF p_scope IS NULL OR p_scope!~'^[a-z-]{1,40}$' OR p_subject_hash IS NULL OR p_subject_hash!~'^[a-f0-9]{64}$'
 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 10000 OR p_window_seconds IS NULL OR p_window_seconds NOT BETWEEN 10 AND 86400
 THEN RAISE EXCEPTION 'INVALID_SHARED_QUOTA'; END IF;
 v_window:=to_timestamp(floor(extract(epoch FROM now())/p_window_seconds)*p_window_seconds);
 INSERT INTO public.shared_request_quotas VALUES(p_scope,p_subject_hash,v_window,1)
 ON CONFLICT(scope,subject_hash,window_start) DO UPDATE SET count=least(public.shared_request_quotas.count+1,p_limit+1)
 RETURNING count INTO v_count;
 RETURN v_count<=p_limit;
END $$;

-- This is a private BFF RPC: p_business is always resolved from the owner's cookie.
-- The same capacity lock as subscription changes closes create/downgrade races.
CREATE FUNCTION public.manage_business_qr(p_business uuid,p_id uuid,p_label text,p_configuration jsonb,p_active boolean,p_revision integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s jsonb;r public.analytics_qr_refs%ROWTYPE;v_max integer;BEGIN
 PERFORM public.lock_business_capacity(p_business);
 s:=public.business_entitlement_snapshot(p_business);
 IF coalesce((s->'entitlements'->>'QR_GENERATOR')::boolean,false) IS NOT TRUE THEN RAISE EXCEPTION 'QR_NOT_ENTITLED'; END IF;
 IF p_label IS NULL OR length(btrim(p_label)) NOT BETWEEN 1 AND 120 OR p_active IS NULL OR p_configuration IS NULL
 OR jsonb_typeof(p_configuration)<>'object' OR octet_length(p_configuration::text)>50000
 OR NOT(p_configuration ?& ARRAY['color','frame','caption','logoPng'])
 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_configuration)k WHERE k NOT IN ('color','frame','caption','logoPng'))
 OR coalesce(p_configuration->>'color','')!~'^#[a-fA-F0-9]{6}$'
 OR coalesce(p_configuration->>'frame','') NOT IN ('none','card')
 OR p_configuration->>'caption' IS NULL OR length(p_configuration->>'caption')>40
 OR (p_configuration->'logoPng'<>'null'::jsonb AND (jsonb_typeof(p_configuration->'logoPng')<>'string'
     OR coalesce(p_configuration->>'logoPng','')!~'^data:image/png;base64,[A-Za-z0-9+/]+={0,2}$'))
 THEN RAISE EXCEPTION 'INVALID_QR_CONFIGURATION'; END IF;
 IF coalesce((s->'entitlements'->>'QR_CUSTOMIZATION')::boolean,false) IS NOT TRUE
 AND p_configuration<>'{"color":"#2C1024","frame":"card","caption":"Acesse nosso cardápio","logoPng":null}'::jsonb
 THEN RAISE EXCEPTION 'QR_CUSTOMIZATION_NOT_ENTITLED'; END IF;
 IF p_id IS NULL THEN
  SELECT max_codes_per_business INTO v_max FROM public.qr_settings WHERE singleton;
  IF (SELECT count(*) FROM public.analytics_qr_refs WHERE business_id=p_business)>=v_max THEN RAISE EXCEPTION 'QR_CAPACITY_REACHED'; END IF;
  INSERT INTO public.analytics_qr_refs(business_id,label,configuration,active)
  VALUES(p_business,btrim(p_label),p_configuration,p_active) RETURNING * INTO r;
 ELSE
  SELECT * INTO r FROM public.analytics_qr_refs WHERE id=p_id AND business_id=p_business FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'QR_NOT_FOUND'; END IF;
  IF p_revision IS NULL OR r.revision<>p_revision THEN RAISE EXCEPTION 'QR_VERSION_CONFLICT'; END IF;
  UPDATE public.analytics_qr_refs SET label=btrim(p_label),configuration=p_configuration,active=p_active,
   updated_at=now(),revision=revision+1 WHERE id=p_id AND business_id=p_business RETURNING * INTO r;
 END IF;
 RETURN to_jsonb(r);
END $$;

-- Reloads and concurrent batches with distinct page/event UUIDs still count one entry.
-- Session identity is pseudonymous, supplied by the client and NOT proof of a physical scan.
CREATE FUNCTION public.deduplicate_qr_entry() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE accepted timestamptz;BEGIN
 IF NEW.event_name<>'QR_ENTRY' THEN RETURN NEW; END IF;
 IF NEW.visitor_id IS NULL OR NEW.source<>'qr' THEN RAISE EXCEPTION 'INVALID_ANALYTICS_EVENT'; END IF;
 IF EXISTS(SELECT 1 FROM public.analytics_events WHERE business_id=NEW.business_id
  AND (id=NEW.id OR dedupe_key=NEW.dedupe_key)) THEN RETURN NULL; END IF;
 INSERT INTO public.analytics_qr_entry_windows VALUES(NEW.business_id,NEW.visitor_id,
  coalesce(NEW.qr_id,'00000000-0000-0000-0000-000000000000'),now())
 ON CONFLICT(business_id,visitor_id,qr_key) DO UPDATE SET last_entry_at=EXCLUDED.last_entry_at
 WHERE public.analytics_qr_entry_windows.last_entry_at<=now()-interval '30 minutes'
 RETURNING last_entry_at INTO accepted;
 IF accepted IS NULL THEN RETURN NULL; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER deduplicate_qr_entry BEFORE INSERT ON public.analytics_events FOR EACH ROW EXECUTE FUNCTION public.deduplicate_qr_entry();

CREATE FUNCTION public.maintain_shared_security_state() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n integer;m integer;BEGIN
 DELETE FROM public.shared_request_quotas WHERE window_start<now()-interval '2 days';GET DIAGNOSTICS n=ROW_COUNT;
 DELETE FROM public.analytics_qr_entry_windows WHERE last_entry_at<now()-interval '2 days';GET DIAGNOSTICS m=ROW_COUNT;
 RETURN n+m;
END $$;
REVOKE ALL ON FUNCTION public.reserve_shared_request(text,text,integer,integer),
 public.manage_business_qr(uuid,uuid,text,jsonb,boolean,integer),public.deduplicate_qr_entry(),public.maintain_shared_security_state()
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_shared_request(text,text,integer,integer),
 public.manage_business_qr(uuid,uuid,text,jsonb,boolean,integer),public.maintain_shared_security_state() TO service_role;
