-- Owner registration no longer waits for mailbox confirmation. Apply after the registration repair.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- READY means the identity is bound and provisioning can proceed immediately.
ALTER TABLE public.registration_intents DROP CONSTRAINT IF EXISTS registration_intents_status_check;
UPDATE public.registration_intents SET status='READY' WHERE status='AWAITING_EMAIL';
ALTER TABLE public.registration_intents ADD CONSTRAINT registration_intents_status_check
 CHECK(status IN ('PENDING','READY','COMPLETED','EXPIRED'));
DROP INDEX IF EXISTS public.registration_intents_user_pending_idx;
DROP INDEX IF EXISTS public.registration_intents_email_pending_idx;

-- Partial deployments can leave an unbound draft beside a bound registration.
-- Keep bound identities first, then consent and the latest draft. Archive only
-- excess unbound drafts; account identities and registration history are retained.
WITH ranked AS (
 SELECT id,row_number() OVER (PARTITION BY email ORDER BY
  (auth_user_id IS NOT NULL) DESC,(terms_accepted_at IS NOT NULL) DESC,
  created_at DESC,id DESC) AS position
 FROM public.registration_intents WHERE status IN ('PENDING','READY')
)
UPDATE public.registration_intents i SET status='EXPIRED'
FROM ranked r WHERE i.id=r.id AND r.position>1 AND i.auth_user_id IS NULL;

-- Choosing between two bound identities requires a separate ownership review.
-- Fail atomically instead of archiving a registration tied to an existing account.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.registration_intents WHERE status IN ('PENDING','READY')
  GROUP BY email HAVING count(*)>1)
 OR EXISTS(SELECT 1 FROM public.registration_intents WHERE auth_user_id IS NOT NULL
  AND status IN ('PENDING','READY') GROUP BY auth_user_id HAVING count(*)>1) THEN
  RAISE EXCEPTION 'Conflicting bound registration intents; review ownership before migration';
 END IF;
END $$;

CREATE UNIQUE INDEX registration_intents_user_pending_idx ON public.registration_intents(auth_user_id)
 WHERE auth_user_id IS NOT NULL AND status IN ('PENDING','READY');
CREATE UNIQUE INDEX registration_intents_email_pending_idx ON public.registration_intents(email)
 WHERE status IN ('PENDING','READY');

CREATE OR REPLACE FUNCTION public.start_owner_registration(p_email text,p_full_name text,p_business_name text,p_slug text,
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
 IF EXISTS(SELECT 1 FROM public.registration_intents WHERE email=lower(btrim(p_email)) AND status IN ('PENDING','READY')) THEN RETURN NULL; END IF;
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

CREATE OR REPLACE FUNCTION public.bind_owner_registration(p_intent_id uuid,p_user_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 UPDATE public.registration_intents i SET auth_user_id=p_user_id,status='READY'
 WHERE i.id=p_intent_id AND i.status='PENDING' AND i.expires_at>now()
 AND EXISTS(SELECT 1 FROM auth.users u WHERE u.id=p_user_id AND lower(u.email)=i.email
  AND u.created_at>=i.created_at-interval '5 seconds')
 AND NOT EXISTS(SELECT 1 FROM public.businesses WHERE owner_user_id=p_user_id);
 RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.provision_owner_account(p_user_id uuid,p_intent_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_intent public.registration_intents%ROWTYPE; v_business uuid; v_invite public.customer_invitations%ROWTYPE; BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('owner-provision:'||p_user_id::text,0));
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_user_id)
  OR EXISTS(SELECT 1 FROM public.admin_identities WHERE user_id=p_user_id) THEN RAISE EXCEPTION 'OWNER_UNAUTHORIZED'; END IF;
 -- Supplying a forged intent must fail even for an already provisioned owner.
 IF p_intent_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.registration_intents WHERE id=p_intent_id AND auth_user_id=p_user_id) THEN
  RAISE EXCEPTION 'INVALID_REGISTRATION_INTENT';
 END IF;
 SELECT id INTO v_business FROM public.businesses WHERE owner_user_id=p_user_id;
 IF v_business IS NOT NULL THEN RETURN v_business; END IF;
 SELECT * INTO v_intent FROM public.registration_intents WHERE auth_user_id=p_user_id
  AND (p_intent_id IS NULL OR id=p_intent_id) AND status='READY' ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
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

CREATE OR REPLACE FUNCTION public.resume_owner_registration(p_user_id uuid,p_full_name text,p_business_name text,p_slug text,p_phone text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_intent public.registration_intents%ROWTYPE; v_id uuid; BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('owner-provision:'||p_user_id::text,0));
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_user_id)
  OR EXISTS(SELECT 1 FROM public.admin_identities WHERE user_id=p_user_id) THEN RAISE EXCEPTION 'Owner unauthorized'; END IF;
 SELECT id INTO v_id FROM public.businesses WHERE owner_user_id=p_user_id;
 IF v_id IS NOT NULL THEN RETURN v_id; END IF;
 -- Resume only an identity that was originally bound to a legitimate server intent.
 SELECT * INTO v_intent FROM public.registration_intents WHERE auth_user_id=p_user_id
  AND status IN ('READY','EXPIRED') ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
 IF NOT FOUND THEN
  -- Recover a signup whose Auth identity was created before a temporary binding
  -- failure. This is available only after a successful password login.
  SELECT i.* INTO v_intent FROM public.registration_intents i JOIN auth.users u ON lower(u.email)=i.email
   WHERE u.id=p_user_id AND i.auth_user_id IS NULL AND i.status='PENDING'
    AND u.created_at>=i.created_at-interval '5 seconds' ORDER BY i.created_at DESC LIMIT 1 FOR UPDATE OF i;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_REGISTRATION_INTENT'; END IF;
  UPDATE public.registration_intents SET auth_user_id=p_user_id WHERE id=v_intent.id;
 END IF;
 IF v_intent.source='ADMIN_INVITE' AND NOT EXISTS(SELECT 1 FROM public.customer_invitations
  WHERE id=v_intent.invitation_id AND status='RESERVED' AND reservation_id=v_intent.invitation_reservation_id AND expires_at>now()) THEN
  -- An authenticated owner can continue on the public Free path after an invitation expires.
  UPDATE public.registration_intents SET invitation_id=NULL,invitation_reservation_id=NULL,source='PUBLIC' WHERE id=v_intent.id;
 END IF;
 UPDATE public.registration_intents SET full_name=p_full_name,business_name=p_business_name,slug=p_slug,phone=p_phone,
  expires_at=now()+interval '24 hours',status='READY',selected_plan_id=(SELECT id FROM public.plans WHERE code='FREE' AND active)
 WHERE id=v_intent.id;
 RETURN public.provision_owner_account(p_user_id,v_intent.id);
END $$;

CREATE OR REPLACE FUNCTION public.create_owner_session(
  p_hash text,
  p_user_id uuid,
  p_scope text,
  p_tokens text,
  p_token_expires_at timestamptz,
  p_expires_at timestamptz,
  p_previous_hash text DEFAULT NULL,
  p_auth_issued_at bigint DEFAULT NULL
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('owner-sessions:' || p_user_id::text, 0));
  IF EXISTS (SELECT 1 FROM public.admin_identities WHERE user_id = p_user_id)
    OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id)
    OR p_expires_at > now() + interval '8 hours' OR p_expires_at <= now() THEN
    RETURN false;
  END IF;
  IF p_scope = 'owner' AND EXISTS (
    SELECT 1 FROM public.business_account_state s
    JOIN public.businesses b ON b.id = s.business_id
    WHERE b.owner_user_id = p_user_id AND s.sessions_revoked_at IS NOT NULL
      AND (p_auth_issued_at IS NULL OR to_timestamp(p_auth_issued_at) <= s.sessions_revoked_at)
  ) THEN
    RETURN false;
  END IF;
  IF p_previous_hash IS NOT NULL THEN
    UPDATE public.owner_sessions SET revoked_at = now(), encrypted_tokens = ''
    WHERE session_hash = p_previous_hash AND revoked_at IS NULL;
  END IF;
  INSERT INTO public.owner_sessions(session_hash, user_id, scope, encrypted_tokens, token_expires_at, expires_at)
  VALUES (p_hash, p_user_id, p_scope, p_tokens, p_token_expires_at, p_expires_at);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_owner_auth_state_foundation() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_count integer; BEGIN
 UPDATE public.registration_intents SET status='EXPIRED' WHERE expires_at<=now() AND status IN ('PENDING','READY');
 GET DIAGNOSTICS v_count=ROW_COUNT;
 UPDATE public.customer_invitations c SET status='ISSUED',reservation_id=NULL,reserved_at=NULL
 WHERE c.status='RESERVED' AND c.expires_at>now() AND EXISTS(SELECT 1 FROM public.registration_intents i
  WHERE i.invitation_id=c.id AND i.status='EXPIRED' AND i.invitation_reservation_id=c.reservation_id);
 DELETE FROM public.owner_sessions WHERE expires_at<now()-interval '7 days' OR revoked_at<now()-interval '7 days';
 DELETE FROM public.owner_auth_attempts WHERE window_start<now()-interval '2 days';
 RETURN v_count;
END $$;

CREATE OR REPLACE FUNCTION public.reserve_customer_invitation(p_code_hash text,p_email text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_invitation public.customer_invitations%ROWTYPE; v_reservation uuid:=gen_random_uuid(); BEGIN
 SELECT * INTO v_invitation FROM public.customer_invitations WHERE code_hash=p_code_hash FOR UPDATE;
 IF NOT FOUND OR v_invitation.attempt_count>=5 THEN RETURN NULL; END IF;
 IF EXISTS(SELECT 1 FROM public.registration_intents WHERE invitation_id=v_invitation.id
  AND status IN ('PENDING','READY') AND expires_at>now()) THEN RETURN NULL; END IF;
 UPDATE public.customer_invitations SET attempt_count=attempt_count+1 WHERE id=v_invitation.id;
 IF v_invitation.email<>lower(btrim(p_email)) OR v_invitation.expires_at<=now()
  OR NOT(v_invitation.status='ISSUED' OR(v_invitation.status='RESERVED' AND v_invitation.reserved_at<now()-interval '10 minutes')) THEN RETURN NULL; END IF;
 UPDATE public.customer_invitations SET status='RESERVED',reservation_id=v_reservation,reserved_at=now() WHERE id=v_invitation.id;
 RETURN v_reservation;
END $$;

-- Release the selected plan when identity creation fails, without changing a bound account.
CREATE OR REPLACE FUNCTION public.abandon_owner_registration(p_intent_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_intent public.registration_intents%ROWTYPE; BEGIN
 SELECT * INTO v_intent FROM public.registration_intents WHERE id=p_intent_id AND auth_user_id IS NULL AND status='PENDING' FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 UPDATE public.registration_intents SET status='EXPIRED' WHERE id=p_intent_id;
 UPDATE public.owner_plan_intents SET consumed_at=NULL,terms_version=NULL
 WHERE id=v_intent.plan_selection_intent_id AND consumed_at=v_intent.terms_accepted_at;
 UPDATE public.customer_invitations SET status='ISSUED',reservation_id=NULL,reserved_at=NULL
 WHERE id=v_intent.invitation_id AND reservation_id=v_intent.invitation_reservation_id AND status='RESERVED' AND expires_at>now();
END $$;

-- Provider compatibility flag, not proof of mailbox ownership. This only releases
-- existing application owners and legitimate interrupted registrations, never admins.
UPDATE auth.users u SET email_confirmed_at=now(),confirmation_token='',updated_at=now()
WHERE u.email_confirmed_at IS NULL AND NOT EXISTS(SELECT 1 FROM public.admin_identities a WHERE a.user_id=u.id)
 AND (EXISTS(SELECT 1 FROM public.businesses b WHERE b.owner_user_id=u.id)
  OR EXISTS(SELECT 1 FROM public.registration_intents i WHERE lower(u.email)=i.email
   AND (i.auth_user_id=u.id OR (i.auth_user_id IS NULL AND i.status IN ('PENDING','EXPIRED')
    AND u.created_at>=i.created_at-interval '5 seconds'))));

REVOKE ALL ON FUNCTION public.start_owner_registration(text,text,text,text,text,text,text),
 public.bind_owner_registration(uuid,uuid),public.provision_owner_account(uuid,uuid),
 public.resume_owner_registration(uuid,text,text,text,text),public.abandon_owner_registration(uuid),
 public.create_owner_session(text,uuid,text,text,timestamptz,timestamptz,text,bigint),
 public.maintain_owner_auth_state_foundation(),public.reserve_customer_invitation(text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.start_owner_registration(text,text,text,text,text,text,text),
 public.bind_owner_registration(uuid,uuid),public.provision_owner_account(uuid,uuid),
 public.resume_owner_registration(uuid,text,text,text,text),public.abandon_owner_registration(uuid),
 public.create_owner_session(text,uuid,text,text,timestamptz,timestamptz,text,bigint),
 public.maintain_owner_auth_state_foundation(),public.reserve_customer_invitation(text,text) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
