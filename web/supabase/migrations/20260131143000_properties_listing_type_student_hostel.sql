-- Extend listing_type constraint to include student + hostel.

ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS properties_listing_type_check;

ALTER TABLE public.properties
  ADD CONSTRAINT properties_listing_type_check
  CHECK (
    listing_type IS NULL
    OR listing_type IN (
      'apartment',
      'house',
      'duplex',
      'bungalow',
      'studio',
      'room',
      'student',
      'hostel',
      'shop',
      'office',
      'land'
    )
  );
