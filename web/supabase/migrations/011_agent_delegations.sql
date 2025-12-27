-- Agent delegation model for acting-as workflows (idempotent).

CREATE TABLE IF NOT EXISTS public.agent_delegations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  landlord_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'agent_delegations_agent_landlord_unique'
      AND conrelid = 'public.agent_delegations'::regclass
  ) THEN
    ALTER TABLE public.agent_delegations
      ADD CONSTRAINT agent_delegations_agent_landlord_unique
      UNIQUE (agent_id, landlord_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'agent_delegations_status_check'
      AND conrelid = 'public.agent_delegations'::regclass
  ) THEN
    ALTER TABLE public.agent_delegations
      ADD CONSTRAINT agent_delegations_status_check
      CHECK (status IN ('pending', 'active', 'revoked'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_agent_delegations_agent_status
  ON public.agent_delegations (agent_id, status);

CREATE INDEX IF NOT EXISTS idx_agent_delegations_landlord_status
  ON public.agent_delegations (landlord_id, status);

ALTER TABLE public.agent_delegations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_delegations FORCE ROW LEVEL SECURITY;

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

-- Update property policies to allow delegated agents.
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

-- Update property_images policies to allow delegated agents.
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

-- Update debug metadata helper to include agent_delegations.
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
