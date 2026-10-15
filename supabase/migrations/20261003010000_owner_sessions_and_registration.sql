BEGIN;
CREATE TABLE public.owner_sessions (
 session_hash text PRIMARY KEY CHECK(session_hash ~ '^[a-f0-9]{64}$'),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 scope text NOT NULL DEFAULT 'owner' CHECK(scope IN ('owner','recovery')),
 encrypted_tokens text NOT NULL,
 token_expires_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 last_seen_at timestamptz NOT NULL DEFAULT now(),
 revoked_at timestamptz,
 refresh_lease uuid,
 refresh_lease_until timestamptz,
 CHECK(expires_at>created_at)
);
CREATE INDEX owner_sessions_user_active_idx ON public.owner_sessions(user_id,expires_at) WHERE revoked_at IS NULL;
ALTER TABLE public.owner_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_sessions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.owner_sessions FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.owner_sessions TO service_role;

CREATE TABLE public.owner_auth_attempts (
 action text NOT NULL CHECK(action IN ('login','register','forgot','resend','reauthenticate')),
 subject_hash text NOT NULL CHECK(subject_hash ~ '^[a-f0-9]{64}$'),
 window_start timestamptz NOT NULL,
 attempts integer NOT NULL DEFAULT 1 CHECK(attempts>0),
 PRIMARY KEY(action,subject_hash,window_start)
);
ALTER TABLE public.owner_auth_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_auth_attempts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.owner_auth_attempts FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.owner_auth_attempts TO service_role;
CREATE FUNCTION public.reserve_owner_auth_attempt(p_action text,p_subject_hash text,p_limit integer,p_window_seconds integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_count integer; v_start timestamptz; BEGIN
 IF p_limit NOT BETWEEN 1 AND 100 OR p_window_seconds NOT BETWEEN 60 AND 86400 THEN RAISE EXCEPTION 'Invalid rate limit'; END IF;
 v_start:=to_timestamp(floor(extract(epoch FROM now())/p_window_seconds)*p_window_seconds);
 INSERT INTO public.owner_auth_attempts(action,subject_hash,window_start) VALUES(p_action,p_subject_hash,v_start)
 ON CONFLICT(action,subject_hash,window_start) DO UPDATE SET attempts=public.owner_auth_attempts.attempts+1
 RETURNING attempts INTO v_count;
 RETURN v_count<=p_limit;
END $$;
REVOKE ALL ON FUNCTION public.reserve_owner_auth_attempt(text,text,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_owner_auth_attempt(text,text,integer,integer) TO service_role;

CREATE TABLE public.registration_intents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 email text NOT NULL CHECK(email=lower(btrim(email)) AND length(email)<=254),
 selected_plan_id uuid NOT NULL REFERENCES public.plans(id),
 source text NOT NULL CHECK(source IN ('PUBLIC','ADMIN_INVITE','PROMOTION')),
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','AWAITING_EMAIL','COMPLETED','EXPIRED')),
 auth_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
 full_name text NOT NULL CHECK(length(full_name) BETWEEN 2 AND 120),
 business_name text NOT NULL CHECK(length(business_name) BETWEEN 2 AND 120),
 slug text NOT NULL CHECK(slug ~ '^[a-z0-9-]{3,50}$'),
 phone text CHECK(length(phone)<=30),
 invitation_id uuid REFERENCES public.customer_invitations(id),
 invitation_reservation_id uuid,
 expires_at timestamptz NOT NULL DEFAULT now()+interval '24 hours',
 created_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz,
 CHECK((source='ADMIN_INVITE')=(invitation_id IS NOT NULL))
);
CREATE UNIQUE INDEX registration_intents_user_pending_idx ON public.registration_intents(auth_user_id)
 WHERE auth_user_id IS NOT NULL AND status IN ('PENDING','AWAITING_EMAIL');
CREATE UNIQUE INDEX registration_intents_email_pending_idx ON public.registration_intents(email)
 WHERE status IN ('PENDING','AWAITING_EMAIL');
CREATE UNIQUE INDEX registration_intents_invitation_idx ON public.registration_intents(invitation_id)
 WHERE invitation_id IS NOT NULL AND status<>'EXPIRED';
CREATE INDEX registration_intents_email_idx ON public.registration_intents(email,created_at DESC);
ALTER TABLE public.registration_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_intents FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.registration_intents FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.registration_intents TO service_role;

CREATE FUNCTION public.start_owner_registration(p_email text,p_full_name text,p_business_name text,p_slug text,
 p_phone text,p_plan_code text,p_invitation_hash text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_plan uuid; v_invite public.customer_invitations%ROWTYPE; v_id uuid; v_reservation uuid; BEGIN
 -- A browser choice is an intent, never authority to receive a paid plan.
 IF p_plan_code IS DISTINCT FROM 'FREE' THEN RAISE EXCEPTION 'PAID_PLAN_UNAVAILABLE'; END IF;
 SELECT id INTO v_plan FROM public.plans WHERE code='FREE' AND active;
 IF v_plan IS NULL THEN RAISE EXCEPTION 'FREE plan unavailable'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('registration-email:'||lower(btrim(p_email)),0));
 -- An existing identity cannot be rebound to a new intent by unauthenticated signup.
 IF EXISTS(SELECT 1 FROM auth.users WHERE lower(email)=lower(btrim(p_email))) THEN RETURN NULL; END IF;
 IF EXISTS(SELECT 1 FROM public.registration_intents WHERE email=lower(btrim(p_email)) AND status IN ('PENDING','AWAITING_EMAIL')) THEN RETURN NULL; END IF;
 IF p_invitation_hash IS NOT NULL THEN
  SELECT * INTO v_invite FROM public.customer_invitations WHERE code_hash=p_invitation_hash FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_INVITATION'; END IF;
  IF v_invite.email<>lower(btrim(p_email)) OR v_invite.expires_at<=now() OR v_invite.status<>'ISSUED'
    OR v_invite.attempt_count>=5 THEN RAISE EXCEPTION 'INVALID_INVITATION'; END IF;
  v_reservation:=gen_random_uuid();
  UPDATE public.customer_invitations SET status='RESERVED',reservation_id=v_reservation,reserved_at=now(),
   attempt_count=attempt_count+1 WHERE id=v_invite.id;
 END IF;
 INSERT INTO public.registration_intents(email,selected_plan_id,source,full_name,business_name,slug,phone,
  invitation_id,invitation_reservation_id,expires_at)
 VALUES(lower(btrim(p_email)),v_plan,CASE WHEN p_invitation_hash IS NULL THEN 'PUBLIC' ELSE 'ADMIN_INVITE' END,
  btrim(p_full_name),btrim(p_business_name),p_slug,p_phone,v_invite.id,v_reservation,
  least(now()+interval '24 hours',coalesce(v_invite.expires_at,now()+interval '24 hours')))
 RETURNING id INTO v_id;
 RETURN v_id;
END $$;

CREATE FUNCTION public.bind_owner_registration(p_intent_id uuid,p_user_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 UPDATE public.registration_intents i SET auth_user_id=p_user_id,status='AWAITING_EMAIL'
 WHERE i.id=p_intent_id AND i.status='PENDING' AND i.expires_at>now()
 AND EXISTS(SELECT 1 FROM auth.users u WHERE u.id=p_user_id AND lower(u.email)=i.email
  AND u.created_at>=i.created_at-interval '5 seconds')
 AND NOT EXISTS(SELECT 1 FROM public.businesses WHERE owner_user_id=p_user_id);
 RETURN FOUND;
END $$;

CREATE FUNCTION public.provision_owner_account(p_user_id uuid,p_intent_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_intent public.registration_intents%ROWTYPE; v_business uuid; v_invite public.customer_invitations%ROWTYPE; BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('owner-provision:'||p_user_id::text,0));
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_user_id AND email_confirmed_at IS NOT NULL)
  OR EXISTS(SELECT 1 FROM public.admin_identities WHERE user_id=p_user_id) THEN RAISE EXCEPTION 'EMAIL_NOT_CONFIRMED'; END IF;
 -- Supplying a forged intent must fail even for an already provisioned owner.
 IF p_intent_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.registration_intents WHERE id=p_intent_id AND auth_user_id=p_user_id) THEN
  RAISE EXCEPTION 'INVALID_REGISTRATION_INTENT';
 END IF;
 SELECT id INTO v_business FROM public.businesses WHERE owner_user_id=p_user_id;
 IF v_business IS NOT NULL THEN RETURN v_business; END IF;
 SELECT * INTO v_intent FROM public.registration_intents WHERE auth_user_id=p_user_id
  AND (p_intent_id IS NULL OR id=p_intent_id) AND status='AWAITING_EMAIL' ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF v_intent.expires_at<=now() THEN RAISE EXCEPTION 'REGISTRATION_EXPIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_user_id AND lower(email)=v_intent.email) THEN RAISE EXCEPTION 'INVALID_REGISTRATION_INTENT'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.plans WHERE id=v_intent.selected_plan_id AND code='FREE' AND active) THEN
  RAISE EXCEPTION 'PAID_PLAN_UNAVAILABLE';
 END IF;
 IF v_intent.source='ADMIN_INVITE' THEN
  SELECT * INTO v_invite FROM public.customer_invitations WHERE id=v_intent.invitation_id FOR UPDATE;
  IF NOT FOUND OR v_invite.status<>'RESERVED' OR v_invite.reservation_id IS DISTINCT FROM v_intent.invitation_reservation_id
   OR v_invite.expires_at<=now() OR v_invite.email<>v_intent.email THEN RAISE EXCEPTION 'INVALID_INVITATION'; END IF;
 END IF;
 INSERT INTO public.profiles(id,full_name,phone) VALUES(p_user_id,v_intent.full_name,v_intent.phone) ON CONFLICT(id) DO NOTHING;
 INSERT INTO public.businesses(owner_user_id,name,slug,phone,whatsapp,status)
 VALUES(p_user_id,v_intent.business_name,v_intent.slug,v_intent.phone,v_intent.phone,'ACTIVE') RETURNING id INTO v_business;
 -- Subscription FREE/active is inserted by the business trigger in this transaction.
 IF v_intent.invitation_id IS NOT NULL THEN
  UPDATE public.customer_invitations SET status='CONSUMED',reservation_id=NULL,reserved_at=NULL,consumed_at=now(),consumed_by=p_user_id
  WHERE id=v_intent.invitation_id;
 END IF;
 UPDATE public.registration_intents SET status='COMPLETED',completed_at=now() WHERE id=v_intent.id;
 RETURN v_business;
END $$;

-- Retire the old endpoint's auto-confirmed provisioning path; preserve invitation data.
REVOKE ALL ON FUNCTION public.complete_customer_registration(text,uuid,uuid,text,text,text,text,text) FROM service_role;
REVOKE ALL ON FUNCTION public.start_owner_registration(text,text,text,text,text,text,text),
 public.bind_owner_registration(uuid,uuid),public.provision_owner_account(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.start_owner_registration(text,text,text,text,text,text,text),
 public.bind_owner_registration(uuid,uuid),public.provision_owner_account(uuid,uuid) TO service_role;

CREATE FUNCTION public.create_owner_session(p_hash text,p_user_id uuid,p_scope text,p_tokens text,p_token_expires_at timestamptz,
 p_expires_at timestamptz,p_previous_hash text DEFAULT NULL,p_auth_issued_at bigint DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('owner-sessions:'||p_user_id::text,0));
 IF EXISTS(SELECT 1 FROM public.admin_identities WHERE user_id=p_user_id)
  OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_user_id AND email_confirmed_at IS NOT NULL)
  OR p_expires_at>now()+interval '8 hours' OR p_expires_at<=now() THEN RETURN false; END IF;
 IF p_scope='owner' AND EXISTS(SELECT 1 FROM public.business_account_state s JOIN public.businesses b ON b.id=s.business_id
  WHERE b.owner_user_id=p_user_id AND s.sessions_revoked_at IS NOT NULL
   AND (p_auth_issued_at IS NULL OR to_timestamp(p_auth_issued_at)<=s.sessions_revoked_at)) THEN RETURN false; END IF;
 IF p_previous_hash IS NOT NULL THEN
  UPDATE public.owner_sessions SET revoked_at=now(),encrypted_tokens='' WHERE session_hash=p_previous_hash AND revoked_at IS NULL;
 END IF;
 INSERT INTO public.owner_sessions(session_hash,user_id,scope,encrypted_tokens,token_expires_at,expires_at)
 VALUES(p_hash,p_user_id,p_scope,p_tokens,p_token_expires_at,p_expires_at);
 RETURN true;
END $$;

CREATE FUNCTION public.claim_owner_session_refresh(p_hash text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_lease uuid:=gen_random_uuid(); BEGIN
 UPDATE public.owner_sessions SET refresh_lease=v_lease,refresh_lease_until=now()+interval '30 seconds'
 WHERE session_hash=p_hash AND revoked_at IS NULL AND expires_at>now()
  AND last_seen_at>now()-interval '30 minutes' AND token_expires_at<now()+interval '60 seconds'
  AND (refresh_lease_until IS NULL OR refresh_lease_until<now());
 IF FOUND THEN RETURN v_lease; END IF; RETURN NULL;
END $$;
CREATE FUNCTION public.complete_owner_session_refresh(p_hash text,p_lease uuid,p_tokens text,p_token_expires_at timestamptz)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 UPDATE public.owner_sessions SET encrypted_tokens=p_tokens,token_expires_at=p_token_expires_at,
  refresh_lease=NULL,refresh_lease_until=NULL
 WHERE session_hash=p_hash AND refresh_lease=p_lease AND refresh_lease_until>now()
  AND revoked_at IS NULL AND expires_at>now() AND last_seen_at>now()-interval '30 minutes';
 RETURN FOUND;
END $$;
CREATE FUNCTION public.revoke_owner_sessions(p_user_id uuid,p_hash text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('owner-sessions:'||p_user_id::text,0));
 UPDATE public.owner_sessions SET revoked_at=now(),encrypted_tokens='',refresh_lease=NULL,refresh_lease_until=NULL
 WHERE user_id=p_user_id AND (p_hash IS NULL OR session_hash=p_hash) AND revoked_at IS NULL;
 IF p_hash IS NULL THEN
  UPDATE public.business_account_state SET sessions_revoked_at=now(),updated_at=now()
  WHERE business_id IN(SELECT id FROM public.businesses WHERE owner_user_id=p_user_id);
  DELETE FROM auth.sessions WHERE user_id=p_user_id;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.create_owner_session(text,uuid,text,text,timestamptz,timestamptz,text,bigint),
 public.claim_owner_session_refresh(text),public.complete_owner_session_refresh(text,uuid,text,timestamptz),
 public.revoke_owner_sessions(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_owner_session(text,uuid,text,text,timestamptz,timestamptz,text,bigint),
 public.claim_owner_session_refresh(text),public.complete_owner_session_refresh(text,uuid,text,timestamptz),
 public.revoke_owner_sessions(uuid,text) TO service_role;

CREATE FUNCTION public.revoke_owner_sessions_on_admin_cutoff() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NEW.sessions_revoked_at IS DISTINCT FROM OLD.sessions_revoked_at THEN
  UPDATE public.owner_sessions SET revoked_at=now(),encrypted_tokens=''
  WHERE user_id IN(SELECT owner_user_id FROM public.businesses WHERE id=NEW.business_id)
   AND revoked_at IS NULL AND created_at<=NEW.sessions_revoked_at;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER revoke_owner_sessions_on_admin_cutoff AFTER UPDATE OF sessions_revoked_at ON public.business_account_state
 FOR EACH ROW EXECUTE FUNCTION public.revoke_owner_sessions_on_admin_cutoff();

-- Release only expired, unfinished registrations. Never delete an identity or content.
CREATE FUNCTION public.maintain_owner_auth_state() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_count integer; BEGIN
 UPDATE public.registration_intents SET status='EXPIRED' WHERE expires_at<=now() AND status IN ('PENDING','AWAITING_EMAIL');
 GET DIAGNOSTICS v_count=ROW_COUNT;
 UPDATE public.customer_invitations c SET status='ISSUED',reservation_id=NULL,reserved_at=NULL
 WHERE c.status='RESERVED' AND c.expires_at>now() AND EXISTS(SELECT 1 FROM public.registration_intents i
  WHERE i.invitation_id=c.id AND i.status='EXPIRED' AND i.invitation_reservation_id=c.reservation_id);
 DELETE FROM public.owner_sessions WHERE expires_at<now()-interval '7 days' OR revoked_at<now()-interval '7 days';
 DELETE FROM public.owner_auth_attempts WHERE window_start<now()-interval '2 days';
 RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.maintain_owner_auth_state() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.maintain_owner_auth_state() TO service_role;

CREATE FUNCTION public.abandon_owner_registration(p_intent_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_intent public.registration_intents%ROWTYPE; BEGIN
 SELECT * INTO v_intent FROM public.registration_intents WHERE id=p_intent_id AND auth_user_id IS NULL AND status='PENDING' FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 UPDATE public.registration_intents SET status='EXPIRED' WHERE id=p_intent_id;
 UPDATE public.customer_invitations SET status='ISSUED',reservation_id=NULL,reserved_at=NULL
 WHERE id=v_intent.invitation_id AND reservation_id=v_intent.invitation_reservation_id AND status='RESERVED' AND expires_at>now();
END $$;
CREATE FUNCTION public.resume_owner_registration(p_user_id uuid,p_full_name text,p_business_name text,p_slug text,p_phone text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_intent public.registration_intents%ROWTYPE; v_id uuid; BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('owner-provision:'||p_user_id::text,0));
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_user_id AND email_confirmed_at IS NOT NULL)
  OR EXISTS(SELECT 1 FROM public.admin_identities WHERE user_id=p_user_id) THEN RAISE EXCEPTION 'Owner unauthorized'; END IF;
 SELECT id INTO v_id FROM public.businesses WHERE owner_user_id=p_user_id;
 IF v_id IS NOT NULL THEN RETURN v_id; END IF;
 -- Resume only an identity that was originally bound to a legitimate server intent.
 SELECT * INTO v_intent FROM public.registration_intents WHERE auth_user_id=p_user_id
  AND status IN ('AWAITING_EMAIL','EXPIRED') ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
 IF NOT FOUND THEN
  -- Recover a signup whose Auth identity was created before a temporary binding
  -- failure. This is available only after proof of email ownership and login.
  SELECT i.* INTO v_intent FROM public.registration_intents i JOIN auth.users u ON lower(u.email)=i.email
   WHERE u.id=p_user_id AND i.auth_user_id IS NULL AND i.status='PENDING'
    AND u.created_at>=i.created_at-interval '5 seconds' ORDER BY i.created_at DESC LIMIT 1 FOR UPDATE OF i;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_REGISTRATION_INTENT'; END IF;
  UPDATE public.registration_intents SET auth_user_id=p_user_id WHERE id=v_intent.id;
 END IF;
 IF v_intent.source='ADMIN_INVITE' AND NOT EXISTS(SELECT 1 FROM public.customer_invitations
  WHERE id=v_intent.invitation_id AND status='RESERVED' AND reservation_id=v_intent.invitation_reservation_id AND expires_at>now()) THEN
  -- A verified owner can continue on the public Free path after an invitation expires.
  UPDATE public.registration_intents SET invitation_id=NULL,invitation_reservation_id=NULL,source='PUBLIC' WHERE id=v_intent.id;
 END IF;
 UPDATE public.registration_intents SET full_name=p_full_name,business_name=p_business_name,slug=p_slug,phone=p_phone,
  expires_at=now()+interval '24 hours',status='AWAITING_EMAIL',selected_plan_id=(SELECT id FROM public.plans WHERE code='FREE' AND active)
 WHERE id=v_intent.id;
 RETURN public.provision_owner_account(p_user_id,v_intent.id);
END $$;
REVOKE ALL ON FUNCTION public.abandon_owner_registration(uuid),public.resume_owner_registration(uuid,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.abandon_owner_registration(uuid),public.resume_owner_registration(uuid,text,text,text,text) TO service_role;

-- Keep the historical reservation RPC compatible, but it cannot steal a live
-- email-confirmation reservation after the historical ten-minute timeout.
CREATE OR REPLACE FUNCTION public.reserve_customer_invitation(p_code_hash text,p_email text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_invitation public.customer_invitations%ROWTYPE; v_reservation uuid:=gen_random_uuid(); BEGIN
 SELECT * INTO v_invitation FROM public.customer_invitations WHERE code_hash=p_code_hash FOR UPDATE;
 IF NOT FOUND OR v_invitation.attempt_count>=5 THEN RETURN NULL; END IF;
 IF EXISTS(SELECT 1 FROM public.registration_intents WHERE invitation_id=v_invitation.id
  AND status IN ('PENDING','AWAITING_EMAIL') AND expires_at>now()) THEN RETURN NULL; END IF;
 UPDATE public.customer_invitations SET attempt_count=attempt_count+1 WHERE id=v_invitation.id;
 IF v_invitation.email<>lower(btrim(p_email)) OR v_invitation.expires_at<=now()
  OR NOT(v_invitation.status='ISSUED' OR(v_invitation.status='RESERVED' AND v_invitation.reserved_at<now()-interval '10 minutes')) THEN RETURN NULL; END IF;
 UPDATE public.customer_invitations SET status='RESERVED',reservation_id=v_reservation,reserved_at=now() WHERE id=v_invitation.id;
 RETURN v_reservation;
END $$;

-- The existing purge deletes invitations before Auth identities. Cascading only
-- this internal intent avoids obstructing the authorized purge transaction.
ALTER TABLE public.registration_intents DROP CONSTRAINT registration_intents_invitation_id_fkey;
ALTER TABLE public.registration_intents ADD CONSTRAINT registration_intents_invitation_id_fkey
 FOREIGN KEY(invitation_id) REFERENCES public.customer_invitations(id) ON DELETE CASCADE;
COMMIT;
