BEGIN;

CREATE FUNCTION public.unpublish_business_menu(p_business_id uuid, p_owner_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  PERFORM public.lock_business_capacity(p_business_id);
  IF NOT EXISTS (
    SELECT 1 FROM public.businesses WHERE id=p_business_id AND owner_user_id=p_owner_id
  ) OR NOT public.business_is_account_active(p_business_id) THEN
    RETURN false;
  END IF;

  UPDATE public.business_account_state SET is_published=false, updated_at=now()
  WHERE business_id=p_business_id;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.unpublish_business_menu(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.unpublish_business_menu(uuid,uuid) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
