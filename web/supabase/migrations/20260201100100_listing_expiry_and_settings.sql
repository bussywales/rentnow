-- Listing expiry + renewal settings

-- Expiry tracking columns
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS expired_at timestamptz,
  ADD COLUMN IF NOT EXISTS renewed_at timestamptz;

-- App settings for expiry configuration
INSERT INTO public.app_settings(key, value)
VALUES ('listing_expiry_days', '{"days": 90}'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_settings(key, value)
VALUES ('show_expired_listings_public', '{"enabled": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Backfill expires_at for existing live listings
DO $$
DECLARE
  expiry_days int := 90;
BEGIN
  SELECT NULLIF((value->>'days')::int, 0)
    INTO expiry_days
  FROM public.app_settings
  WHERE key = 'listing_expiry_days';

  IF expiry_days IS NULL OR expiry_days < 1 THEN
    expiry_days := 90;
  END IF;

  UPDATE public.properties
  SET expires_at = COALESCE(approved_at, created_at) + make_interval(days => expiry_days)
  WHERE status = 'live'
    AND expires_at IS NULL;
END$$;

-- Public read policy: hide expired listings unless explicitly allowed
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
  );

-- Update admin review view to surface expiry
DROP VIEW IF EXISTS public.admin_review_view;
CREATE VIEW public.admin_review_view AS
WITH img AS (
  SELECT
    pi.property_id,
    count(*)::int AS photo_count,
    min(pi.image_url) FILTER (WHERE pi.image_url IS NOT NULL) AS first_image_url
  FROM public.property_images pi
  GROUP BY pi.property_id
),
vid AS (
  SELECT
    pv.property_id,
    count(*)::int AS video_count
  FROM public.property_videos pv
  GROUP BY pv.property_id
)
SELECT
  p.id,
  p.owner_id,
  p.status,
  p.submitted_at,
  p.updated_at,
  p.created_at,
  p.is_approved,
  p.approved_at,
  p.rejected_at,
  p.is_active,
  p.rejection_reason,
  p.expires_at,

  p.title,
  p.city,
  p.state_region,
  p.country_code,
  p.admin_area_1,
  p.admin_area_2,
  p.postal_code,
  p.latitude,
  p.longitude,
  p.location_label,
  p.location_place_id,

  -- listing attributes
  p.price,
  p.currency,
  p.rent_period,
  p.rental_type,
  p.listing_type,
  p.bedrooms,
  p.bathrooms,

  -- computed media fields
  COALESCE(img.photo_count, 0) AS photo_count,
  COALESCE(p.cover_image_url, img.first_image_url) AS cover_image_url,
  (COALESCE(img.photo_count, 0) > 0 OR p.cover_image_url IS NOT NULL) AS has_cover,

  COALESCE(vid.video_count, 0) AS video_count,
  (COALESCE(vid.video_count, 0) > 0) AS has_video
FROM public.properties p
LEFT JOIN img ON img.property_id = p.id
LEFT JOIN vid ON vid.property_id = p.id;

COMMENT ON VIEW public.admin_review_view IS 'Admin review queue view with stable, contract-approved columns including expiry.';

GRANT SELECT ON public.admin_review_view TO authenticated;
GRANT SELECT ON public.admin_review_view TO anon;

-- Allow anon read access for app settings (feature flags/configs)
DROP POLICY IF EXISTS "app_settings_read" ON public.app_settings;
CREATE POLICY "app_settings_read"
  ON public.app_settings
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Ask PostgREST to reload schema immediately.
NOTIFY pgrst, 'reload schema';
