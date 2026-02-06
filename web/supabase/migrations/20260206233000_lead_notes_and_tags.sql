-- Lead notes + tags for host/agent inbox and admin workflows.

CREATE TABLE IF NOT EXISTS public.lead_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.listing_leads (id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  visibility TEXT NOT NULL DEFAULT 'internal',
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_notes_lead_created_at
  ON public.lead_notes (lead_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.lead_tags (
  lead_id UUID NOT NULL REFERENCES public.listing_leads (id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (lead_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_lead_tags_tag
  ON public.lead_tags (tag);

ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_tags ENABLE ROW LEVEL SECURITY;

-- Lead notes policies.
DROP POLICY IF EXISTS "lead_notes_select" ON public.lead_notes;
CREATE POLICY "lead_notes_select" ON public.lead_notes
  FOR SELECT
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.listing_leads l
      WHERE l.id = lead_id AND l.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "lead_notes_insert" ON public.lead_notes;
CREATE POLICY "lead_notes_insert" ON public.lead_notes
  FOR INSERT
  WITH CHECK (
    auth.uid() = author_user_id
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.listing_leads l
        WHERE l.id = lead_id AND l.owner_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "lead_notes_delete" ON public.lead_notes;
CREATE POLICY "lead_notes_delete" ON public.lead_notes
  FOR DELETE
  USING (
    public.is_admin()
    OR auth.uid() = author_user_id
  );

-- Lead tags policies.
DROP POLICY IF EXISTS "lead_tags_select" ON public.lead_tags;
CREATE POLICY "lead_tags_select" ON public.lead_tags
  FOR SELECT
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.listing_leads l
      WHERE l.id = lead_id AND l.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "lead_tags_insert" ON public.lead_tags;
CREATE POLICY "lead_tags_insert" ON public.lead_tags
  FOR INSERT
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.listing_leads l
      WHERE l.id = lead_id AND l.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "lead_tags_delete" ON public.lead_tags;
CREATE POLICY "lead_tags_delete" ON public.lead_tags
  FOR DELETE
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.listing_leads l
      WHERE l.id = lead_id AND l.owner_id = auth.uid()
    )
  );

-- Extend lead status options for pipeline workflow.
ALTER TABLE public.listing_leads DROP CONSTRAINT IF EXISTS listing_leads_status_check;
ALTER TABLE public.listing_leads
  ADD CONSTRAINT listing_leads_status_check
  CHECK (status IN ('NEW', 'CONTACTED', 'VIEWING', 'WON', 'LOST', 'QUALIFIED', 'CLOSED'));

-- Extend property events to include lead note + status changes.
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
      'lead_status_updated',
      'lead_note_added',
      'viewing_requested',
      'share_open',
      'featured_impression'
    ));
END $$;
