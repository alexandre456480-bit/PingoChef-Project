-- Shared trigger records have different shapes on businesses and subscriptions.
-- JSON field extraction avoids resolving OLD.business_id on a business record.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE OR REPLACE FUNCTION public.assert_business_subscription() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid; BEGIN
 IF TG_TABLE_NAME='businesses' THEN
  v_id:=(to_jsonb(NEW)->>'id')::uuid;
 ELSE
  v_id:=(to_jsonb(OLD)->>'business_id')::uuid;
 END IF;
 IF EXISTS(SELECT 1 FROM public.businesses WHERE id=v_id)
  AND NOT EXISTS(SELECT 1 FROM public.subscriptions WHERE business_id=v_id) THEN
  RAISE EXCEPTION 'Business requires a subscription';
 END IF;
 RETURN NULL;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
