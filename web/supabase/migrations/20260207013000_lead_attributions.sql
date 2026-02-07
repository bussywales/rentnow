-- Lead attribution for agent client pages.

CREATE TABLE IF NOT EXISTS public.lead_attributions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.listing_leads (id) on delete cascade,
  agent_user_id uuid not null references auth.users (id) on delete cascade,
  client_page_id uuid not null references public.agent_client_pages (id) on delete cascade,
  source text not null default 'agent_client_page',
  created_at timestamptz not null default now(),
  unique (lead_id)
);

CREATE INDEX IF NOT EXISTS idx_lead_attributions_agent_created
  ON public.lead_attributions (agent_user_id, created_at desc);

CREATE INDEX IF NOT EXISTS idx_lead_attributions_client_page_created
  ON public.lead_attributions (client_page_id, created_at desc);

ALTER TABLE public.lead_attributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lead_attributions_agent_select" ON public.lead_attributions;
CREATE POLICY "lead_attributions_agent_select"
  ON public.lead_attributions
  FOR SELECT
  USING (agent_user_id = auth.uid());

DROP POLICY IF EXISTS "lead_attributions_admin_select" ON public.lead_attributions;
CREATE POLICY "lead_attributions_admin_select"
  ON public.lead_attributions
  FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "lead_attributions_service_insert" ON public.lead_attributions;
CREATE POLICY "lead_attributions_service_insert"
  ON public.lead_attributions
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "lead_attributions_admin_write" ON public.lead_attributions;
CREATE POLICY "lead_attributions_admin_write"
  ON public.lead_attributions
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Extend property events to include lead attribution analytics.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'property_events_event_type_check'
      AND conrelid = 'public.property_events'::regclass
  ) THEN
    ALTER TABLE public.property_events
      DROP CONSTRAINT property_events_event_type_check;
  END IF;
  ALTER TABLE public.property_events
    ADD CONSTRAINT property_events_event_type_check
    CHECK (event_type IN (
      'property_view',
      'save_toggle',
      'lead_created',
      'lead_attributed',
      'lead_status_updated',
      'lead_note_added',
      'viewing_requested',
      'share_open',
      'featured_impression'
    ));
END $$;
