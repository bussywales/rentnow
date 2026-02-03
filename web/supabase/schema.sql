-- PROPATYHUB schema (Supabase / Postgres)

-- ENUMS
CREATE TYPE user_role AS ENUM ('tenant', 'landlord', 'agent', 'admin');
CREATE TYPE rental_type AS ENUM ('short_let', 'long_term');
CREATE TYPE viewing_status AS ENUM ('pending', 'accepted', 'declined', 'cancelled');
CREATE TYPE property_status AS ENUM ('draft', 'pending', 'live', 'expired', 'rejected', 'paused', 'paused_owner', 'paused_occupied', 'changes_requested');

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'tenant',
  full_name TEXT,
  phone TEXT,
  city TEXT,
  avatar_url TEXT,
  business_name TEXT,
  preferred_contact TEXT,
  areas_served TEXT[],
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
  listing_type TEXT,
  listing_intent TEXT NOT NULL DEFAULT 'rent',
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
  status property_status NOT NULL DEFAULT 'draft',
  rejection_reason TEXT,
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  paused_reason TEXT,
  reactivated_at TIMESTAMPTZ,
  status_updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
  renewed_at TIMESTAMPTZ,
  bills_included BOOLEAN NOT NULL DEFAULT FALSE,
  epc_rating TEXT,
  council_tax_band TEXT,
  features TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_properties_city ON public.properties (city);
CREATE INDEX idx_properties_rental_type ON public.properties (rental_type);
CREATE INDEX idx_properties_price ON public.properties (price);
CREATE INDEX idx_properties_owner ON public.properties (owner_id);
CREATE INDEX idx_properties_status ON public.properties (status);
CREATE INDEX idx_properties_owner_status ON public.properties (owner_id, status);
CREATE INDEX idx_properties_status_updated_at ON public.properties (status, updated_at);

-- PROPERTY IMAGES
CREATE TABLE public.property_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0,
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
CREATE INDEX idx_saved_properties_property_id ON public.saved_properties (property_id);

-- MESSAGES
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  thread_id UUID REFERENCES public.message_threads (id) ON DELETE SET NULL,
  sender_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  sender_role TEXT,
  read_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_property ON public.messages (property_id);
CREATE INDEX idx_messages_participants ON public.messages (sender_id, recipient_id);
CREATE INDEX idx_messages_thread ON public.messages (thread_id, created_at desc);
CREATE INDEX idx_messages_recipient_id ON public.messages (recipient_id);

-- MESSAGE THREADS
CREATE TABLE public.message_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  host_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  subject TEXT,
  last_post_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (property_id, tenant_id, host_id)
);

CREATE INDEX idx_message_threads_property ON public.message_threads (property_id);
CREATE INDEX idx_message_threads_host ON public.message_threads (host_id, last_post_at desc);
CREATE INDEX idx_message_threads_tenant ON public.message_threads (tenant_id, last_post_at desc);

-- MESSAGE THREAD READS
CREATE TABLE public.message_thread_reads (
  thread_id UUID NOT NULL REFERENCES public.message_threads (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (thread_id, user_id)
);

CREATE INDEX idx_message_thread_reads_user ON public.message_thread_reads (user_id);
CREATE INDEX idx_message_thread_reads_thread ON public.message_thread_reads (thread_id);

-- USER VERIFICATIONS
CREATE TABLE public.user_verifications (
  user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email_verified_at TIMESTAMPTZ,
  phone_e164 TEXT,
  phone_verified_at TIMESTAMPTZ,
  bank_verified_at TIMESTAMPTZ,
  bank_provider TEXT,
  bank_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_verifications_updated_at ON public.user_verifications (updated_at DESC);

-- VERIFICATION OTPS
CREATE TABLE public.verification_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('phone_email_fallback')),
  target TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_verification_otps_user ON public.verification_otps (user_id, created_at DESC);
CREATE INDEX idx_verification_otps_target ON public.verification_otps (target, created_at DESC);

-- APP SETTINGS
CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- LEGAL DOCUMENTS
CREATE TABLE public.legal_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction TEXT NOT NULL,
  audience TEXT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft',
  title TEXT NOT NULL,
  content_md TEXT NOT NULL,
  effective_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  published_by UUID REFERENCES public.profiles (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  change_log TEXT,
  CONSTRAINT legal_documents_status_check CHECK (status IN ('draft', 'published', 'archived')),
  CONSTRAINT legal_documents_audience_check CHECK (audience IN ('MASTER', 'TENANT', 'LANDLORD_AGENT', 'ADMIN_OPS', 'AUP'))
);

CREATE UNIQUE INDEX legal_documents_unique_version ON public.legal_documents (jurisdiction, audience, version);
CREATE UNIQUE INDEX legal_documents_published_unique ON public.legal_documents (jurisdiction, audience)
  WHERE status = 'published';
CREATE INDEX legal_documents_status_idx ON public.legal_documents (jurisdiction, audience, status, version desc);
CREATE INDEX idx_legal_documents_published_by ON public.legal_documents (published_by);

-- LEGAL ACCEPTANCES
CREATE TABLE public.legal_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.legal_documents (id) ON DELETE CASCADE,
  jurisdiction TEXT NOT NULL,
  audience TEXT NOT NULL,
  version INT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip TEXT,
  user_agent TEXT,
  CONSTRAINT legal_acceptances_audience_check CHECK (audience IN ('MASTER', 'TENANT', 'LANDLORD_AGENT', 'ADMIN_OPS', 'AUP'))
);

CREATE UNIQUE INDEX legal_acceptances_unique_user_doc ON public.legal_acceptances (user_id, jurisdiction, audience, version);
CREATE INDEX legal_acceptances_user_idx ON public.legal_acceptances (user_id, accepted_at desc);
CREATE INDEX idx_legal_acceptances_document_id ON public.legal_acceptances (document_id);

-- LISTING LEADS
CREATE TABLE public.listing_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  thread_id UUID REFERENCES public.message_threads (id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'NEW',
  intent TEXT NOT NULL DEFAULT 'BUY',
  budget_min NUMERIC,
  budget_max NUMERIC,
  financing_status TEXT,
  timeline TEXT,
  message TEXT NOT NULL,
  message_original TEXT,
  contact_exchange_flags JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_listing_leads_property ON public.listing_leads (property_id);
CREATE INDEX idx_listing_leads_owner ON public.listing_leads (owner_id, created_at desc);
CREATE INDEX idx_listing_leads_buyer ON public.listing_leads (buyer_id, created_at desc);
CREATE INDEX idx_listing_leads_status ON public.listing_leads (status);
CREATE INDEX idx_listing_leads_thread_id ON public.listing_leads (thread_id);

-- PROPERTY SHARE LINKS
CREATE TABLE public.property_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  rotated_from UUID REFERENCES public.property_share_links (id)
);

CREATE INDEX property_share_links_property_idx ON public.property_share_links (property_id, created_at desc);
CREATE INDEX property_share_links_token_idx ON public.property_share_links (token);
CREATE INDEX property_share_links_created_by_idx ON public.property_share_links (created_by, created_at desc);
CREATE INDEX idx_property_share_links_rotated_from ON public.property_share_links (rotated_from);

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

-- SUPPORT REQUESTS
CREATE TABLE public.support_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'general',
  email TEXT,
  name TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX support_requests_created_at_idx ON public.support_requests (created_at desc);
CREATE INDEX support_requests_status_idx ON public.support_requests (status, created_at desc);
CREATE INDEX idx_support_requests_user_id ON public.support_requests (user_id);

-- SAVED SEARCHES
CREATE TABLE public.saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  query_params JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_notified_at TIMESTAMPTZ,
  last_checked_at TIMESTAMPTZ
);

CREATE INDEX idx_saved_searches_user ON public.saved_searches (user_id);

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
