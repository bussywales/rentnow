-- Agent client pages v2 fields + curation.

ALTER TABLE public.agent_client_pages
  ADD COLUMN IF NOT EXISTS agent_company_name text,
  ADD COLUMN IF NOT EXISTS agent_logo_url text,
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS agent_about text,
  ADD COLUMN IF NOT EXISTS client_requirements text,
  ADD COLUMN IF NOT EXISTS notes_md text,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS unpublished_at timestamptz;

ALTER TABLE public.agent_client_pages
  ALTER COLUMN client_name DROP NOT NULL;

ALTER TABLE public.agent_client_pages
  ALTER COLUMN published SET DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_agent_client_pages_agent_updated
  ON public.agent_client_pages (agent_user_id, updated_at desc);

CREATE INDEX IF NOT EXISTS idx_agent_client_pages_published
  ON public.agent_client_pages (published, published_at);

-- Curation join table.
CREATE TABLE IF NOT EXISTS public.agent_client_page_listings (
  id uuid primary key default gen_random_uuid(),
  client_page_id uuid not null references public.agent_client_pages (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  rank int not null default 0,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  unique (client_page_id, property_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_client_page_listings_rank
  ON public.agent_client_page_listings (client_page_id, rank);

CREATE INDEX IF NOT EXISTS idx_agent_client_page_listings_property
  ON public.agent_client_page_listings (client_page_id, property_id);

ALTER TABLE public.agent_client_page_listings ENABLE ROW LEVEL SECURITY;

-- Refresh public select policy to include expiration.
DROP POLICY IF EXISTS "agent_client_pages_public_select" ON public.agent_client_pages;
CREATE POLICY "agent_client_pages_public_select"
  ON public.agent_client_pages
  FOR SELECT
  USING (
    published is true
    and (expires_at is null or expires_at > now())
    and exists (
      select 1
      from public.agent_storefronts s
      where s.user_id = agent_user_id
        and s.enabled is true
    )
    and coalesce(
      (
        select
          coalesce(
            case
              when jsonb_typeof(value) = 'object' and value ? 'enabled' then (value->>'enabled')::boolean
            end,
            case when jsonb_typeof(value) = 'boolean' then (value::text)::boolean end,
            true
          )
        from public.app_settings
        where key = 'agent_storefronts_enabled'
        limit 1
      ),
      true
    )
  );

-- Public can read curated listings for published pages.
DROP POLICY IF EXISTS "agent_client_page_listings_public_select" ON public.agent_client_page_listings;
CREATE POLICY "agent_client_page_listings_public_select"
  ON public.agent_client_page_listings
  FOR SELECT
  USING (
    exists (
      select 1
      from public.agent_client_pages p
      where p.id = client_page_id
        and p.published is true
        and (p.expires_at is null or p.expires_at > now())
        and exists (
          select 1
          from public.agent_storefronts s
          where s.user_id = p.agent_user_id
            and s.enabled is true
        )
        and coalesce(
          (
            select
              coalesce(
                case
                  when jsonb_typeof(value) = 'object' and value ? 'enabled' then (value->>'enabled')::boolean
                end,
                case when jsonb_typeof(value) = 'boolean' then (value::text)::boolean end,
                true
              )
            from public.app_settings
            where key = 'agent_storefronts_enabled'
            limit 1
          ),
          true
        )
    )
  );

-- Owners/admin can manage listings.
DROP POLICY IF EXISTS "agent_client_page_listings_owner_select" ON public.agent_client_page_listings;
CREATE POLICY "agent_client_page_listings_owner_select"
  ON public.agent_client_page_listings
  FOR SELECT
  USING (
    exists (
      select 1
      from public.agent_client_pages p
      where p.id = client_page_id and p.agent_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "agent_client_page_listings_owner_insert" ON public.agent_client_page_listings;
CREATE POLICY "agent_client_page_listings_owner_insert"
  ON public.agent_client_page_listings
  FOR INSERT
  WITH CHECK (
    exists (
      select 1
      from public.agent_client_pages p
      where p.id = client_page_id and p.agent_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "agent_client_page_listings_owner_update" ON public.agent_client_page_listings;
CREATE POLICY "agent_client_page_listings_owner_update"
  ON public.agent_client_page_listings
  FOR UPDATE
  USING (
    exists (
      select 1
      from public.agent_client_pages p
      where p.id = client_page_id and p.agent_user_id = auth.uid()
    )
  )
  WITH CHECK (
    exists (
      select 1
      from public.agent_client_pages p
      where p.id = client_page_id and p.agent_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "agent_client_page_listings_owner_delete" ON public.agent_client_page_listings;
CREATE POLICY "agent_client_page_listings_owner_delete"
  ON public.agent_client_page_listings
  FOR DELETE
  USING (
    exists (
      select 1
      from public.agent_client_pages p
      where p.id = client_page_id and p.agent_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "agent_client_page_listings_admin_select" ON public.agent_client_page_listings;
CREATE POLICY "agent_client_page_listings_admin_select"
  ON public.agent_client_page_listings
  FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "agent_client_page_listings_admin_write" ON public.agent_client_page_listings;
CREATE POLICY "agent_client_page_listings_admin_write"
  ON public.agent_client_page_listings
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Create storage bucket for client page assets (public read).
INSERT INTO storage.buckets (id, name, public)
VALUES ('agent-client-pages', 'agent-client-pages', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "agent client pages public read" ON storage.objects;
CREATE POLICY "agent client pages public read" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'agent-client-pages');

DROP POLICY IF EXISTS "agent client pages owner insert" ON storage.objects;
CREATE POLICY "agent client pages owner insert" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'agent-client-pages' AND owner = auth.uid());

DROP POLICY IF EXISTS "agent client pages owner update" ON storage.objects;
CREATE POLICY "agent client pages owner update" ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'agent-client-pages' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'agent-client-pages' AND owner = auth.uid());

DROP POLICY IF EXISTS "agent client pages owner delete" ON storage.objects;
CREATE POLICY "agent client pages owner delete" ON storage.objects
  FOR DELETE
  USING (bucket_id = 'agent-client-pages' AND owner = auth.uid());
