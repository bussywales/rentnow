-- PropatyHub RLS and policies
-- Apply in Supabase SQL editor or via CLI (after updating auth session handling).
-- These policies align with the current app routes: public browsing of approved listings,
-- authenticated owners/admins manage their own records, and user-owned collections/messages.

-- Enable and enforce RLS on all exposed tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties FORCE ROW LEVEL SECURITY;

ALTER TABLE public.property_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_images FORCE ROW LEVEL SECURITY;

ALTER TABLE public.saved_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_properties FORCE ROW LEVEL SECURITY;

ALTER TABLE public.property_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_events FORCE ROW LEVEL SECURITY;

ALTER TABLE public.product_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_updates FORCE ROW LEVEL SECURITY;

ALTER TABLE public.product_update_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_update_reads FORCE ROW LEVEL SECURITY;

ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_searches FORCE ROW LEVEL SECURITY;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings FORCE ROW LEVEL SECURITY;

ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_documents FORCE ROW LEVEL SECURITY;

ALTER TABLE public.legal_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_acceptances FORCE ROW LEVEL SECURITY;

ALTER TABLE public.legal_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_versions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.listing_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_leads FORCE ROW LEVEL SECURITY;

ALTER TABLE public.property_share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_share_links FORCE ROW LEVEL SECURITY;

ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_requests FORCE ROW LEVEL SECURITY;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages FORCE ROW LEVEL SECURITY;

ALTER TABLE public.message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_threads FORCE ROW LEVEL SECURITY;

ALTER TABLE public.user_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_verifications FORCE ROW LEVEL SECURITY;

ALTER TABLE public.verification_otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_otps FORCE ROW LEVEL SECURITY;

ALTER TABLE public.viewing_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viewing_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE public.viewing_requests ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.property_availability_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_availability_rules FORCE ROW LEVEL SECURITY;

ALTER TABLE public.property_availability_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_availability_exceptions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.agent_delegations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_delegations FORCE ROW LEVEL SECURITY;

ALTER TABLE public.profile_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_plans FORCE ROW LEVEL SECURITY;

ALTER TABLE public.profile_billing_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_billing_notes FORCE ROW LEVEL SECURITY;

ALTER TABLE public.plan_upgrade_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_upgrade_requests FORCE ROW LEVEL SECURITY;

-- Helpers: admin role check
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

-- user_verifications: users manage their own rows; admins can read/write
DROP POLICY IF EXISTS "user verifications select self" ON public.user_verifications;
CREATE POLICY "user verifications select self" ON public.user_verifications
  FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "user verifications insert self" ON public.user_verifications;
CREATE POLICY "user verifications insert self" ON public.user_verifications
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user verifications update self" ON public.user_verifications;
CREATE POLICY "user verifications update self" ON public.user_verifications
  FOR UPDATE
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "user verifications admin read" ON public.user_verifications;
DROP POLICY IF EXISTS "user verifications admin write" ON public.user_verifications;

-- verification_otps: self-managed (server routes should be used)
DROP POLICY IF EXISTS "verification otps insert self" ON public.verification_otps;
CREATE POLICY "verification otps insert self" ON public.verification_otps
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "verification otps select self" ON public.verification_otps;
CREATE POLICY "verification otps select self" ON public.verification_otps
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "verification otps update self" ON public.verification_otps;
CREATE POLICY "verification otps update self" ON public.verification_otps
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- property_share_links: owners/admins
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

DROP POLICY IF EXISTS "property share links insert owner" ON public.property_share_links;
CREATE POLICY "property share links insert owner" ON public.property_share_links
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.properties p
      WHERE p.id = property_id
        AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "property share links update owner" ON public.property_share_links;
CREATE POLICY "property share links update owner" ON public.property_share_links
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.properties p
      WHERE p.id = property_id
        AND p.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.properties p
      WHERE p.id = property_id
        AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "property share links admin read" ON public.property_share_links;
DROP POLICY IF EXISTS "property share links admin write" ON public.property_share_links;
CREATE POLICY "property share links admin write" ON public.property_share_links
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- support_requests: allow inserts; admins can read
DROP POLICY IF EXISTS "support requests insert" ON public.support_requests;
CREATE POLICY "support requests insert" ON public.support_requests
  FOR INSERT
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

DROP POLICY IF EXISTS "support requests admin read" ON public.support_requests;
CREATE POLICY "support requests admin read" ON public.support_requests
  FOR SELECT
  USING (public.is_admin());

-- product_updates: published visibility per audience; admin can manage
DROP POLICY IF EXISTS "product updates select" ON public.product_updates;
CREATE POLICY "product updates select" ON public.product_updates
  FOR SELECT
  USING (
    published_at IS NOT NULL
    AND (
      audience = 'all'
      OR (
        audience = 'tenant'
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role = 'tenant'
        )
      )
      OR (
        audience = 'host'
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role IN ('landlord', 'agent')
        )
      )
      OR (
        audience = 'admin'
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role = 'admin'
        )
      )
    )
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "product updates insert admin" ON public.product_updates;
CREATE POLICY "product updates insert admin" ON public.product_updates
  FOR INSERT
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "product updates update admin" ON public.product_updates;
CREATE POLICY "product updates update admin" ON public.product_updates
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "product updates delete admin" ON public.product_updates;
CREATE POLICY "product updates delete admin" ON public.product_updates
  FOR DELETE
  USING (public.is_admin());

-- product_update_reads: user-owned read markers
DROP POLICY IF EXISTS "product update reads select self" ON public.product_update_reads;
CREATE POLICY "product update reads select self" ON public.product_update_reads
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "product update reads insert self" ON public.product_update_reads;
CREATE POLICY "product update reads insert self" ON public.product_update_reads
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "product update reads delete self" ON public.product_update_reads;
CREATE POLICY "product update reads delete self" ON public.product_update_reads
  FOR DELETE
  USING (auth.uid() = user_id);

-- profiles: users manage their own row
DROP POLICY IF EXISTS "profiles select self" ON public.profiles;
CREATE POLICY "profiles select self" ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles insert self" ON public.profiles;
CREATE POLICY "profiles insert self" ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles update self" ON public.profiles;
CREATE POLICY "profiles update self" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- storage: avatars bucket (public read, owner write)
DROP POLICY IF EXISTS "avatars public read" ON storage.objects;
CREATE POLICY "avatars public read" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars owner insert" ON storage.objects;
CREATE POLICY "avatars owner insert" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND owner = auth.uid());

DROP POLICY IF EXISTS "avatars owner update" ON storage.objects;
CREATE POLICY "avatars owner update" ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'avatars' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'avatars' AND owner = auth.uid());

DROP POLICY IF EXISTS "avatars owner delete" ON storage.objects;
CREATE POLICY "avatars owner delete" ON storage.objects
  FOR DELETE
  USING (bucket_id = 'avatars' AND owner = auth.uid());

-- app_settings: read-only flags/config for authenticated + anon
DROP POLICY IF EXISTS "app_settings_read" ON public.app_settings;
CREATE POLICY "app_settings_read" ON public.app_settings
  FOR SELECT
  TO authenticated, anon
  USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

DROP POLICY IF EXISTS "app_settings_no_mutation_auth" ON public.app_settings;
CREATE POLICY "app_settings_no_mutation_auth" ON public.app_settings
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- legal_documents: published read for all; admin full access
DROP POLICY IF EXISTS "legal documents published read" ON public.legal_documents;
CREATE POLICY "legal documents published read" ON public.legal_documents
  FOR SELECT
  TO authenticated, anon
  USING (status = 'published' AND (effective_at IS NULL OR effective_at <= now()));

DROP POLICY IF EXISTS "legal documents admin write" ON public.legal_documents;
CREATE POLICY "legal documents admin write" ON public.legal_documents
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- legal_acceptances: users manage their own; admins can read
DROP POLICY IF EXISTS "legal acceptances select self" ON public.legal_acceptances;
CREATE POLICY "legal acceptances select self" ON public.legal_acceptances
  FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "legal acceptances insert self" ON public.legal_acceptances;
CREATE POLICY "legal acceptances insert self" ON public.legal_acceptances
  FOR INSERT
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "legal acceptances update self" ON public.legal_acceptances;
CREATE POLICY "legal acceptances update self" ON public.legal_acceptances
  FOR UPDATE
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "legal acceptances admin read" ON public.legal_acceptances;

-- legal_versions: public read; admin write
DROP POLICY IF EXISTS "legal versions public read" ON public.legal_versions;
CREATE POLICY "legal versions public read" ON public.legal_versions
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "legal versions admin write" ON public.legal_versions;
CREATE POLICY "legal versions admin write" ON public.legal_versions
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- listing_leads: buyer/owner/admin read; buyer insert; owner/admin update
DROP POLICY IF EXISTS "listing_leads_select" ON public.listing_leads;
CREATE POLICY "listing_leads_select" ON public.listing_leads
  FOR SELECT
  USING (
    auth.uid() = buyer_id
    OR auth.uid() = owner_id
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "listing_leads_insert" ON public.listing_leads;
CREATE POLICY "listing_leads_insert" ON public.listing_leads
  FOR INSERT
  WITH CHECK (
    auth.uid() = buyer_id
    AND EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_id
        AND p.is_approved = TRUE
        AND p.is_active = TRUE
    )
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

-- agent_delegations: agents/landlords can see their delegations
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

-- profile_plans: users can read their own plan rows
DROP POLICY IF EXISTS "profile plans select self" ON public.profile_plans;
CREATE POLICY "profile plans select self" ON public.profile_plans
  FOR SELECT
  USING (auth.uid() = profile_id);

DROP POLICY IF EXISTS "profile plans insert self" ON public.profile_plans;
CREATE POLICY "profile plans insert self" ON public.profile_plans
  FOR INSERT
  WITH CHECK (
    auth.uid() = profile_id
    AND plan_tier = 'free'
    AND max_listings_override IS NULL
  );

-- profile_billing_notes: admin-only
DROP POLICY IF EXISTS "billing notes admin read" ON public.profile_billing_notes;
CREATE POLICY "billing notes admin read" ON public.profile_billing_notes
  FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "billing notes admin write" ON public.profile_billing_notes;
CREATE POLICY "billing notes admin write" ON public.profile_billing_notes
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- plan_upgrade_requests: users can request upgrades, admins can manage
DROP POLICY IF EXISTS "upgrade requests select self" ON public.plan_upgrade_requests;
CREATE POLICY "upgrade requests select self" ON public.plan_upgrade_requests
  FOR SELECT
  USING (
    auth.uid() = requester_id
    OR auth.uid() = profile_id
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "upgrade requests insert self" ON public.plan_upgrade_requests;
CREATE POLICY "upgrade requests insert self" ON public.plan_upgrade_requests
  FOR INSERT
  WITH CHECK (
    auth.uid() = requester_id
    AND status = 'pending'
    AND (
      profile_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.agent_delegations d
        WHERE d.agent_id = auth.uid()
          AND d.landlord_id = profile_id
          AND d.status = 'active'
      )
    )
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

-- properties: public can read approved/active; owners/admins can manage their own
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

DROP POLICY IF EXISTS "properties owner/admin read" ON public.properties;

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

-- availability rules/exceptions: owners only
DROP POLICY IF EXISTS "availability rules owner manage" ON public.property_availability_rules;
CREATE POLICY "availability rules owner manage" ON public.property_availability_rules
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_id
        AND p.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_id
        AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "availability exceptions owner manage" ON public.property_availability_exceptions;
CREATE POLICY "availability exceptions owner manage" ON public.property_availability_exceptions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_id
        AND p.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_id
        AND p.owner_id = auth.uid()
    )
  );

-- property_images: follow parent property permissions
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

DROP POLICY IF EXISTS "images owner/admin read" ON public.property_images;

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

-- property_videos: follow parent property permissions
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

-- saved_properties: user-owned favourites
DROP POLICY IF EXISTS "saved self select" ON public.saved_properties;
CREATE POLICY "saved self select" ON public.saved_properties
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "saved self insert" ON public.saved_properties;
CREATE POLICY "saved self insert" ON public.saved_properties
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "saved self delete" ON public.saved_properties;
CREATE POLICY "saved self delete" ON public.saved_properties
  FOR DELETE
  USING (auth.uid() = user_id);

-- property_events: admin-only raw access
DROP POLICY IF EXISTS "property events admin select" ON public.property_events;
CREATE POLICY "property events admin select" ON public.property_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- saved_searches: user-owned saved searches
DROP POLICY IF EXISTS "saved searches select self" ON public.saved_searches;
CREATE POLICY "saved searches select self" ON public.saved_searches
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "saved searches insert self" ON public.saved_searches;
CREATE POLICY "saved searches insert self" ON public.saved_searches
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "saved searches update self" ON public.saved_searches;
CREATE POLICY "saved searches update self" ON public.saved_searches
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "saved searches delete self" ON public.saved_searches;
CREATE POLICY "saved searches delete self" ON public.saved_searches
  FOR DELETE
  USING (auth.uid() = user_id);

-- messages: participants and admins can read; sender creates
DROP POLICY IF EXISTS "messages participant/owner read" ON public.messages;
CREATE POLICY "messages participant/owner read" ON public.messages
  FOR SELECT
  USING (
    auth.uid() = sender_id
    OR auth.uid() = recipient_id
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "messages sender insert" ON public.messages;
CREATE POLICY "messages sender insert" ON public.messages
  FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "messages recipient update read" ON public.messages;
CREATE POLICY "messages recipient update read" ON public.messages
  FOR UPDATE
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

-- message_threads: participants and admins can read; participants update
DROP POLICY IF EXISTS "message threads participant read" ON public.message_threads;
CREATE POLICY "message threads participant read" ON public.message_threads
  FOR SELECT
  USING (
    auth.uid() = tenant_id
    OR auth.uid() = host_id
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "message threads participant insert" ON public.message_threads;
CREATE POLICY "message threads participant insert" ON public.message_threads
  FOR INSERT
  WITH CHECK (auth.uid() = tenant_id OR auth.uid() = host_id);

DROP POLICY IF EXISTS "message threads participant update" ON public.message_threads;
CREATE POLICY "message threads participant update" ON public.message_threads
  FOR UPDATE
  USING (auth.uid() = tenant_id OR auth.uid() = host_id)
  WITH CHECK (auth.uid() = tenant_id OR auth.uid() = host_id);

-- message_thread_reads: participants read/update their own read state
DROP POLICY IF EXISTS "message thread reads self read" ON public.message_thread_reads;
CREATE POLICY "message thread reads self read" ON public.message_thread_reads
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "message thread reads self upsert" ON public.message_thread_reads;
CREATE POLICY "message thread reads self upsert" ON public.message_thread_reads
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "message thread reads self update" ON public.message_thread_reads;
CREATE POLICY "message thread reads self update" ON public.message_thread_reads
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- viewing_requests: tenants create/read their own
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

DROP POLICY IF EXISTS "viewings tenant insert" ON public.viewing_requests;
CREATE POLICY "viewings tenant insert" ON public.viewing_requests
  FOR INSERT
  WITH CHECK (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "viewings host select owned" ON public.viewing_requests;

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

CREATE OR REPLACE FUNCTION public.debug_rls_status()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  is_admin BOOLEAN;
  rls JSONB;
  policies JSONB;
  columns JSONB;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  ) INTO is_admin;

  IF NOT is_admin THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  rls := jsonb_build_object(
    'profiles', jsonb_build_object(
      'enabled', COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.profiles')), false),
      'forced', COALESCE((SELECT relforcerowsecurity FROM pg_class WHERE oid = to_regclass('public.profiles')), false)
    ),
    'properties', jsonb_build_object(
      'enabled', COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.properties')), false),
      'forced', COALESCE((SELECT relforcerowsecurity FROM pg_class WHERE oid = to_regclass('public.properties')), false)
    ),
    'property_images', jsonb_build_object(
      'enabled', COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.property_images')), false),
      'forced', COALESCE((SELECT relforcerowsecurity FROM pg_class WHERE oid = to_regclass('public.property_images')), false)
    ),
    'saved_properties', jsonb_build_object(
      'enabled', COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.saved_properties')), false),
      'forced', COALESCE((SELECT relforcerowsecurity FROM pg_class WHERE oid = to_regclass('public.saved_properties')), false)
    ),
    'property_events', jsonb_build_object(
      'enabled', COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.property_events')), false),
      'forced', COALESCE((SELECT relforcerowsecurity FROM pg_class WHERE oid = to_regclass('public.property_events')), false)
    ),
    'saved_searches', jsonb_build_object(
      'enabled', COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.saved_searches')), false),
      'forced', COALESCE((SELECT relforcerowsecurity FROM pg_class WHERE oid = to_regclass('public.saved_searches')), false)
    ),
    'messages', jsonb_build_object(
      'enabled', COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.messages')), false),
      'forced', COALESCE((SELECT relforcerowsecurity FROM pg_class WHERE oid = to_regclass('public.messages')), false)
    ),
    'viewing_requests', jsonb_build_object(
      'enabled', COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.viewing_requests')), false),
      'forced', COALESCE((SELECT relforcerowsecurity FROM pg_class WHERE oid = to_regclass('public.viewing_requests')), false)
    ),
    'agent_delegations', jsonb_build_object(
      'enabled', COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.agent_delegations')), false),
      'forced', COALESCE((SELECT relforcerowsecurity FROM pg_class WHERE oid = to_regclass('public.agent_delegations')), false)
    ),
    'profile_plans', jsonb_build_object(
      'enabled', COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.profile_plans')), false),
      'forced', COALESCE((SELECT relforcerowsecurity FROM pg_class WHERE oid = to_regclass('public.profile_plans')), false)
    ),
    'profile_billing_notes', jsonb_build_object(
      'enabled', COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.profile_billing_notes')), false),
      'forced', COALESCE((SELECT relforcerowsecurity FROM pg_class WHERE oid = to_regclass('public.profile_billing_notes')), false)
    ),
    'plan_upgrade_requests', jsonb_build_object(
      'enabled', COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.plan_upgrade_requests')), false),
      'forced', COALESCE((SELECT relforcerowsecurity FROM pg_class WHERE oid = to_regclass('public.plan_upgrade_requests')), false)
    )
  );

  policies := jsonb_build_object(
    'profiles', COALESCE(
      (SELECT jsonb_agg(policyname ORDER BY policyname)
       FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'profiles'),
      '[]'::jsonb
    ),
    'properties', COALESCE(
      (SELECT jsonb_agg(policyname ORDER BY policyname)
       FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'properties'),
      '[]'::jsonb
    ),
    'property_images', COALESCE(
      (SELECT jsonb_agg(policyname ORDER BY policyname)
       FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'property_images'),
      '[]'::jsonb
    ),
    'saved_properties', COALESCE(
      (SELECT jsonb_agg(policyname ORDER BY policyname)
       FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'saved_properties'),
      '[]'::jsonb
    ),
    'property_events', COALESCE(
      (SELECT jsonb_agg(policyname ORDER BY policyname)
       FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'property_events'),
      '[]'::jsonb
    ),
    'saved_searches', COALESCE(
      (SELECT jsonb_agg(policyname ORDER BY policyname)
       FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'saved_searches'),
      '[]'::jsonb
    ),
    'messages', COALESCE(
      (SELECT jsonb_agg(policyname ORDER BY policyname)
       FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'messages'),
      '[]'::jsonb
    ),
    'viewing_requests', COALESCE(
      (SELECT jsonb_agg(policyname ORDER BY policyname)
       FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'viewing_requests'),
      '[]'::jsonb
    ),
    'agent_delegations', COALESCE(
      (SELECT jsonb_agg(policyname ORDER BY policyname)
       FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'agent_delegations'),
      '[]'::jsonb
    ),
    'profile_plans', COALESCE(
      (SELECT jsonb_agg(policyname ORDER BY policyname)
       FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'profile_plans'),
      '[]'::jsonb
    ),
    'profile_billing_notes', COALESCE(
      (SELECT jsonb_agg(policyname ORDER BY policyname)
       FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'profile_billing_notes'),
      '[]'::jsonb
    ),
    'plan_upgrade_requests', COALESCE(
      (SELECT jsonb_agg(policyname ORDER BY policyname)
       FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'plan_upgrade_requests'),
      '[]'::jsonb
    )
  );

  columns := jsonb_build_object(
    'profiles', jsonb_build_object(
      'id', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'id'
      ),
      'role', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role'
      )
    ),
    'properties', jsonb_build_object(
      'owner_id', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'properties' AND column_name = 'owner_id'
      ),
      'is_approved', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'properties' AND column_name = 'is_approved'
      ),
      'is_active', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'properties' AND column_name = 'is_active'
      )
      ,
      'status', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'properties' AND column_name = 'status'
      ),
      'rejection_reason', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'properties' AND column_name = 'rejection_reason'
      )
    ),
    'property_images', jsonb_build_object(
      'property_id', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'property_images' AND column_name = 'property_id'
      ),
      'position', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'property_images' AND column_name = 'position'
      )
    ),
    'saved_properties', jsonb_build_object(
      'user_id', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'saved_properties' AND column_name = 'user_id'
      ),
      'property_id', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'saved_properties' AND column_name = 'property_id'
      )
    ),
    'property_events', jsonb_build_object(
      'property_id', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'property_events' AND column_name = 'property_id'
      ),
      'event_type', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'property_events' AND column_name = 'event_type'
      )
    ),
    'saved_searches', jsonb_build_object(
      'user_id', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'saved_searches' AND column_name = 'user_id'
      ),
      'query_params', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'saved_searches' AND column_name = 'query_params'
      )
    ),
    'messages', jsonb_build_object(
      'property_id', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'property_id'
      ),
      'sender_id', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'sender_id'
      ),
      'recipient_id', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'recipient_id'
      )
    ),
    'viewing_requests', jsonb_build_object(
      'property_id', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'viewing_requests' AND column_name = 'property_id'
      ),
      'tenant_id', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'viewing_requests' AND column_name = 'tenant_id'
      ),
      'status', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'viewing_requests' AND column_name = 'status'
      )
    ),
    'agent_delegations', jsonb_build_object(
      'agent_id', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'agent_delegations' AND column_name = 'agent_id'
      ),
      'landlord_id', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'agent_delegations' AND column_name = 'landlord_id'
      ),
      'status', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'agent_delegations' AND column_name = 'status'
      )
    ),
    'profile_plans', jsonb_build_object(
      'profile_id', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profile_plans' AND column_name = 'profile_id'
      ),
      'plan_tier', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profile_plans' AND column_name = 'plan_tier'
      ),
      'max_listings_override', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profile_plans' AND column_name = 'max_listings_override'
      ),
      'billing_source', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profile_plans' AND column_name = 'billing_source'
      ),
      'valid_until', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profile_plans' AND column_name = 'valid_until'
      ),
      'stripe_customer_id', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profile_plans' AND column_name = 'stripe_customer_id'
      ),
      'stripe_subscription_id', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profile_plans' AND column_name = 'stripe_subscription_id'
      ),
      'stripe_price_id', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profile_plans' AND column_name = 'stripe_price_id'
      ),
      'stripe_current_period_end', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profile_plans' AND column_name = 'stripe_current_period_end'
      ),
      'stripe_status', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profile_plans' AND column_name = 'stripe_status'
      )
    ),
    'profile_billing_notes', jsonb_build_object(
      'profile_id', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profile_billing_notes' AND column_name = 'profile_id'
      ),
      'billing_notes', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profile_billing_notes' AND column_name = 'billing_notes'
      )
    ),
    'plan_upgrade_requests', jsonb_build_object(
      'profile_id', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'plan_upgrade_requests' AND column_name = 'profile_id'
      ),
      'requester_id', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'plan_upgrade_requests' AND column_name = 'requester_id'
      ),
      'status', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'plan_upgrade_requests' AND column_name = 'status'
      )
    )
  );

  RETURN jsonb_build_object(
    'rls', rls,
    'policies', policies,
    'columns', columns
  );
END $$;

REVOKE ALL ON FUNCTION public.debug_rls_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.debug_rls_status() TO authenticated;

-- Lead notes + tags policies
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

-- Agent client pages v2 public select + curation policies
DROP POLICY IF EXISTS "agent_client_pages_public_select" ON public.agent_client_pages;
CREATE POLICY "agent_client_pages_public_select"
  ON public.agent_client_pages
  FOR SELECT
  USING (
    published is true
    AND (expires_at is null OR expires_at > now())
    AND EXISTS (
      SELECT 1
      FROM public.agent_storefronts s
      WHERE s.user_id = agent_user_id
        AND s.enabled is true
    )
    AND COALESCE(
      (
        SELECT
          COALESCE(
            CASE
              WHEN jsonb_typeof(value) = 'object' AND value ? 'enabled' THEN (value->>'enabled')::boolean
            END,
            CASE WHEN jsonb_typeof(value) = 'boolean' THEN (value::text)::boolean END,
            true
          )
        FROM public.app_settings
        WHERE key = 'agent_storefronts_enabled'
        LIMIT 1
      ),
      true
    )
  );

DROP POLICY IF EXISTS "agent_client_page_listings_public_select" ON public.agent_client_page_listings;
CREATE POLICY "agent_client_page_listings_public_select"
  ON public.agent_client_page_listings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.agent_client_pages p
      WHERE p.id = client_page_id
        AND p.published is true
        AND (p.expires_at is null OR p.expires_at > now())
        AND EXISTS (
          SELECT 1
          FROM public.agent_storefronts s
          WHERE s.user_id = p.agent_user_id
            AND s.enabled is true
        )
        AND COALESCE(
          (
            SELECT
              COALESCE(
                CASE
                  WHEN jsonb_typeof(value) = 'object' AND value ? 'enabled' THEN (value->>'enabled')::boolean
                END,
                CASE WHEN jsonb_typeof(value) = 'boolean' THEN (value::text)::boolean END,
                true
              )
            FROM public.app_settings
            WHERE key = 'agent_storefronts_enabled'
            LIMIT 1
          ),
          true
        )
    )
  );

DROP POLICY IF EXISTS "agent_client_page_listings_owner_select" ON public.agent_client_page_listings;
CREATE POLICY "agent_client_page_listings_owner_select"
  ON public.agent_client_page_listings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.agent_client_pages p
      WHERE p.id = client_page_id AND p.agent_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "agent_client_page_listings_owner_insert" ON public.agent_client_page_listings;
CREATE POLICY "agent_client_page_listings_owner_insert"
  ON public.agent_client_page_listings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.agent_client_pages p
      WHERE p.id = client_page_id AND p.agent_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "agent_client_page_listings_owner_update" ON public.agent_client_page_listings;
CREATE POLICY "agent_client_page_listings_owner_update"
  ON public.agent_client_page_listings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.agent_client_pages p
      WHERE p.id = client_page_id AND p.agent_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.agent_client_pages p
      WHERE p.id = client_page_id AND p.agent_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "agent_client_page_listings_owner_delete" ON public.agent_client_page_listings;
CREATE POLICY "agent_client_page_listings_owner_delete"
  ON public.agent_client_page_listings
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.agent_client_pages p
      WHERE p.id = client_page_id AND p.agent_user_id = auth.uid()
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

-- AGENT LISTING SHARES
DROP POLICY IF EXISTS "agent listing shares presenting select" ON public.agent_listing_shares;
CREATE POLICY "agent listing shares presenting select"
  ON public.agent_listing_shares
  FOR SELECT
  USING (
    presenting_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.agent_client_pages p
      WHERE p.id = client_page_id AND p.agent_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "agent listing shares presenting insert" ON public.agent_listing_shares;
CREATE POLICY "agent listing shares presenting insert"
  ON public.agent_listing_shares
  FOR INSERT
  WITH CHECK (
    presenting_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.agent_client_pages p
      WHERE p.id = client_page_id AND p.agent_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "agent listing shares presenting delete" ON public.agent_listing_shares;
CREATE POLICY "agent listing shares presenting delete"
  ON public.agent_listing_shares
  FOR DELETE
  USING (
    presenting_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.agent_client_pages p
      WHERE p.id = client_page_id AND p.agent_user_id = auth.uid()
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

ALTER TABLE public.agent_commission_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_commission_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent commission agreements select" ON public.agent_commission_agreements;
CREATE POLICY "agent commission agreements select"
  ON public.agent_commission_agreements
  FOR SELECT
  USING (
    owner_agent_id = auth.uid()
    OR presenting_agent_id = auth.uid()
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "agent commission agreements insert" ON public.agent_commission_agreements;
CREATE POLICY "agent commission agreements insert"
  ON public.agent_commission_agreements
  FOR INSERT
  WITH CHECK (
    presenting_agent_id = auth.uid()
  );

DROP POLICY IF EXISTS "agent commission agreements update" ON public.agent_commission_agreements;
CREATE POLICY "agent commission agreements update"
  ON public.agent_commission_agreements
  FOR UPDATE
  USING (
    owner_agent_id = auth.uid()
  )
  WITH CHECK (
    owner_agent_id = auth.uid()
  );

DROP POLICY IF EXISTS "agent commission agreements delete" ON public.agent_commission_agreements;
CREATE POLICY "agent commission agreements delete"
  ON public.agent_commission_agreements
  FOR DELETE
  USING (
    owner_agent_id = auth.uid()
  );

DROP POLICY IF EXISTS "agent commission events select" ON public.agent_commission_events;
CREATE POLICY "agent commission events select"
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

DROP POLICY IF EXISTS "agent commission events insert" ON public.agent_commission_events;
CREATE POLICY "agent commission events insert"
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

-- AGENT ONBOARDING PROGRESS
DROP POLICY IF EXISTS "agent onboarding progress owner select" ON public.agent_onboarding_progress;
CREATE POLICY "agent onboarding progress owner select"
  ON public.agent_onboarding_progress
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "agent onboarding progress owner insert" ON public.agent_onboarding_progress;
CREATE POLICY "agent onboarding progress owner insert"
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

-- LEAD ATTRIBUTIONS
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

-- PAYG listing fees + credits
DROP POLICY IF EXISTS "plans public read" ON public.plans;
CREATE POLICY "plans public read"
  ON public.plans
  FOR SELECT
  USING (is_active = TRUE OR public.is_admin());

DROP POLICY IF EXISTS "plans admin write" ON public.plans;
CREATE POLICY "plans admin write"
  ON public.plans
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "listing credits owner select" ON public.listing_credits;
CREATE POLICY "listing credits owner select"
  ON public.listing_credits
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "listing credits admin select" ON public.listing_credits;
CREATE POLICY "listing credits admin select"
  ON public.listing_credits
  FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "listing credits service write" ON public.listing_credits;
CREATE POLICY "listing credits service write"
  ON public.listing_credits
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "listing credits admin write" ON public.listing_credits;
CREATE POLICY "listing credits admin write"
  ON public.listing_credits
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "listing credit consumptions owner select" ON public.listing_credit_consumptions;
CREATE POLICY "listing credit consumptions owner select"
  ON public.listing_credit_consumptions
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "listing credit consumptions admin select" ON public.listing_credit_consumptions;
CREATE POLICY "listing credit consumptions admin select"
  ON public.listing_credit_consumptions
  FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "listing credit consumptions service write" ON public.listing_credit_consumptions;
CREATE POLICY "listing credit consumptions service write"
  ON public.listing_credit_consumptions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "listing credit consumptions admin write" ON public.listing_credit_consumptions;
CREATE POLICY "listing credit consumptions admin write"
  ON public.listing_credit_consumptions
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "listing payments owner select" ON public.listing_payments;
CREATE POLICY "listing payments owner select"
  ON public.listing_payments
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "listing payments admin select" ON public.listing_payments;
CREATE POLICY "listing payments admin select"
  ON public.listing_payments
  FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "listing payments service write" ON public.listing_payments;
CREATE POLICY "listing payments service write"
  ON public.listing_payments
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "listing payments admin write" ON public.listing_payments;
CREATE POLICY "listing payments admin write"
  ON public.listing_payments
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "promo codes admin select" ON public.promo_codes;
CREATE POLICY "promo codes admin select"
  ON public.promo_codes
  FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "promo codes admin write" ON public.promo_codes;
CREATE POLICY "promo codes admin write"
  ON public.promo_codes
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.subscription_credit_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_credit_issues FORCE ROW LEVEL SECURITY;

ALTER TABLE public.featured_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.featured_credits FORCE ROW LEVEL SECURITY;

ALTER TABLE public.featured_credit_consumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.featured_credit_consumptions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.feature_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_purchases FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscriptions owner select" ON public.subscriptions;
CREATE POLICY "subscriptions owner select"
  ON public.subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "subscriptions admin select" ON public.subscriptions;
CREATE POLICY "subscriptions admin select"
  ON public.subscriptions
  FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "subscriptions service write" ON public.subscriptions;
CREATE POLICY "subscriptions service write"
  ON public.subscriptions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "subscription credit issues admin select" ON public.subscription_credit_issues;
CREATE POLICY "subscription credit issues admin select"
  ON public.subscription_credit_issues
  FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "subscription credit issues service write" ON public.subscription_credit_issues;
CREATE POLICY "subscription credit issues service write"
  ON public.subscription_credit_issues
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "featured credits owner select" ON public.featured_credits;
CREATE POLICY "featured credits owner select"
  ON public.featured_credits
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "featured credits admin select" ON public.featured_credits;
CREATE POLICY "featured credits admin select"
  ON public.featured_credits
  FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "featured credits service write" ON public.featured_credits;
CREATE POLICY "featured credits service write"
  ON public.featured_credits
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "featured credit consumptions owner select" ON public.featured_credit_consumptions;
CREATE POLICY "featured credit consumptions owner select"
  ON public.featured_credit_consumptions
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "featured credit consumptions admin select" ON public.featured_credit_consumptions;
CREATE POLICY "featured credit consumptions admin select"
  ON public.featured_credit_consumptions
  FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "featured credit consumptions service write" ON public.featured_credit_consumptions;
CREATE POLICY "featured credit consumptions service write"
  ON public.featured_credit_consumptions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "feature purchases owner select" ON public.feature_purchases;
CREATE POLICY "feature purchases owner select"
  ON public.feature_purchases
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "feature purchases admin select" ON public.feature_purchases;
CREATE POLICY "feature purchases admin select"
  ON public.feature_purchases
  FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "feature purchases service write" ON public.feature_purchases;
CREATE POLICY "feature purchases service write"
  ON public.feature_purchases
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
