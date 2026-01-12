-- Push delivery attempts (idempotent).

CREATE TABLE IF NOT EXISTS public.push_delivery_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_user_id UUID NULL REFERENCES public.profiles (id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  reason_code TEXT NULL,
  delivered_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  blocked_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  window_seconds INTEGER NULL,
  meta JSONB NULL
);

CREATE INDEX IF NOT EXISTS idx_push_delivery_attempts_created
  ON public.push_delivery_attempts (created_at DESC);

ALTER TABLE public.push_delivery_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_delivery_attempts FORCE ROW LEVEL SECURITY;
