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

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages FORCE ROW LEVEL SECURITY;

ALTER TABLE public.viewing_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viewing_requests FORCE ROW LEVEL SECURITY;

-- Helpers (inline): is_admin checks the caller's profile role
-- EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')

-- profiles: users manage their own row
DROP POLICY IF EXISTS "profiles select self" ON public.profiles;
CREATE POLICY "profiles select self" ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles admin read" ON public.profiles;
CREATE POLICY "profiles admin read" ON public.profiles
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "profiles insert self" ON public.profiles;
CREATE POLICY "profiles insert self" ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles update self" ON public.profiles;
CREATE POLICY "profiles update self" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

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
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "properties owner/admin insert" ON public.properties;
CREATE POLICY "properties owner/admin insert" ON public.properties
  FOR INSERT
  WITH CHECK (
    auth.uid() = owner_id
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "properties owner/admin update" ON public.properties;
CREATE POLICY "properties owner/admin update" ON public.properties
  FOR UPDATE
  USING (
    auth.uid() = owner_id
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    auth.uid() = owner_id
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "properties owner/admin delete" ON public.properties;
CREATE POLICY "properties owner/admin delete" ON public.properties
  FOR DELETE
  USING (
    auth.uid() = owner_id
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

-- viewing_requests: tenants create; tenants, owners, admins can read/update
DROP POLICY IF EXISTS "viewings tenant/owner read" ON public.viewing_requests;
CREATE POLICY "viewings tenant/owner read" ON public.viewing_requests
  FOR SELECT
  USING (
    auth.uid() = tenant_id
    OR EXISTS (
      SELECT 1 FROM public.properties pr
      WHERE pr.id = property_id AND pr.owner_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "viewings tenant insert" ON public.viewing_requests;
CREATE POLICY "viewings tenant insert" ON public.viewing_requests
  FOR INSERT
  WITH CHECK (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "viewings tenant/owner update" ON public.viewing_requests;
CREATE POLICY "viewings tenant/owner update" ON public.viewing_requests
  FOR UPDATE
  USING (
    auth.uid() = tenant_id
    OR EXISTS (
      SELECT 1 FROM public.properties pr
      WHERE pr.id = property_id AND pr.owner_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    auth.uid() = tenant_id
    OR EXISTS (
      SELECT 1 FROM public.properties pr
      WHERE pr.id = property_id AND pr.owner_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );
