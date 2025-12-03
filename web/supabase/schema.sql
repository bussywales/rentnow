-- RENTNOW schema (Supabase / Postgres)

-- ENUMS
CREATE TYPE user_role AS ENUM ('tenant', 'landlord', 'agent', 'admin');
CREATE TYPE rental_type AS ENUM ('short_let', 'long_term');
CREATE TYPE viewing_status AS ENUM ('pending', 'accepted', 'declined', 'cancelled');

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'tenant',
  full_name TEXT,
  phone TEXT,
  city TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PROPERTIES
CREATE TABLE public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  city TEXT NOT NULL,
  neighbourhood TEXT,
  address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  rental_type rental_type NOT NULL,
  price NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  bedrooms INT NOT NULL DEFAULT 0,
  bathrooms INT NOT NULL DEFAULT 0,
  furnished BOOLEAN NOT NULL DEFAULT FALSE,
  amenities JSONB DEFAULT '[]'::jsonb,
  available_from DATE,
  max_guests INT,
  is_approved BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_properties_city ON public.properties (city);
CREATE INDEX idx_properties_rental_type ON public.properties (rental_type);
CREATE INDEX idx_properties_price ON public.properties (price);
CREATE INDEX idx_properties_owner ON public.properties (owner_id);

-- PROPERTY IMAGES
CREATE TABLE public.property_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_property_images_property ON public.property_images (property_id);

-- SAVED PROPERTIES
CREATE TABLE public.saved_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, property_id)
);

CREATE INDEX idx_saved_properties_user ON public.saved_properties (user_id);

-- MESSAGES
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_property ON public.messages (property_id);
CREATE INDEX idx_messages_participants ON public.messages (sender_id, recipient_id);

-- VIEWING REQUESTS
CREATE TABLE public.viewing_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  preferred_date DATE NOT NULL,
  preferred_time_window TEXT,
  note TEXT,
  status viewing_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_viewing_requests_property ON public.viewing_requests (property_id);
CREATE INDEX idx_viewing_requests_tenant ON public.viewing_requests (tenant_id);

-- BASIC RLS SUGGESTIONS
-- Enable RLS on tables:
-- ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.property_images ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.saved_properties ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.viewing_requests ENABLE ROW LEVEL SECURITY;

-- Example policies (adapt in Supabase dashboard):
-- Profiles: users can manage their own record
-- CREATE POLICY "profiles self access" ON public.profiles
--   FOR SELECT USING (auth.uid() = id)
--   WITH CHECK (auth.uid() = id);

-- Properties: owners manage their listings; public can read approved ones
-- CREATE POLICY "properties public read" ON public.properties
--   FOR SELECT USING (is_approved = TRUE);
-- CREATE POLICY "properties owner crud" ON public.properties
--   FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Property images follow parent permissions
-- CREATE POLICY "images owner crud" ON public.property_images
--   FOR ALL USING (
--     auth.uid() = (SELECT owner_id FROM public.properties WHERE id = property_id)
--   );

-- Saved properties: users manage their own saved list
-- CREATE POLICY "saved self" ON public.saved_properties
--   FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Messages: participants can read; senders can insert
-- CREATE POLICY "messages participant read" ON public.messages
--   FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
-- CREATE POLICY "messages send" ON public.messages
--   FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Viewing requests: tenants create and view theirs; owners can see requests on their properties
-- CREATE POLICY "viewings tenant" ON public.viewing_requests
--   FOR ALL USING (auth.uid() = tenant_id) WITH CHECK (auth.uid() = tenant_id);
-- CREATE POLICY "viewings owner read" ON public.viewing_requests
--   FOR SELECT USING (
--     auth.uid() IN (SELECT owner_id FROM public.properties WHERE id = property_id)
--   );
