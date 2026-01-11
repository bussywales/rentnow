-- Profile trust markers (idempotent).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS bank_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reliability_power TEXT,
  ADD COLUMN IF NOT EXISTS reliability_water TEXT,
  ADD COLUMN IF NOT EXISTS reliability_internet TEXT,
  ADD COLUMN IF NOT EXISTS trust_updated_at TIMESTAMPTZ;

-- Prevent regular users from updating verification flags.
REVOKE UPDATE (email_verified, phone_verified, bank_verified) ON public.profiles FROM authenticated;
