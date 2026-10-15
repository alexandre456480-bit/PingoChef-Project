-- Three live QR identities per business; tombstones retain Analytics attribution.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
ALTER TABLE public.analytics_qr_refs ADD COLUMN deleted_at timestamptz;
ALTER TABLE public.qr_settings ALTER COLUMN max_codes_per_business SET DEFAULT 3;
UPDATE public.qr_settings SET max_codes_per_business=3;
ALTER TABLE public.qr_settings DROP CONSTRAINT qr_settings_max_codes_per_business_check;
ALTER TABLE public.qr_settings ADD CONSTRAINT qr_settings_max_codes_per_business_check
 CHECK(max_codes_per_business BETWEEN 1 AND 3);
CREATE OR REPLACE FUNCTION public.manage_business_qr(
  p_business uuid, p_id uuid, p_label text, p_configuration jsonb, p_active boolean, p_revision integer
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s jsonb; r public.analytics_qr_refs%ROWTYPE; v_max integer;
BEGIN
  PERFORM public.lock_business_capacity(p_business);
  s := public.business_entitlement_snapshot(p_business);
  IF coalesce((s->'entitlements'->>'QR_GENERATOR')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'QR_NOT_ENTITLED';
  END IF;
  IF p_label IS NULL OR length(btrim(p_label)) NOT BETWEEN 1 AND 120 OR p_active IS NULL OR p_configuration IS NULL
    OR jsonb_typeof(p_configuration) <> 'object' OR octet_length(p_configuration::text) > 150000
    OR NOT (p_configuration ?& ARRAY['color','frame','caption','logoPng'])
    OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_configuration) k WHERE k NOT IN ('color','frame','caption','logoPng'))
    OR coalesce(p_configuration->>'color','') !~ '^#[a-fA-F0-9]{6}$'
    OR coalesce(p_configuration->>'frame','') NOT IN ('none','card')
    OR p_configuration->>'caption' IS NULL OR length(p_configuration->>'caption') > 40
    OR (p_configuration->'logoPng' <> 'null'::jsonb AND (
      jsonb_typeof(p_configuration->'logoPng') <> 'string'
      OR coalesce(p_configuration->>'logoPng','') !~ '^data:image/png;base64,[A-Za-z0-9+/]+={0,2}$'
    ))
  THEN RAISE EXCEPTION 'INVALID_QR_CONFIGURATION'; END IF;
  IF coalesce((s->'entitlements'->>'QR_CUSTOMIZATION')::boolean, false) IS NOT TRUE
    AND p_configuration <> '{"color":"#2C1024","frame":"card","caption":"Acesse nosso cardápio","logoPng":null}'::jsonb
  THEN RAISE EXCEPTION 'QR_CUSTOMIZATION_NOT_ENTITLED'; END IF;
  IF p_id IS NULL THEN
    SELECT max_codes_per_business INTO v_max FROM public.qr_settings WHERE singleton;
    IF (SELECT count(*) FROM public.analytics_qr_refs WHERE business_id = p_business AND deleted_at IS NULL) >= v_max THEN
      RAISE EXCEPTION 'QR_CAPACITY_REACHED';
    END IF;
    INSERT INTO public.analytics_qr_refs(business_id,label,configuration,active)
    VALUES (p_business,btrim(p_label),p_configuration,p_active) RETURNING * INTO r;
  ELSE
    SELECT * INTO r FROM public.analytics_qr_refs WHERE id = p_id AND business_id = p_business AND deleted_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'QR_NOT_FOUND'; END IF;
    IF p_revision IS NULL OR r.revision <> p_revision THEN RAISE EXCEPTION 'QR_VERSION_CONFLICT'; END IF;
    UPDATE public.analytics_qr_refs
      SET label = btrim(p_label), configuration = p_configuration, active = p_active,
          updated_at = now(), revision = revision + 1
      WHERE id = p_id AND business_id = p_business RETURNING * INTO r;
  END IF;
  RETURN to_jsonb(r);
END;
$$;

REVOKE ALL ON FUNCTION public.manage_business_qr(uuid,uuid,text,jsonb,boolean,integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.manage_business_qr(uuid,uuid,text,jsonb,boolean,integer)
  TO service_role;


CREATE FUNCTION public.delete_business_qr(p_business uuid,p_id uuid,p_revision integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.analytics_qr_refs%ROWTYPE; s jsonb;
BEGIN
 PERFORM public.lock_business_capacity(p_business);
 s:=public.business_entitlement_snapshot(p_business);
 IF coalesce((s->'entitlements'->>'QR_GENERATOR')::boolean,false) IS NOT TRUE THEN
  RAISE EXCEPTION 'QR_NOT_ENTITLED'; END IF;
 SELECT * INTO r FROM public.analytics_qr_refs
  WHERE business_id=p_business AND id=p_id AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'QR_NOT_FOUND'; END IF;
 IF p_revision IS NULL OR p_revision<>r.revision THEN RAISE EXCEPTION 'QR_VERSION_CONFLICT'; END IF;
 UPDATE public.analytics_qr_refs SET active=false,deleted_at=now(),updated_at=now(),revision=revision+1,
  configuration=DEFAULT WHERE business_id=p_business AND id=p_id;
END $$;
REVOKE ALL ON FUNCTION public.delete_business_qr(uuid,uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.delete_business_qr(uuid,uuid,integer) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
