-- The original deployed RPC had seven parameters. The owner BFF now supplies
-- the JWT issue time so a fresh login can be distinguished from a revoked one.
-- Keep this as a new migration because changing an already applied file does
-- not update the remote database.
BEGIN;

-- Dropping and recreating happen atomically. A failed migration restores the
-- previous function, and fresh installations have no seven-argument overload.
DROP FUNCTION IF EXISTS public.create_owner_session(text, uuid, text, text, timestamptz, timestamptz, text);

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
    OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id AND email_confirmed_at IS NOT NULL)
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

REVOKE ALL ON FUNCTION public.create_owner_session(text, uuid, text, text, timestamptz, timestamptz, text, bigint)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_owner_session(text, uuid, text, text, timestamptz, timestamptz, text, bigint)
  TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
