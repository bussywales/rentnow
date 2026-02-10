-- Align referral jurisdiction policy upserts with ON CONFLICT (country_code).

UPDATE public.referral_jurisdiction_policies
SET country_code = upper(btrim(country_code))
WHERE country_code <> upper(btrim(country_code));

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY country_code
      ORDER BY updated_at DESC NULLS LAST, id DESC
    ) AS row_rank
  FROM public.referral_jurisdiction_policies
)
DELETE FROM public.referral_jurisdiction_policies policies
USING ranked
WHERE policies.id = ranked.id
  AND ranked.row_rank > 1;

DROP INDEX IF EXISTS public.idx_referral_jurisdiction_policies_country_code;

ALTER TABLE public.referral_jurisdiction_policies
  DROP CONSTRAINT IF EXISTS referral_jurisdiction_policies_country_code_key;

ALTER TABLE public.referral_jurisdiction_policies
  ADD CONSTRAINT referral_jurisdiction_policies_country_code_key
  UNIQUE (country_code);

ALTER TABLE public.referral_jurisdiction_policies
  DROP CONSTRAINT IF EXISTS referral_jurisdiction_policies_country_code_normalized_chk;

ALTER TABLE public.referral_jurisdiction_policies
  ADD CONSTRAINT referral_jurisdiction_policies_country_code_normalized_chk
  CHECK (country_code = upper(btrim(country_code)));
