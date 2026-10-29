-- Opt-in pixel presentation; keep every existing selection and customization intact.
BEGIN;
ALTER TABLE public.design_settings DROP CONSTRAINT IF EXISTS design_settings_template_key_check;
ALTER TABLE public.design_settings ADD CONSTRAINT design_settings_template_key_check
  CHECK (template_key IN ('default', 'centered-cover', 'arched-cover', 'brand-hero', 'signature-cover', 'pixel'));
COMMIT;
