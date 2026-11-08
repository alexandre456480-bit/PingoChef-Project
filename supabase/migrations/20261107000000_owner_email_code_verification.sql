-- New registrations require a mailbox proof. Existing identities and sessions remain valid.
BEGIN;
ALTER TABLE public.registration_intents ADD COLUMN email_verification_required boolean NOT NULL DEFAULT false;
ALTER TABLE public.registration_intents ALTER COLUMN email_verification_required SET DEFAULT true;
CREATE INDEX registration_intents_email_verification_lookup ON public.registration_intents(auth_user_id,email) WHERE email_verification_required;
ALTER TABLE public.owner_auth_attempts DROP CONSTRAINT owner_auth_attempts_action_check;
ALTER TABLE public.owner_auth_attempts ADD CONSTRAINT owner_auth_attempts_action_check
 CHECK(action IN ('login','register','forgot','resend','reauthenticate','verify_email','email_code'));
CREATE TABLE public.owner_email_verifications (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 email text NOT NULL CHECK(length(email)<=254 AND email=lower(email)),
 challenge_id uuid NOT NULL DEFAULT gen_random_uuid(),
 sent_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes',
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
 delivery_confirmed boolean NOT NULL DEFAULT false,
 verified_at timestamptz
);
ALTER TABLE public.owner_email_verifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX owner_email_verifications_pending_email ON public.owner_email_verifications(email) WHERE verified_at IS NULL;
REVOKE ALL ON public.owner_email_verifications FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.owner_email_verification_required(p_user_id uuid) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=p_user_id
  AND (u.raw_app_meta_data->>'owner_email_verification_required'='true'
   OR EXISTS(SELECT 1 FROM public.registration_intents i WHERE i.email_verification_required
    AND (i.auth_user_id=u.id OR (i.auth_user_id IS NULL AND i.email=lower(u.email)
     AND u.created_at>=i.created_at-interval '5 seconds'))))
  AND NOT EXISTS(SELECT 1 FROM public.owner_email_verifications v
   WHERE v.user_id=u.id AND v.email=lower(u.email) AND v.verified_at IS NOT NULL));
$$;

CREATE FUNCTION public.reserve_owner_email_code(p_email text) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid; v_challenge uuid; BEGIN
 SELECT id INTO v_user FROM auth.users WHERE lower(email)=p_email;
 IF v_user IS NULL OR NOT public.owner_email_verification_required(v_user)
  OR EXISTS(SELECT 1 FROM public.admin_identities WHERE user_id=v_user) THEN RETURN NULL; END IF;
 INSERT INTO public.owner_email_verifications(user_id,email) VALUES(v_user,p_email)
 ON CONFLICT(user_id) DO UPDATE SET email=EXCLUDED.email,challenge_id=gen_random_uuid(),
  sent_at=now(),expires_at=now()+interval '10 minutes',attempts=0,verified_at=NULL,delivery_confirmed=false
 WHERE owner_email_verifications.sent_at<=now()-interval '60 seconds'
 RETURNING challenge_id INTO v_challenge;
 IF v_challenge IS NULL THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('userId',v_user,'challengeId',v_challenge);
END $$;

CREATE FUNCTION public.activate_owner_email_code(p_user_id uuid,p_challenge_id uuid) RETURNS boolean
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 UPDATE public.owner_email_verifications SET delivery_confirmed=true
 WHERE user_id=p_user_id AND challenge_id=p_challenge_id AND verified_at IS NULL AND expires_at>now();
 RETURN FOUND;
END $$;

CREATE FUNCTION public.take_owner_email_code_attempt(p_email text) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.owner_email_verifications; BEGIN
 UPDATE public.owner_email_verifications SET attempts=attempts+1
 WHERE email=p_email AND delivery_confirmed AND verified_at IS NULL AND expires_at>now() AND attempts<5
  AND EXISTS(SELECT 1 FROM auth.users u WHERE u.id=owner_email_verifications.user_id AND lower(u.email)=p_email)
 RETURNING * INTO v;
 IF NOT FOUND THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('userId',v.user_id,'challengeId',v.challenge_id);
END $$;

CREATE FUNCTION public.complete_owner_email_verification(p_user_id uuid,p_challenge_id uuid) RETURNS boolean
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 UPDATE public.owner_email_verifications v SET verified_at=now()
 WHERE v.user_id=p_user_id AND v.challenge_id=p_challenge_id AND v.verified_at IS NULL
  AND v.delivery_confirmed AND v.expires_at>now() AND v.attempts BETWEEN 1 AND 5
  AND EXISTS(SELECT 1 FROM auth.users u WHERE u.id=v.user_id AND lower(u.email)=v.email AND u.email_confirmed_at IS NOT NULL);
 RETURN FOUND;
END $$;

-- Add guards in place, retaining function identities, existing callers and all transactional checks.
DO $guard$
DECLARE definition text;
BEGIN
 definition:=pg_get_functiondef('public.provision_owner_account(uuid,uuid)'::regprocedure);
 EXECUTE regexp_replace(definition,'\mBEGIN\M',
  'BEGIN IF public.owner_email_verification_required(p_user_id) THEN RAISE EXCEPTION ''EMAIL_VERIFICATION_REQUIRED''; END IF;', 'i');
 definition:=pg_get_functiondef('public.create_owner_session(text,uuid,text,text,timestamptz,timestamptz,text,bigint)'::regprocedure);
 EXECUTE regexp_replace(definition,'\mBEGIN\M',
  'BEGIN IF p_scope=''owner'' AND public.owner_email_verification_required(p_user_id) THEN RETURN false; END IF;', 'i');
END $guard$;
REVOKE ALL ON FUNCTION public.owner_email_verification_required(uuid),public.reserve_owner_email_code(text),
 public.activate_owner_email_code(uuid,uuid),
 public.take_owner_email_code_attempt(text),public.complete_owner_email_verification(uuid,uuid),
 public.provision_owner_account(uuid,uuid),public.create_owner_session(text,uuid,text,text,timestamptz,timestamptz,text,bigint)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.owner_email_verification_required(uuid),public.reserve_owner_email_code(text),
 public.activate_owner_email_code(uuid,uuid),
 public.take_owner_email_code_attempt(text),public.complete_owner_email_verification(uuid,uuid),
 public.provision_owner_account(uuid,uuid),public.create_owner_session(text,uuid,text,text,timestamptz,timestamptz,text,bigint) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
