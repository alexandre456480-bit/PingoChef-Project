-- Deploy the API that normalizes cached clients before applying this migration.
-- Only template identity is reset; customer branding, content and feature flags stay intact.
BEGIN;

UPDATE public.design_settings
SET template_key = 'default',
    custom_config = custom_config - 'template_variant',
    home_blocks = CASE WHEN jsonb_typeof(home_blocks) = 'array' THEN
      coalesce((SELECT jsonb_agg(block ORDER BY ordinal)
        FROM jsonb_array_elements(home_blocks) WITH ORDINALITY AS entries(block, ordinal)
        WHERE block->>'type' IS DISTINCT FROM 'template_variant'), '[]'::jsonb)
      ELSE home_blocks END;

ALTER TABLE public.design_settings ALTER COLUMN template_key SET DEFAULT 'default';
ALTER TABLE public.design_settings DROP CONSTRAINT IF EXISTS design_settings_template_key_check;
ALTER TABLE public.design_settings ADD CONSTRAINT design_settings_template_key_check
  CHECK (template_key IN ('default'));

-- Preserve the report body, signature, security settings and grants, changing only its obsolete column.
DO $$
DECLARE report_definition text;
BEGIN
  SELECT pg_get_functiondef('public.admin_dashboard_report(timestamptz,timestamptz,text,text,timestamptz,timestamptz)'::regprocedure)
    INTO report_definition;
  EXECUTE replace(report_definition, 'template_id', 'template_key');
END $$;

ALTER TABLE public.design_settings DROP COLUMN IF EXISTS template_id;
COMMIT;
