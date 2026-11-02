-- Uses the existing businesses ownership policies; no orders or customer data are stored.
BEGIN;
CREATE FUNCTION public.valid_business_order_settings(settings jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  address text;
  channel text;
  hostname text;
BEGIN
  IF settings IS NULL OR jsonb_typeof(settings) <> 'object'
    OR (settings - ARRAY['enabled','channel','url','button_text']) <> '{}'::jsonb
    OR jsonb_typeof(settings->'enabled') IS DISTINCT FROM 'boolean'
    OR jsonb_typeof(settings->'channel') IS DISTINCT FROM 'string'
    OR jsonb_typeof(settings->'url') IS DISTINCT FROM 'string'
    OR jsonb_typeof(settings->'button_text') IS DISTINCT FROM 'string'
    THEN RETURN false; END IF;
  channel := settings->>'channel';
  address := settings->>'url';
  IF channel NOT IN ('whatsapp','ifood','website','delivery','other')
    OR length(btrim(settings->>'button_text')) NOT BETWEEN 1 AND 40
    OR settings->>'button_text' ~ '[<>[:cntrl:]]'
    OR length(address) > 2048 THEN RETURN false; END IF;
  IF address = '' AND settings->>'enabled' = 'false' THEN RETURN true; END IF;
  IF address ~ '[[:space:][:cntrl:]\\]'
    OR address !~* '^https://([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}(:443)?([/?#]|$)'
    THEN RETURN false; END IF;
  hostname := lower(substring(address FROM '(?i)^https://([^/:?#]+)'));
  IF hostname ~ '\.(localhost|local|internal|test|invalid|example)$' THEN RETURN false; END IF;
  IF channel = 'ifood' AND hostname !~ '(^|\.)ifood\.com\.br$' THEN RETURN false; END IF;
  IF channel = 'whatsapp' AND NOT (
    (hostname = 'wa.me' AND address ~* '^https://wa\.me(:443)?/[1-9][0-9]{7,14}/?([?#].*)?$')
    OR (hostname ~ '^(api\.|web\.|www\.)?whatsapp\.com$'
      AND address ~* '^https://(api\.|web\.|www\.)?whatsapp\.com(:443)?/send\?([^#]*&)?phone=[1-9][0-9]{7,14}(&[^#]*)?(#.*)?$'
      AND (length(address) - length(replace(address, 'phone=', ''))) = 6)
  ) THEN RETURN false; END IF;
  RETURN true;
END;
$$;

ALTER TABLE public.businesses ADD COLUMN order_settings jsonb NOT NULL
  DEFAULT '{"enabled":false,"channel":"whatsapp","url":"","button_text":"Fazer pedido"}'::jsonb;
ALTER TABLE public.businesses ADD CONSTRAINT businesses_order_settings_check
  CHECK (public.valid_business_order_settings(order_settings));
COMMIT;
