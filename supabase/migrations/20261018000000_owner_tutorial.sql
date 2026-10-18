-- UI-only onboarding belongs to the existing owner profile. No auth/RLS changes.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tutorial_status text NOT NULL DEFAULT 'NOT_STARTED'
    CHECK (tutorial_status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED')),
  ADD COLUMN IF NOT EXISTS tutorial_version integer NOT NULL DEFAULT 1 CHECK (tutorial_version > 0),
  ADD COLUMN IF NOT EXISTS tutorial_step text NOT NULL DEFAULT 'welcome' CHECK (length(tutorial_step) <= 64),
  ADD COLUMN IF NOT EXISTS tutorial_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS tutorial_finished_at timestamptz;

COMMENT ON COLUMN public.profiles.tutorial_status IS
  'Owner dashboard guide only; never used as an authorization or publication signal.';
