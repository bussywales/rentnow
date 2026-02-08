-- Agent commission tracking (attribution-only, no payouts).

CREATE TABLE IF NOT EXISTS public.agent_commission_agreements (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.properties (id) on delete cascade,
  owner_agent_id uuid not null references auth.users (id) on delete cascade,
  presenting_agent_id uuid not null references auth.users (id) on delete cascade,
  commission_type text not null default 'none',
  commission_value numeric,
  currency text,
  status text not null default 'proposed',
  notes text,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

ALTER TABLE public.agent_commission_agreements
  DROP CONSTRAINT IF EXISTS agent_commission_type_check;
ALTER TABLE public.agent_commission_agreements
  ADD CONSTRAINT agent_commission_type_check
  CHECK (commission_type in ('percentage', 'fixed', 'none'));

ALTER TABLE public.agent_commission_agreements
  DROP CONSTRAINT IF EXISTS agent_commission_status_check;
ALTER TABLE public.agent_commission_agreements
  ADD CONSTRAINT agent_commission_status_check
  CHECK (status in ('proposed', 'accepted', 'declined', 'void'));

CREATE UNIQUE INDEX IF NOT EXISTS agent_commission_unique
  ON public.agent_commission_agreements (listing_id, presenting_agent_id);

CREATE INDEX IF NOT EXISTS agent_commission_owner_idx
  ON public.agent_commission_agreements (owner_agent_id, created_at desc);

CREATE INDEX IF NOT EXISTS agent_commission_presenting_idx
  ON public.agent_commission_agreements (presenting_agent_id, created_at desc);

CREATE INDEX IF NOT EXISTS agent_commission_listing_idx
  ON public.agent_commission_agreements (listing_id);

CREATE TABLE IF NOT EXISTS public.agent_commission_events (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.agent_commission_agreements (id) on delete cascade,
  lead_id uuid not null references public.listing_leads (id) on delete cascade,
  event text not null,
  marked_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

ALTER TABLE public.agent_commission_events
  DROP CONSTRAINT IF EXISTS agent_commission_event_check;
ALTER TABLE public.agent_commission_events
  ADD CONSTRAINT agent_commission_event_check
  CHECK (event in ('deal_marked_won', 'deal_marked_lost'));

CREATE UNIQUE INDEX IF NOT EXISTS agent_commission_event_unique
  ON public.agent_commission_events (agreement_id, lead_id, event);

CREATE INDEX IF NOT EXISTS agent_commission_events_agreement_idx
  ON public.agent_commission_events (agreement_id, created_at desc);

CREATE INDEX IF NOT EXISTS agent_commission_events_lead_idx
  ON public.agent_commission_events (lead_id, created_at desc);

ALTER TABLE public.agent_commission_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_commission_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_commission_agreements_select ON public.agent_commission_agreements;
CREATE POLICY agent_commission_agreements_select
  ON public.agent_commission_agreements
  FOR SELECT
  USING (
    owner_agent_id = auth.uid()
    OR presenting_agent_id = auth.uid()
    OR public.is_admin()
  );

DROP POLICY IF EXISTS agent_commission_agreements_insert ON public.agent_commission_agreements;
CREATE POLICY agent_commission_agreements_insert
  ON public.agent_commission_agreements
  FOR INSERT
  WITH CHECK (
    presenting_agent_id = auth.uid()
    OR public.is_admin()
  );

DROP POLICY IF EXISTS agent_commission_agreements_update ON public.agent_commission_agreements;
CREATE POLICY agent_commission_agreements_update
  ON public.agent_commission_agreements
  FOR UPDATE
  USING (
    owner_agent_id = auth.uid()
    OR public.is_admin()
  )
  WITH CHECK (
    owner_agent_id = auth.uid()
    OR public.is_admin()
  );

DROP POLICY IF EXISTS agent_commission_agreements_delete ON public.agent_commission_agreements;
CREATE POLICY agent_commission_agreements_delete
  ON public.agent_commission_agreements
  FOR DELETE
  USING (
    owner_agent_id = auth.uid()
    OR public.is_admin()
  );

DROP POLICY IF EXISTS agent_commission_events_select ON public.agent_commission_events;
CREATE POLICY agent_commission_events_select
  ON public.agent_commission_events
  FOR SELECT
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.agent_commission_agreements a
      WHERE a.id = agreement_id
        AND (a.owner_agent_id = auth.uid() OR a.presenting_agent_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS agent_commission_events_insert ON public.agent_commission_events;
CREATE POLICY agent_commission_events_insert
  ON public.agent_commission_events
  FOR INSERT
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.agent_commission_agreements a
      WHERE a.id = agreement_id
        AND a.owner_agent_id = auth.uid()
    )
  );
