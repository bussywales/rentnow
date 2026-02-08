-- Agent network sharing + attribution extensions.

CREATE TABLE IF NOT EXISTS public.agent_listing_shares (
  id uuid primary key default gen_random_uuid(),
  client_page_id uuid not null references public.agent_client_pages (id) on delete cascade,
  listing_id uuid not null references public.properties (id) on delete cascade,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  presenting_user_id uuid not null references auth.users (id) on delete cascade,
  mode text not null default 'share',
  created_at timestamptz not null default now(),
  unique (client_page_id, listing_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_listing_shares_presenting_created
  ON public.agent_listing_shares (presenting_user_id, created_at desc);

CREATE INDEX IF NOT EXISTS idx_agent_listing_shares_owner_created
  ON public.agent_listing_shares (owner_user_id, created_at desc);

CREATE INDEX IF NOT EXISTS idx_agent_listing_shares_listing
  ON public.agent_listing_shares (listing_id);

CREATE INDEX IF NOT EXISTS idx_agent_listing_shares_client_page
  ON public.agent_listing_shares (client_page_id);

ALTER TABLE public.agent_listing_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent listing shares presenting select" ON public.agent_listing_shares;
CREATE POLICY "agent listing shares presenting select"
  ON public.agent_listing_shares
  FOR SELECT
  USING (
    presenting_user_id = auth.uid()
    and exists (
      select 1
      from public.agent_client_pages p
      where p.id = client_page_id and p.agent_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "agent listing shares presenting insert" ON public.agent_listing_shares;
CREATE POLICY "agent listing shares presenting insert"
  ON public.agent_listing_shares
  FOR INSERT
  WITH CHECK (
    presenting_user_id = auth.uid()
    and exists (
      select 1
      from public.agent_client_pages p
      where p.id = client_page_id and p.agent_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "agent listing shares presenting delete" ON public.agent_listing_shares;
CREATE POLICY "agent listing shares presenting delete"
  ON public.agent_listing_shares
  FOR DELETE
  USING (
    presenting_user_id = auth.uid()
    and exists (
      select 1
      from public.agent_client_pages p
      where p.id = client_page_id and p.agent_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "agent listing shares owner select" ON public.agent_listing_shares;
CREATE POLICY "agent listing shares owner select"
  ON public.agent_listing_shares
  FOR SELECT
  USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "agent listing shares admin write" ON public.agent_listing_shares;
CREATE POLICY "agent listing shares admin write"
  ON public.agent_listing_shares
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Extend lead attribution for agent network signals.
ALTER TABLE public.lead_attributions
  ADD COLUMN IF NOT EXISTS presenting_agent_id uuid references auth.users (id) on delete set null,
  ADD COLUMN IF NOT EXISTS owner_user_id uuid references auth.users (id) on delete set null,
  ADD COLUMN IF NOT EXISTS listing_id uuid references public.properties (id) on delete set null;

ALTER TABLE public.lead_attributions
  ALTER COLUMN source SET DEFAULT 'client_page';

CREATE INDEX IF NOT EXISTS idx_lead_attributions_presenting_created
  ON public.lead_attributions (presenting_agent_id, created_at desc);

CREATE INDEX IF NOT EXISTS idx_lead_attributions_owner_created
  ON public.lead_attributions (owner_user_id, created_at desc);

CREATE INDEX IF NOT EXISTS idx_lead_attributions_listing_created
  ON public.lead_attributions (listing_id, created_at desc);

-- Add agent network event type.
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
      'client_page_lead_viewed',
      'client_page_lead_status_updated',
      'listing_submit_attempted',
      'listing_submit_blocked_no_credits',
      'listing_payment_started',
      'listing_payment_succeeded',
      'listing_credit_consumed',
      'agent_network_shared',
      'viewing_requested',
      'share_open',
      'featured_impression'
    ));
END $$;
