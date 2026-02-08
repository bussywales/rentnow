-- Agent onboarding progress tracking.

CREATE TABLE IF NOT EXISTS public.agent_onboarding_progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  has_listing boolean not null default false,
  has_client_page boolean not null default false,
  has_shared_page boolean not null default false,
  completed_at timestamptz null,
  updated_at timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS idx_agent_onboarding_progress_updated_at
  ON public.agent_onboarding_progress (updated_at desc);

ALTER TABLE public.agent_onboarding_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent onboarding progress owner select" ON public.agent_onboarding_progress;
CREATE POLICY "agent onboarding progress owner select"
  ON public.agent_onboarding_progress
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "agent onboarding progress owner upsert" ON public.agent_onboarding_progress;
CREATE POLICY "agent onboarding progress owner upsert"
  ON public.agent_onboarding_progress
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "agent onboarding progress owner update" ON public.agent_onboarding_progress;
CREATE POLICY "agent onboarding progress owner update"
  ON public.agent_onboarding_progress
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "agent onboarding progress admin read" ON public.agent_onboarding_progress;
CREATE POLICY "agent onboarding progress admin read"
  ON public.agent_onboarding_progress
  FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "agent onboarding progress admin write" ON public.agent_onboarding_progress;
CREATE POLICY "agent onboarding progress admin write"
  ON public.agent_onboarding_progress
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
