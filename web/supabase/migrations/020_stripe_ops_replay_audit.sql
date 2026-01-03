-- Stripe webhook replay audit metadata (idempotent).

ALTER TABLE public.stripe_webhook_events
  ADD COLUMN IF NOT EXISTS replay_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_replay_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_replay_status TEXT,
  ADD COLUMN IF NOT EXISTS last_replay_reason TEXT;
