-- Manual billing fields and upgrade requests (idempotent).

ALTER TABLE public.profile_plans
  ADD COLUMN IF NOT EXISTS billing_source TEXT,
  ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS upgraded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS upgraded_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL;

ALTER TABLE public.profile_plans
  ALTER COLUMN billing_source SET DEFAULT 'manual';

UPDATE public.profile_plans
SET billing_source = 'manual'
WHERE billing_source IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profile_plans'
      AND column_name = 'billing_source'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE public.profile_plans
      ALTER COLUMN billing_source SET NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profile_plans_billing_source_check'
      AND conrelid = 'public.profile_plans'::regclass
  ) THEN
    ALTER TABLE public.profile_plans
      ADD CONSTRAINT profile_plans_billing_source_check
      CHECK (billing_source IN ('manual', 'stripe', 'paystack'));
  END IF;
END $$;

-- Admin-only billing notes.
CREATE TABLE IF NOT EXISTS public.profile_billing_notes (
  profile_id UUID PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  billing_notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL
);

ALTER TABLE public.profile_billing_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_billing_notes FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "billing notes admin read" ON public.profile_billing_notes;
CREATE POLICY "billing notes admin read" ON public.profile_billing_notes
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "billing notes admin write" ON public.profile_billing_notes;
CREATE POLICY "billing notes admin write" ON public.profile_billing_notes
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Upgrade requests table.
CREATE TABLE IF NOT EXISTS public.plan_upgrade_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  requested_plan_tier TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'plan_upgrade_requests_status_check'
      AND conrelid = 'public.plan_upgrade_requests'::regclass
  ) THEN
    ALTER TABLE public.plan_upgrade_requests
      ADD CONSTRAINT plan_upgrade_requests_status_check
      CHECK (status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_plan_upgrade_requests_profile_status
  ON public.plan_upgrade_requests (profile_id, status);

CREATE INDEX IF NOT EXISTS idx_plan_upgrade_requests_requester_status
  ON public.plan_upgrade_requests (requester_id, status);

ALTER TABLE public.plan_upgrade_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_upgrade_requests FORCE ROW LEVEL SECURITY;

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
      ),
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
