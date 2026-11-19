BEGIN;

CREATE TABLE public.app_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL CHECK (char_length(message) <= 1000 AND message ~ '[^[:space:]]'),
  created_on date NOT NULL DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo')::date)
);

CREATE INDEX app_suggestions_created_on_id_idx
  ON public.app_suggestions (created_on DESC, id DESC);

ALTER TABLE public.app_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_suggestions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_suggestions FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT (message) ON public.app_suggestions TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
