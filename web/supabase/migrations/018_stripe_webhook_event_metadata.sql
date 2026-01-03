-- Stripe webhook audit metadata (idempotent).

ALTER TABLE public.stripe_webhook_events
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS mode TEXT,
  ADD COLUMN IF NOT EXISTS profile_id UUID,
  ADD COLUMN IF NOT EXISTS plan_tier TEXT,
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT,
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_profile
  ON public.stripe_webhook_events (profile_id);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_status
  ON public.stripe_webhook_events (status);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_customer
  ON public.stripe_webhook_events (stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_subscription
  ON public.stripe_webhook_events (stripe_subscription_id);
