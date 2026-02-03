-- Supabase hardening: indexes, policy consolidation, and function safeguards

-- Admin helper for policy checks
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public, pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- Indexes for unindexed foreign keys
CREATE INDEX IF NOT EXISTS idx_saved_properties_property_id ON public.saved_properties (property_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON public.messages (recipient_id);
CREATE INDEX IF NOT EXISTS idx_legal_documents_published_by ON public.legal_documents (published_by);
CREATE INDEX IF NOT EXISTS idx_legal_acceptances_document_id ON public.legal_acceptances (document_id);
CREATE INDEX IF NOT EXISTS idx_listing_leads_thread_id ON public.listing_leads (thread_id);
CREATE INDEX IF NOT EXISTS idx_property_share_links_rotated_from ON public.property_share_links (rotated_from);
CREATE INDEX IF NOT EXISTS idx_support_requests_user_id ON public.support_requests (user_id);

-- Harden search_path for mutable functions
ALTER FUNCTION public.prevent_no_show_change() SET search_path = public, pg_catalog;
ALTER FUNCTION public.touch_user_verifications_updated_at() SET search_path = public, pg_catalog;

-- Drop superseded policies (consolidated below)
DROP POLICY IF EXISTS "user verifications admin read" ON public.user_verifications;
DROP POLICY IF EXISTS "user verifications admin write" ON public.user_verifications;
DROP POLICY IF EXISTS "property share links admin read" ON public.property_share_links;
DROP POLICY IF EXISTS "legal acceptances admin read" ON public.legal_acceptances;
DROP POLICY IF EXISTS "properties owner/admin read" ON public.properties;
DROP POLICY IF EXISTS "images owner/admin read" ON public.property_images;
DROP POLICY IF EXISTS "viewings host select owned" ON public.viewing_requests;

-- Consolidated + hardened policies
DROP POLICY IF EXISTS "user verifications select self" ON public.user_verifications;
CREATE POLICY "user verifications select self" ON public.user_verifications
  FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "user verifications update self" ON public.user_verifications;
CREATE POLICY "user verifications update self" ON public.user_verifications
  FOR UPDATE
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "property share links select owner" ON public.property_share_links;
CREATE POLICY "property share links select owner" ON public.property_share_links
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.properties p
      WHERE p.id = property_id
        AND p.owner_id = auth.uid()
    )
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "property share links admin write" ON public.property_share_links;
CREATE POLICY "property share links admin write" ON public.property_share_links
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "support requests insert" ON public.support_requests;
CREATE POLICY "support requests insert" ON public.support_requests
  FOR INSERT
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

DROP POLICY IF EXISTS "support requests admin read" ON public.support_requests;
CREATE POLICY "support requests admin read" ON public.support_requests
  FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "app_settings_read" ON public.app_settings;
CREATE POLICY "app_settings_read" ON public.app_settings
  FOR SELECT
  TO authenticated, anon
  USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

DROP POLICY IF EXISTS "legal documents admin write" ON public.legal_documents;
CREATE POLICY "legal documents admin write" ON public.legal_documents
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "legal acceptances select self" ON public.legal_acceptances;
CREATE POLICY "legal acceptances select self" ON public.legal_acceptances
  FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "listing_leads_select" ON public.listing_leads;
CREATE POLICY "listing_leads_select" ON public.listing_leads
  FOR SELECT
  USING (
    auth.uid() = buyer_id
    OR auth.uid() = owner_id
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "listing_leads_update" ON public.listing_leads;
CREATE POLICY "listing_leads_update" ON public.listing_leads
  FOR UPDATE
  USING (
    auth.uid() = owner_id
    OR public.is_admin()
  )
  WITH CHECK (
    auth.uid() = owner_id
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "agent delegations select" ON public.agent_delegations;
CREATE POLICY "agent delegations select" ON public.agent_delegations
  FOR SELECT
  USING (
    auth.uid() = agent_id
    OR auth.uid() = landlord_id
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "agent delegations insert" ON public.agent_delegations;
CREATE POLICY "agent delegations insert" ON public.agent_delegations
  FOR INSERT
  WITH CHECK (
    (
      auth.uid() = agent_id
      AND status = 'pending'
    )
    OR (
      auth.uid() = landlord_id
      AND status IN ('pending', 'active')
    )
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "agent delegations update" ON public.agent_delegations;
CREATE POLICY "agent delegations update" ON public.agent_delegations
  FOR UPDATE
  USING (
    auth.uid() = landlord_id
    OR public.is_admin()
  )
  WITH CHECK (
    auth.uid() = landlord_id
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "agent delegations delete" ON public.agent_delegations;
CREATE POLICY "agent delegations delete" ON public.agent_delegations
  FOR DELETE
  USING (
    auth.uid() = agent_id
    OR auth.uid() = landlord_id
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "billing notes admin read" ON public.profile_billing_notes;
CREATE POLICY "billing notes admin read" ON public.profile_billing_notes
  FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "billing notes admin write" ON public.profile_billing_notes;
CREATE POLICY "billing notes admin write" ON public.profile_billing_notes
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "upgrade requests select self" ON public.plan_upgrade_requests;
CREATE POLICY "upgrade requests select self" ON public.plan_upgrade_requests
  FOR SELECT
  USING (
    auth.uid() = requester_id
    OR auth.uid() = profile_id
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "upgrade requests update admin" ON public.plan_upgrade_requests;
CREATE POLICY "upgrade requests update admin" ON public.plan_upgrade_requests
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "upgrade requests delete admin" ON public.plan_upgrade_requests;
CREATE POLICY "upgrade requests delete admin" ON public.plan_upgrade_requests
  FOR DELETE
  USING (public.is_admin());

DROP POLICY IF EXISTS "properties public read" ON public.properties;
CREATE POLICY "properties public read" ON public.properties
  FOR SELECT
  USING (
    (
      is_approved = TRUE
      AND is_active = TRUE
      AND status = 'live'
      AND (expires_at IS NULL OR expires_at >= now())
    )
    OR (
      is_approved = TRUE
      AND (
        status = 'expired'
        OR (status = 'live' AND expires_at IS NOT NULL AND expires_at < now())
      )
      AND EXISTS (
        SELECT 1 FROM public.app_settings s
        WHERE s.key = 'show_expired_listings_public'
          AND COALESCE((s.value->>'enabled')::boolean, false) = TRUE
      )
    )
    OR (
      auth.uid() = owner_id
      OR EXISTS (
        SELECT 1 FROM public.agent_delegations d
        WHERE d.agent_id = auth.uid()
          AND d.landlord_id = owner_id
          AND d.status = 'active'
      )
      OR public.is_admin()
    )
  );

DROP POLICY IF EXISTS "properties owner/admin insert" ON public.properties;
CREATE POLICY "properties owner/admin insert" ON public.properties
  FOR INSERT
  WITH CHECK (
    auth.uid() = owner_id
    OR EXISTS (
      SELECT 1 FROM public.agent_delegations d
      WHERE d.agent_id = auth.uid()
        AND d.landlord_id = owner_id
        AND d.status = 'active'
    )
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "properties owner/admin update" ON public.properties;
CREATE POLICY "properties owner/admin update" ON public.properties
  FOR UPDATE
  USING (
    auth.uid() = owner_id
    OR EXISTS (
      SELECT 1 FROM public.agent_delegations d
      WHERE d.agent_id = auth.uid()
        AND d.landlord_id = owner_id
        AND d.status = 'active'
    )
    OR public.is_admin()
  )
  WITH CHECK (
    auth.uid() = owner_id
    OR EXISTS (
      SELECT 1 FROM public.agent_delegations d
      WHERE d.agent_id = auth.uid()
        AND d.landlord_id = owner_id
        AND d.status = 'active'
    )
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "properties owner/admin delete" ON public.properties;
CREATE POLICY "properties owner/admin delete" ON public.properties
  FOR DELETE
  USING (
    auth.uid() = owner_id
    OR EXISTS (
      SELECT 1 FROM public.agent_delegations d
      WHERE d.agent_id = auth.uid()
        AND d.landlord_id = owner_id
        AND d.status = 'active'
    )
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "images public read approved" ON public.property_images;
CREATE POLICY "images public read approved" ON public.property_images
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.properties pr
      WHERE pr.id = property_id
        AND pr.is_approved = TRUE
        AND pr.is_active = TRUE
    )
    OR EXISTS (
      SELECT 1 FROM public.properties pr
      WHERE pr.id = property_id
        AND (
          pr.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.agent_delegations d
            WHERE d.agent_id = auth.uid()
              AND d.landlord_id = pr.owner_id
              AND d.status = 'active'
          )
          OR public.is_admin()
        )
    )
  );

DROP POLICY IF EXISTS "images owner/admin insert" ON public.property_images;
CREATE POLICY "images owner/admin insert" ON public.property_images
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.properties pr
      WHERE pr.id = property_id
        AND (
          pr.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.agent_delegations d
            WHERE d.agent_id = auth.uid()
              AND d.landlord_id = pr.owner_id
              AND d.status = 'active'
          )
          OR public.is_admin()
        )
    )
  );

DROP POLICY IF EXISTS "images owner/admin delete" ON public.property_images;
CREATE POLICY "images owner/admin delete" ON public.property_images
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.properties pr
      WHERE pr.id = property_id
        AND (
          pr.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.agent_delegations d
            WHERE d.agent_id = auth.uid()
              AND d.landlord_id = pr.owner_id
              AND d.status = 'active'
          )
          OR public.is_admin()
        )
    )
  );

DROP POLICY IF EXISTS "videos owner/admin read" ON public.property_videos;
CREATE POLICY "videos owner/admin read" ON public.property_videos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.properties pr
      WHERE pr.id = property_id
        AND (
          pr.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.agent_delegations d
            WHERE d.agent_id = auth.uid()
              AND d.landlord_id = pr.owner_id
              AND d.status = 'active'
          )
          OR public.is_admin()
        )
    )
  );

DROP POLICY IF EXISTS "videos owner/admin insert" ON public.property_videos;
CREATE POLICY "videos owner/admin insert" ON public.property_videos
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.properties pr
      WHERE pr.id = property_id
        AND (
          pr.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.agent_delegations d
            WHERE d.agent_id = auth.uid()
              AND d.landlord_id = pr.owner_id
              AND d.status = 'active'
          )
          OR public.is_admin()
        )
    )
  );

DROP POLICY IF EXISTS "videos owner/admin update" ON public.property_videos;
CREATE POLICY "videos owner/admin update" ON public.property_videos
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.properties pr
      WHERE pr.id = property_id
        AND (
          pr.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.agent_delegations d
            WHERE d.agent_id = auth.uid()
              AND d.landlord_id = pr.owner_id
              AND d.status = 'active'
          )
          OR public.is_admin()
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.properties pr
      WHERE pr.id = property_id
        AND (
          pr.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.agent_delegations d
            WHERE d.agent_id = auth.uid()
              AND d.landlord_id = pr.owner_id
              AND d.status = 'active'
          )
          OR public.is_admin()
        )
    )
  );

DROP POLICY IF EXISTS "videos owner/admin delete" ON public.property_videos;
CREATE POLICY "videos owner/admin delete" ON public.property_videos
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.properties pr
      WHERE pr.id = property_id
        AND (
          pr.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.agent_delegations d
            WHERE d.agent_id = auth.uid()
              AND d.landlord_id = pr.owner_id
              AND d.status = 'active'
          )
          OR public.is_admin()
        )
    )
  );

DROP POLICY IF EXISTS "messages participant/owner read" ON public.messages;
CREATE POLICY "messages participant/owner read" ON public.messages
  FOR SELECT
  USING (
    auth.uid() = sender_id
    OR auth.uid() = recipient_id
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "message threads participant read" ON public.message_threads;
CREATE POLICY "message threads participant read" ON public.message_threads
  FOR SELECT
  USING (
    auth.uid() = tenant_id
    OR auth.uid() = host_id
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "message thread reads self read" ON public.message_thread_reads;
CREATE POLICY "message thread reads self read" ON public.message_thread_reads
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "viewings tenant select" ON public.viewing_requests;
CREATE POLICY "viewings tenant select" ON public.viewing_requests
  FOR SELECT
  USING (
    auth.uid() = tenant_id
    OR EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_id
        AND p.owner_id = auth.uid()
    )
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "viewings host update owned" ON public.viewing_requests;
CREATE POLICY "viewings host update owned" ON public.viewing_requests
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_id
        AND p.owner_id = auth.uid()
    )
    OR public.is_admin()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_id
        AND p.owner_id = auth.uid()
    )
    OR public.is_admin()
  );

-- Ask PostgREST to reload schema immediately.
NOTIFY pgrst, 'reload schema';
