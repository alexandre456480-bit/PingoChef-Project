-- Opt-in presentation: retain customer content, branding and existing selections.
BEGIN;
ALTER TABLE public.design_settings DROP CONSTRAINT IF EXISTS design_settings_template_key_check;
ALTER TABLE public.design_settings ADD CONSTRAINT design_settings_template_key_check
  CHECK (template_key IN ('default', 'centered-cover', 'arched-cover', 'brand-hero', 'signature-cover', 'pixel', 'retro-diner', 'circuit-tech', 'soft-wave', 'immersive-cover'));
COMMIT;
