-- Password registration policy: no outbound email and no claim of mailbox ownership.
-- Forward migration also supports installations that already enabled email codes.
BEGIN;
ALTER TABLE public.registration_intents ALTER COLUMN email_verification_required SET DEFAULT false;

-- Release only application registrations interrupted by the previous email gate.
-- Never change passwords, recovery tokens, unrelated identities or administrators.
UPDATE auth.users u SET
 email_confirmed_at=coalesce(u.email_confirmed_at,now()),confirmation_token='',
 raw_app_meta_data=coalesce(u.raw_app_meta_data,'{}'::jsonb)-'owner_email_verification_required',updated_at=now()
WHERE NOT EXISTS(SELECT 1 FROM public.admin_identities a WHERE a.user_id=u.id)
 AND EXISTS(SELECT 1 FROM public.registration_intents i WHERE i.email_verification_required
  AND i.email=lower(u.email)
  AND (i.auth_user_id=u.id OR (i.auth_user_id IS NULL AND i.status IN ('PENDING','EXPIRED')
   AND u.created_at>=i.created_at-interval '5 seconds')));

-- Existing function guards retain their identity and all non-email authorization.
-- This is an explicit registration policy, not a synthesized verification proof.
CREATE OR REPLACE FUNCTION public.owner_email_verification_required(p_user_id uuid) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT false; $$;
REVOKE ALL ON FUNCTION public.owner_email_verification_required(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.owner_email_verification_required(uuid) TO service_role;

-- Keep historical evidence private; disable the retired challenge RPCs as well.
REVOKE ALL ON FUNCTION public.reserve_owner_email_code(text),
 public.activate_owner_email_code(uuid,uuid),public.take_owner_email_code_attempt(text),
 public.complete_owner_email_verification(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
COMMENT ON FUNCTION public.owner_email_verification_required(uuid) IS
 'Email ownership verification is disabled by registration policy. Password authentication remains required.';
NOTIFY pgrst,'reload schema';
COMMIT;
