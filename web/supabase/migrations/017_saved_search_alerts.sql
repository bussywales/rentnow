-- Saved search alerts audit table + RLS (idempotent).

CREATE TABLE IF NOT EXISTS public.saved_search_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  saved_search_id UUID NOT NULL REFERENCES public.saved_searches (id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'email',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  error TEXT
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'saved_search_alerts_status_check'
      AND conrelid = 'public.saved_search_alerts'::regclass
  ) THEN
    ALTER TABLE public.saved_search_alerts
      ADD CONSTRAINT saved_search_alerts_status_check
      CHECK (status IN ('pending', 'sent', 'skipped', 'failed'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'saved_search_alerts_unique'
      AND conrelid = 'public.saved_search_alerts'::regclass
  ) THEN
    ALTER TABLE public.saved_search_alerts
      ADD CONSTRAINT saved_search_alerts_unique
      UNIQUE (saved_search_id, property_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_saved_search_alerts_user
  ON public.saved_search_alerts (user_id);

CREATE INDEX IF NOT EXISTS idx_saved_search_alerts_property
  ON public.saved_search_alerts (property_id);

CREATE INDEX IF NOT EXISTS idx_saved_search_alerts_search
  ON public.saved_search_alerts (saved_search_id);

ALTER TABLE public.saved_search_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_search_alerts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saved search alerts select self" ON public.saved_search_alerts;
CREATE POLICY "saved search alerts select self" ON public.saved_search_alerts
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "saved search alerts admin read" ON public.saved_search_alerts;
CREATE POLICY "saved search alerts admin read" ON public.saved_search_alerts
  FOR SELECT
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
    'saved_search_alerts', jsonb_build_object(
      'enabled', COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.saved_search_alerts')), false),
      'forced', COALESCE((SELECT relforcerowsecurity FROM pg_class WHERE oid = to_regclass('public.saved_search_alerts')), false)
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
    'saved_search_alerts', COALESCE(
      (SELECT jsonb_agg(policyname ORDER BY policyname)
       FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'saved_search_alerts'),
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
    'saved_search_alerts', jsonb_build_object(
      'user_id', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'saved_search_alerts' AND column_name = 'user_id'
      ),
      'saved_search_id', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'saved_search_alerts' AND column_name = 'saved_search_id'
      ),
      'property_id', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'saved_search_alerts' AND column_name = 'property_id'
      ),
      'status', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'saved_search_alerts' AND column_name = 'status'
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
