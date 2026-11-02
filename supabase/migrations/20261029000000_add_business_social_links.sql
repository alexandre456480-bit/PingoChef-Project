-- Optional presentation links, protected by the existing business ownership policies.
BEGIN;
CREATE FUNCTION public.valid_business_social_links(links jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  entry jsonb;
  platform text;
  address text;
  hostname text;
  seen text[] := ARRAY[]::text[];
  entry_key text;
BEGIN
  IF links IS NULL OR jsonb_typeof(links) <> 'array' THEN RETURN false; END IF;
  IF jsonb_array_length(links) > 10 THEN RETURN false; END IF;
  FOR entry IN SELECT value FROM jsonb_array_elements(links) LOOP
    IF jsonb_typeof(entry) <> 'object' OR (entry - ARRAY['platform','url','label']) <> '{}'::jsonb
      OR jsonb_typeof(entry->'platform') IS DISTINCT FROM 'string'
      OR jsonb_typeof(entry->'url') IS DISTINCT FROM 'string' THEN RETURN false; END IF;
    platform := entry->>'platform';
    address := entry->>'url';
    IF platform NOT IN ('instagram','tiktok','ifood','99','whatsapp','other')
      OR length(address) > 2048 OR address ~ '[[:space:][:cntrl:]\\]'
      OR address !~* '^https://([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}(:443)?([/?#]|$)'
      THEN RETURN false; END IF;
    hostname := lower(substring(address FROM '(?i)^https://([^/:?#]+)'));
    IF hostname ~ '\.(localhost|local|internal|test|invalid|example)$' THEN RETURN false; END IF;
    IF (platform = 'instagram' AND hostname !~ '(^|\.)instagram\.com$')
      OR (platform = 'tiktok' AND hostname !~ '(^|\.)tiktok\.com$')
      OR (platform = 'ifood' AND hostname !~ '(^|\.)ifood\.com\.br$')
      OR (platform = '99' AND hostname !~ '(^|\.)(99app\.com|99food\.com\.br)$')
      OR (platform = 'whatsapp' AND hostname !~ '(^|\.)(wa\.me|whatsapp\.com)$') THEN RETURN false; END IF;
    IF entry ? 'label' THEN
      IF jsonb_typeof(entry->'label') IS DISTINCT FROM 'string'
        OR length(btrim(entry->>'label')) NOT BETWEEN 1 AND 40
        OR entry->>'label' ~ '[<>[:cntrl:]]' THEN RETURN false; END IF;
    END IF;
    entry_key := CASE WHEN platform = 'other' THEN address ELSE platform END;
    IF entry_key = ANY(seen) THEN RETURN false; END IF;
    seen := array_append(seen, entry_key);
  END LOOP;
  RETURN true;
END;
$$;

ALTER TABLE public.businesses ADD COLUMN social_links jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.businesses ADD CONSTRAINT businesses_social_links_check
  CHECK (public.valid_business_social_links(social_links));
COMMIT;
