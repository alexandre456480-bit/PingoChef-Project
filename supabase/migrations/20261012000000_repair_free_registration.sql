-- Repairs partially applied commercial registration schema without replacing accounts.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE public.registration_intents
 ADD COLUMN IF NOT EXISTS plan_selection_intent_id uuid REFERENCES public.owner_plan_intents(id) ON DELETE SET NULL,
 ADD COLUMN IF NOT EXISTS terms_version text,
 ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;

-- Consume the selection and save consent in the same transaction as registration.
-- Any failure rolls back all three writes, leaving the selection usable for retry.
CREATE OR REPLACE FUNCTION public.start_selected_owner_registration(
 p_selection_id uuid,p_email text,p_full_name text,p_business_name text,p_slug text,
 p_phone text,p_invitation_hash text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid; BEGIN
 PERFORM 1 FROM public.owner_plan_intents WHERE id=p_selection_id AND plan_code='FREE'
  AND consumed_at IS NULL AND expires_at>now() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PLAN_INTENT_EXPIRED'; END IF;
 v_id:=public.start_owner_registration(p_email,p_full_name,p_business_name,p_slug,p_phone,'FREE',p_invitation_hash);
 IF v_id IS NOT NULL THEN
  UPDATE public.registration_intents SET plan_selection_intent_id=p_selection_id,
   terms_version='2026-10',terms_accepted_at=now() WHERE id=v_id;
 END IF;
 UPDATE public.owner_plan_intents SET consumed_at=now(),terms_version='2026-10' WHERE id=p_selection_id;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.start_selected_owner_registration(uuid,text,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.start_selected_owner_registration(uuid,text,text,text,text,text,text) TO service_role;

-- Release drafts interrupted by the missing consent columns. Auth identities and
-- registrations already awaiting email are preserved; recent requests are excluded.
UPDATE public.registration_intents i SET status='EXPIRED'
WHERE i.status='PENDING' AND i.source='PUBLIC' AND i.auth_user_id IS NULL
 AND i.terms_accepted_at IS NULL AND i.created_at<now()-interval '30 minutes'
 AND NOT EXISTS(SELECT 1 FROM auth.users u WHERE lower(u.email)=i.email)
 AND EXISTS(SELECT 1 FROM public.owner_plan_intents s WHERE s.consumed_at
  BETWEEN i.created_at-interval '5 seconds' AND i.created_at);

NOTIFY pgrst, 'reload schema';
COMMIT;
