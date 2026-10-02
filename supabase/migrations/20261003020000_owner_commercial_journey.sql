-- Anonymous selection contains no PII and grants no subscription or entitlement.
CREATE TABLE public.owner_plan_intents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 plan_code text NOT NULL CHECK (plan_code='FREE'),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '30 minutes',
 consumed_at timestamptz,
 terms_version text,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.owner_plan_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_plan_intents FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.owner_plan_intents FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.owner_plan_intents TO service_role;
CREATE INDEX owner_plan_intents_expiry_idx ON public.owner_plan_intents(expires_at);
ALTER TABLE public.registration_intents
 ADD COLUMN plan_selection_intent_id uuid REFERENCES public.owner_plan_intents(id) ON DELETE SET NULL,
 ADD COLUMN terms_version text,
 ADD COLUMN terms_accepted_at timestamptz;

-- Existing internal maintenance removes anonymous drafts; consent stays on registration.
ALTER FUNCTION public.maintain_owner_auth_state() RENAME TO maintain_owner_auth_state_foundation;
CREATE FUNCTION public.maintain_owner_auth_state() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_count integer; BEGIN
 v_count:=public.maintain_owner_auth_state_foundation();
 DELETE FROM public.owner_plan_intents WHERE expires_at<now()-interval '7 days';
 RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.maintain_owner_auth_state() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.maintain_owner_auth_state() TO service_role;

-- Uses the existing deletion queue and external-media purge worker. Never grants admin identity.
CREATE TABLE public.owner_account_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
 action text NOT NULL CHECK(action='DELETION_SCHEDULED'),
 created_at timestamptz NOT NULL DEFAULT now(),
 details jsonb NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE public.owner_account_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_account_audit FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.owner_account_audit FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.owner_account_audit TO service_role;
CREATE FUNCTION public.owner_schedule_account_deletion(p_user_id uuid,p_confirm_business_id uuid)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_business uuid; v_status text; v_due timestamptz; BEGIN
 SELECT b.id INTO v_business FROM public.businesses b WHERE b.owner_user_id=p_user_id;
 IF v_business IS NULL OR v_business<>p_confirm_business_id THEN RAISE EXCEPTION 'OWNER_CONFIRMATION_REQUIRED'; END IF;
 SELECT lifecycle_status,deletion_scheduled_at INTO v_status,v_due
 FROM public.business_account_state WHERE business_id=v_business FOR UPDATE;
 IF v_status='PENDING_DELETION' THEN RETURN v_due; END IF;
 IF v_status NOT IN ('ACTIVE','SUSPENDED') THEN RAISE EXCEPTION 'INVALID_LIFECYCLE_TRANSITION'; END IF;
 v_due:=now()+interval '30 days';
 UPDATE public.business_account_state SET lifecycle_status='PENDING_DELETION',
 deletion_scheduled_at=v_due,is_published=false,updated_at=now() WHERE business_id=v_business;
 INSERT INTO public.owner_account_audit(user_id,action,business_id,details)
 VALUES(p_user_id,'DELETION_SCHEDULED',v_business,
 jsonb_build_object('from',v_status,'to','PENDING_DELETION','source','OWNER','retentionDays',30));
 PERFORM public.revoke_owner_sessions(p_user_id,NULL);
 RETURN v_due;
END $$;
REVOKE ALL ON FUNCTION public.owner_schedule_account_deletion(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.owner_schedule_account_deletion(uuid,uuid) TO service_role;
