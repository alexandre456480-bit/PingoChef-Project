-- Admin foundation. This migration deliberately stops if production data violates
-- the one-owner/one-business contract; resolve duplicates before applying it.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.businesses
    GROUP BY owner_user_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate business owners found. Run the preflight audit and resolve them before this migration.';
  END IF;
END $$;

ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_owner_user_id_unique UNIQUE (owner_user_id);

-- The legacy status remains for existing API contracts. Only the service role
-- can create/delete a business or change its identity/legacy status.
CREATE FUNCTION public.guard_business_admin_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF current_user NOT IN ('postgres', 'service_role') THEN
    IF TG_OP <> 'UPDATE' THEN
      RAISE EXCEPTION 'Business creation and deletion require the backend';
    END IF;
    IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id
       OR NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Administrative business fields are read-only';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER guard_business_admin_fields
  BEFORE INSERT OR UPDATE OR DELETE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.guard_business_admin_fields();

CREATE TABLE public.business_account_state (
  business_id uuid PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  lifecycle_status text NOT NULL CHECK (lifecycle_status IN ('ACTIVE','SUSPENDED','PENDING_DELETION','DELETED')),
  is_published boolean NOT NULL DEFAULT true,
  suspended_at timestamptz,
  suspended_reason text,
  deletion_scheduled_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deletion_schedule_required CHECK (lifecycle_status <> 'PENDING_DELETION' OR deletion_scheduled_at IS NOT NULL)
);
INSERT INTO public.business_account_state (business_id, lifecycle_status, suspended_at)
SELECT id, CASE WHEN status = 'ACTIVE' THEN 'ACTIVE' ELSE 'SUSPENDED' END,
       CASE WHEN status = 'SUSPENDED' THEN now() ELSE NULL END
FROM public.businesses;

CREATE FUNCTION public.initialize_business_account_state()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  INSERT INTO public.business_account_state(business_id, lifecycle_status)
  VALUES (NEW.id, CASE WHEN NEW.status = 'ACTIVE' THEN 'ACTIVE' ELSE 'SUSPENDED' END);
  RETURN NEW;
END $$;
CREATE TRIGGER initialize_business_account_state
  AFTER INSERT ON public.businesses FOR EACH ROW
  EXECUTE FUNCTION public.initialize_business_account_state();
CREATE INDEX business_account_state_lifecycle_idx ON public.business_account_state(lifecycle_status, updated_at);
CREATE INDEX business_account_state_deletion_idx ON public.business_account_state(deletion_scheduled_at)
  WHERE lifecycle_status = 'PENDING_DELETION';
ALTER TABLE public.business_account_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_account_state FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_account_state FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_account_state TO service_role;

-- Billing has not launched. Replace only this function when subscription and
-- grace-period data exist; never infer billing status from business.status.
CREATE FUNCTION public.business_is_commercially_eligible(p_business_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p_business_id IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.business_is_commercially_eligible(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.business_is_commercially_eligible(uuid) TO anon, authenticated, service_role;

-- All public SQL policies and backend reads use this same decision boundary.
CREATE FUNCTION public.business_is_publicly_eligible(p_business_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.businesses b
    JOIN public.business_account_state s ON s.business_id = b.id
    WHERE b.id = p_business_id AND b.status = 'ACTIVE'
      AND s.lifecycle_status = 'ACTIVE' AND s.is_published = true
      AND public.business_is_commercially_eligible(b.id)
  );
$$;
REVOKE ALL ON FUNCTION public.business_is_publicly_eligible(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.business_is_publicly_eligible(uuid) TO anon, authenticated, service_role;

CREATE FUNCTION public.business_is_account_active(p_business_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.businesses b
    JOIN public.business_account_state s ON s.business_id = b.id
    WHERE b.id = p_business_id AND b.status = 'ACTIVE' AND s.lifecycle_status = 'ACTIVE'
  );
$$;
REVOKE ALL ON FUNCTION public.business_is_account_active(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.business_is_account_active(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Dono pode gerenciar seu estabelecimento" ON public.businesses;
CREATE POLICY "Dono pode gerenciar estabelecimento ativo" ON public.businesses
  FOR ALL USING (auth.uid() = owner_user_id AND public.business_is_account_active(id))
  WITH CHECK (auth.uid() = owner_user_id AND public.business_is_account_active(id));
DROP POLICY IF EXISTS "Dono pode gerenciar suas categorias" ON public.categories;
CREATE POLICY "Dono pode gerenciar categorias de conta ativa" ON public.categories
  FOR ALL USING (
    public.business_is_account_active(business_id) AND EXISTS (
      SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.owner_user_id = auth.uid()
    )
  ) WITH CHECK (
    public.business_is_account_active(business_id) AND EXISTS (
      SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.owner_user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "Dono pode gerenciar suas subcategorias" ON public.subcategories;
CREATE POLICY "Dono pode gerenciar subcategorias de conta ativa" ON public.subcategories
  FOR ALL USING (
    public.business_is_account_active(business_id) AND EXISTS (
      SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.owner_user_id = auth.uid()
    )
  ) WITH CHECK (
    public.business_is_account_active(business_id) AND EXISTS (
      SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.owner_user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "Dono pode gerenciar seus itens" ON public.menu_items;
CREATE POLICY "Dono pode gerenciar itens de conta ativa" ON public.menu_items
  FOR ALL USING (
    public.business_is_account_active(business_id) AND EXISTS (
      SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.owner_user_id = auth.uid()
    )
  ) WITH CHECK (
    public.business_is_account_active(business_id) AND EXISTS (
      SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.owner_user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "Dono pode gerenciar seu design" ON public.design_settings;
CREATE POLICY "Dono pode gerenciar design de conta ativa" ON public.design_settings
  FOR ALL USING (
    public.business_is_account_active(business_id) AND EXISTS (
      SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.owner_user_id = auth.uid()
    )
  ) WITH CHECK (
    public.business_is_account_active(business_id) AND EXISTS (
      SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Leitura pública de estabelecimentos ativos" ON public.businesses;
CREATE POLICY "Leitura pública de estabelecimentos elegíveis" ON public.businesses
  FOR SELECT USING (public.business_is_publicly_eligible(id));
DROP POLICY IF EXISTS "Leitura pública de categorias ativas" ON public.categories;
CREATE POLICY "Leitura pública de categorias elegíveis" ON public.categories
  FOR SELECT USING (is_active AND public.business_is_publicly_eligible(business_id));
DROP POLICY IF EXISTS "Leitura pública de itens de estabelecimentos ativos" ON public.menu_items;
CREATE POLICY "Leitura pública de itens elegíveis" ON public.menu_items
  FOR SELECT USING (public.business_is_publicly_eligible(business_id));
DROP POLICY IF EXISTS "Leitura pública de design settings" ON public.design_settings;
CREATE POLICY "Leitura pública de design elegível" ON public.design_settings
  FOR SELECT USING (public.business_is_publicly_eligible(business_id));
DROP POLICY IF EXISTS "Leitura pública de subcategorias" ON public.subcategories;
CREATE POLICY "Leitura pública de subcategorias elegíveis" ON public.subcategories
  FOR SELECT USING (public.business_is_publicly_eligible(business_id));

-- A suspension racing with a like is also checked inside the database write.
CREATE FUNCTION public.guard_anonymous_like_eligibility()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NOT public.business_is_publicly_eligible(NEW.business_id) THEN
    RAISE EXCEPTION 'Business is not publicly eligible';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_anonymous_like_eligibility
  BEFORE INSERT ON public.anonymous_likes
  FOR EACH ROW EXECUTE FUNCTION public.guard_anonymous_like_eligibility();

CREATE TABLE public.admin_identities (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  active boolean NOT NULL DEFAULT true,
  require_mfa boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE TABLE public.admin_sessions (
  session_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.admin_identities(user_id) ON DELETE CASCADE,
  csrf_hash text NOT NULL,
  mfa_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);
CREATE INDEX admin_sessions_user_idx ON public.admin_sessions(user_id, expires_at);
CREATE TABLE public.admin_audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id uuid NOT NULL REFERENCES public.admin_identities(user_id),
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_audit_log_time_idx ON public.admin_audit_log(created_at DESC, id DESC);
CREATE INDEX admin_audit_log_target_idx ON public.admin_audit_log(target_type, target_id, created_at DESC);

CREATE TABLE public.customer_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash text NOT NULL UNIQUE,
  email text NOT NULL CHECK (email = lower(btrim(email))),
  status text NOT NULL DEFAULT 'ISSUED' CHECK (status IN ('ISSUED','RESERVED','CONSUMED','REVOKED')),
  created_by uuid NOT NULL REFERENCES public.admin_identities(user_id),
  expires_at timestamptz NOT NULL,
  reservation_id uuid,
  reserved_at timestamptz,
  consumed_at timestamptz,
  consumed_by uuid REFERENCES auth.users(id),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_invitation_reservation_shape CHECK ((status = 'RESERVED') = (reservation_id IS NOT NULL))
);
CREATE INDEX customer_invitations_email_status_idx ON public.customer_invitations(email, status, expires_at);
CREATE TABLE public.admin_login_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email_hash text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_login_attempts_window_idx ON public.admin_login_attempts(email_hash, occurred_at DESC);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['admin_identities','admin_sessions','admin_audit_log','customer_invitations','admin_login_attempts'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO service_role', t);
  END LOOP;
END $$;
GRANT USAGE, SELECT ON SEQUENCE public.admin_audit_log_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.admin_login_attempts_id_seq TO service_role;
REVOKE UPDATE, DELETE ON public.admin_audit_log FROM service_role;

-- Historical activation hashes remain for reconciliation only. The legacy
-- endpoint is removed; regular users have no reason to read this table.
DROP POLICY IF EXISTS "Apenas donos do estabelecimento podem visualizar seus tokens" ON public.activation_tokens;
REVOKE ALL ON public.activation_tokens FROM PUBLIC, anon, authenticated;

-- Row locks serialize reservation/finalization. Auth user creation occurs outside
-- Postgres, so the backend compensates by releasing reservations and deleting
-- an Auth user it just created if finalization fails.
CREATE FUNCTION public.reserve_customer_invitation(p_code_hash text, p_email text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid := gen_random_uuid();
BEGIN
  UPDATE public.customer_invitations SET status = 'RESERVED', reservation_id = v_id, reserved_at = now()
  WHERE code_hash = p_code_hash AND email = lower(btrim(p_email)) AND expires_at > now()
    AND (status = 'ISSUED' OR (status = 'RESERVED' AND reserved_at < now() - interval '10 minutes'));
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN v_id;
END $$;
CREATE FUNCTION public.release_customer_invitation(p_code_hash text, p_reservation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.customer_invitations SET status = 'ISSUED', reservation_id = NULL, reserved_at = NULL
  WHERE code_hash = p_code_hash AND reservation_id = p_reservation_id AND status = 'RESERVED';
END $$;
CREATE FUNCTION public.complete_customer_registration(
  p_code_hash text, p_reservation_id uuid, p_user_id uuid, p_email text,
  p_full_name text, p_business_name text, p_slug text, p_phone text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_invitation public.customer_invitations%ROWTYPE; v_business_id uuid;
BEGIN
  SELECT * INTO v_invitation FROM public.customer_invitations
  WHERE code_hash = p_code_hash FOR UPDATE;
  IF NOT FOUND OR v_invitation.status <> 'RESERVED'
     OR v_invitation.reservation_id IS DISTINCT FROM p_reservation_id
     OR v_invitation.email <> lower(btrim(p_email))
     OR v_invitation.expires_at <= now()
     OR v_invitation.reserved_at < now() - interval '10 minutes' THEN
    RAISE EXCEPTION 'Invitation unavailable';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id AND lower(email) = v_invitation.email) THEN
    RAISE EXCEPTION 'Authenticated user does not match invitation';
  END IF;
  INSERT INTO public.profiles(id, full_name, phone) VALUES (p_user_id, p_full_name, p_phone);
  INSERT INTO public.businesses(owner_user_id, name, slug, phone, whatsapp, status)
    VALUES (p_user_id, p_business_name, p_slug, p_phone, p_phone, 'ACTIVE') RETURNING id INTO v_business_id;
  UPDATE public.customer_invitations SET status = 'CONSUMED', reservation_id = NULL,
    reserved_at = NULL, consumed_at = now(), consumed_by = p_user_id WHERE id = v_invitation.id;
  RETURN v_business_id;
END $$;
REVOKE ALL ON FUNCTION public.reserve_customer_invitation(text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_customer_invitation(text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_customer_registration(text,uuid,uuid,text,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_customer_invitation(text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_customer_invitation(text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_customer_registration(text,uuid,uuid,text,text,text,text,text) TO service_role;

CREATE FUNCTION public.create_customer_invitation(
  p_actor uuid, p_email text, p_code_hash text, p_expires_at timestamptz
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_identities WHERE user_id = p_actor AND active AND revoked_at IS NULL) THEN
    RAISE EXCEPTION 'Admin unauthorized';
  END IF;
  IF p_expires_at <= now() OR p_expires_at > now() + interval '30 days' THEN
    RAISE EXCEPTION 'Invalid invitation expiry';
  END IF;
  INSERT INTO public.customer_invitations(code_hash,email,created_by,expires_at)
    VALUES (p_code_hash,lower(btrim(p_email)),p_actor,p_expires_at) RETURNING id INTO v_id;
  INSERT INTO public.admin_audit_log(actor_user_id,action,target_type,target_id,details)
    VALUES (p_actor,'invitation.created','invitation',v_id::text,jsonb_build_object('email',lower(btrim(p_email))));
  RETURN v_id;
END $$;

CREATE FUNCTION public.revoke_customer_invitation(p_actor uuid, p_invitation_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_identities WHERE user_id = p_actor AND active AND revoked_at IS NULL) THEN
    RAISE EXCEPTION 'Admin unauthorized';
  END IF;
  UPDATE public.customer_invitations SET status = 'REVOKED', reservation_id = NULL,
    reserved_at = NULL, revoked_at = now()
  WHERE id = p_invitation_id AND status IN ('ISSUED','RESERVED');
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO public.admin_audit_log(actor_user_id,action,target_type,target_id)
    VALUES (p_actor,'invitation.revoked','invitation',p_invitation_id::text);
  RETURN true;
END $$;

CREATE FUNCTION public.set_business_lifecycle(
  p_actor uuid, p_business_id uuid, p_next_status text, p_reason text,
  p_retention_days integer DEFAULT 30
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_current text; v_legacy_status text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_identities WHERE user_id = p_actor AND active AND revoked_at IS NULL) THEN
    RAISE EXCEPTION 'Admin unauthorized';
  END IF;
  SELECT lifecycle_status INTO v_current FROM public.business_account_state
    WHERE business_id = p_business_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  SELECT status INTO v_legacy_status FROM public.businesses WHERE id = p_business_id FOR UPDATE;
  IF NOT (
    (v_current = 'ACTIVE' AND p_next_status = 'SUSPENDED') OR
    (v_current = 'SUSPENDED' AND p_next_status IN ('ACTIVE','PENDING_DELETION')) OR
    (v_current = 'PENDING_DELETION' AND p_next_status IN ('ACTIVE','SUSPENDED'))
  ) THEN RAISE EXCEPTION 'Invalid lifecycle transition'; END IF;
  IF p_next_status = 'PENDING_DELETION' AND (p_retention_days < 1 OR p_retention_days > 365) THEN
    RAISE EXCEPTION 'Invalid retention period';
  END IF;
  IF p_next_status = 'ACTIVE' THEN
    IF v_legacy_status = 'SUSPENDED' THEN
      UPDATE public.businesses SET status = 'ACTIVE', updated_at = now() WHERE id = p_business_id;
    ELSIF v_legacy_status <> 'ACTIVE' THEN
      RAISE EXCEPTION 'Legacy business requires migration';
    END IF;
  END IF;
  UPDATE public.business_account_state SET lifecycle_status = p_next_status,
    suspended_at = CASE WHEN p_next_status = 'SUSPENDED' AND v_current = 'ACTIVE' THEN now()
      WHEN p_next_status = 'ACTIVE' THEN NULL ELSE suspended_at END,
    suspended_reason = CASE WHEN p_next_status = 'SUSPENDED' THEN nullif(btrim(p_reason),'')
      WHEN p_next_status = 'ACTIVE' THEN NULL ELSE suspended_reason END,
    deletion_scheduled_at = CASE WHEN p_next_status = 'PENDING_DELETION'
      THEN now() + make_interval(days => p_retention_days) ELSE NULL END,
    updated_at = now()
  WHERE business_id = p_business_id;
  INSERT INTO public.admin_audit_log(actor_user_id,action,target_type,target_id,details)
    VALUES (p_actor,'business.lifecycle_changed','business',p_business_id::text,
      jsonb_build_object('from',v_current,'to',p_next_status,'reason',p_reason));
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.create_customer_invitation(uuid,text,text,timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_customer_invitation(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_business_lifecycle(uuid,uuid,text,text,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_customer_invitation(uuid,text,text,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_customer_invitation(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_business_lifecycle(uuid,uuid,text,text,integer) TO service_role;

CREATE FUNCTION public.start_admin_session(
  p_user_id uuid, p_session_hash text, p_csrf_hash text,
  p_mfa_verified boolean, p_expires_at timestamptz
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_identities
    WHERE user_id = p_user_id AND active AND revoked_at IS NULL
      AND (NOT require_mfa OR p_mfa_verified)) THEN
    RAISE EXCEPTION 'Admin unauthorized';
  END IF;
  INSERT INTO public.admin_sessions(session_hash,user_id,csrf_hash,mfa_verified,expires_at)
    VALUES (p_session_hash,p_user_id,p_csrf_hash,p_mfa_verified,p_expires_at);
  INSERT INTO public.admin_audit_log(actor_user_id,action,target_type,target_id)
    VALUES (p_user_id,'admin.login','admin_session',p_session_hash);
END $$;

CREATE FUNCTION public.revoke_admin_session(p_user_id uuid, p_session_hash text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.admin_sessions SET revoked_at = now()
  WHERE session_hash = p_session_hash AND user_id = p_user_id AND revoked_at IS NULL;
  IF FOUND THEN
    INSERT INTO public.admin_audit_log(actor_user_id,action,target_type,target_id)
      VALUES (p_user_id,'admin.logout','admin_session',p_session_hash);
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.start_admin_session(uuid,text,text,boolean,timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_admin_session(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_admin_session(uuid,text,text,boolean,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_admin_session(uuid,text) TO service_role;
