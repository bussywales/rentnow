-- RentNow RLS and policies
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

ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_searches FORCE ROW LEVEL SECURITY;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages FORCE ROW LEVEL SECURITY;

ALTER TABLE public.viewing_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viewing_requests FORCE ROW LEVEL SECURITY;

ALTER TABLE public.agent_delegations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_delegations FORCE ROW LEVEL SECURITY;

ALTER TABLE public.profile_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_plans FORCE ROW LEVEL SECURITY;

ALTER TABLE public.profile_billing_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_billing_notes FORCE ROW LEVEL SECURITY;

ALTER TABLE public.plan_upgrade_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_upgrade_requests FORCE ROW LEVEL SECURITY;

-- Helpers (inline): is_admin checks the caller's profile role
-- EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')

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

-- agent_delegations: agents/landlords can see their delegations
DROP POLICY IF EXISTS "agent delegations select" ON public.agent_delegations;
CREATE POLICY "agent delegations select" ON public.agent_delegations
  FOR SELECT
  USING (
    auth.uid() = agent_id
    OR auth.uid() = landlord_id
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
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
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "agent delegations update" ON public.agent_delegations;
CREATE POLICY "agent delegations update" ON public.agent_delegations
  FOR UPDATE
  USING (
    auth.uid() = landlord_id
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    auth.uid() = landlord_id
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "agent delegations delete" ON public.agent_delegations;
CREATE POLICY "agent delegations delete" ON public.agent_delegations
  FOR DELETE
  USING (
    auth.uid() = agent_id
    OR auth.uid() = landlord_id
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
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
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "billing notes admin write" ON public.profile_billing_notes;
CREATE POLICY "billing notes admin write" ON public.profile_billing_notes
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- plan_upgrade_requests: users can request upgrades, admins can manage
DROP POLICY IF EXISTS "upgrade requests select self" ON public.plan_upgrade_requests;
CREATE POLICY "upgrade requests select self" ON public.plan_upgrade_requests
  FOR SELECT
  USING (
    auth.uid() = requester_id
    OR auth.uid() = profile_id
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
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
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "upgrade requests delete admin" ON public.plan_upgrade_requests;
CREATE POLICY "upgrade requests delete admin" ON public.plan_upgrade_requests
  FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- properties: public can read approved/active; owners/admins can manage their own
DROP POLICY IF EXISTS "properties public read" ON public.properties;
CREATE POLICY "properties public read" ON public.properties
  FOR SELECT
  USING (is_approved = TRUE AND is_active = TRUE);

DROP POLICY IF EXISTS "properties owner/admin read" ON public.properties;
CREATE POLICY "properties owner/admin read" ON public.properties
  FOR SELECT
  USING (
    auth.uid() = owner_id
    OR EXISTS (
      SELECT 1 FROM public.agent_delegations d
      WHERE d.agent_id = auth.uid()
        AND d.landlord_id = owner_id
        AND d.status = 'active'
    )
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
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
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
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
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    auth.uid() = owner_id
    OR EXISTS (
      SELECT 1 FROM public.agent_delegations d
      WHERE d.agent_id = auth.uid()
        AND d.landlord_id = owner_id
        AND d.status = 'active'
    )
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
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
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
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
  );

DROP POLICY IF EXISTS "images owner/admin read" ON public.property_images;
CREATE POLICY "images owner/admin read" ON public.property_images
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
          OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
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
          OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
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
          OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
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
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "messages sender insert" ON public.messages;
CREATE POLICY "messages sender insert" ON public.messages
  FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- viewing_requests: tenants create/read their own
DROP POLICY IF EXISTS "viewings tenant select" ON public.viewing_requests;
CREATE POLICY "viewings tenant select" ON public.viewing_requests
  FOR SELECT
  USING (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "viewings tenant insert" ON public.viewing_requests;
CREATE POLICY "viewings tenant insert" ON public.viewing_requests
  FOR INSERT
  WITH CHECK (auth.uid() = tenant_id);

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
