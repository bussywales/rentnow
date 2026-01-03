-- Provider settings singleton for mode toggles (idempotent).

CREATE TABLE IF NOT EXISTS public.provider_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  stripe_mode TEXT NOT NULL DEFAULT 'test',
  paystack_mode TEXT NOT NULL DEFAULT 'test',
  flutterwave_mode TEXT NOT NULL DEFAULT 'test',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'provider_settings_stripe_mode_check'
      AND conrelid = 'public.provider_settings'::regclass
  ) THEN
    ALTER TABLE public.provider_settings
      ADD CONSTRAINT provider_settings_stripe_mode_check
      CHECK (stripe_mode IN ('test', 'live'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'provider_settings_paystack_mode_check'
      AND conrelid = 'public.provider_settings'::regclass
  ) THEN
    ALTER TABLE public.provider_settings
      ADD CONSTRAINT provider_settings_paystack_mode_check
      CHECK (paystack_mode IN ('test', 'live'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'provider_settings_flutterwave_mode_check'
      AND conrelid = 'public.provider_settings'::regclass
  ) THEN
    ALTER TABLE public.provider_settings
      ADD CONSTRAINT provider_settings_flutterwave_mode_check
      CHECK (flutterwave_mode IN ('test', 'live'));
  END IF;
END $$;

INSERT INTO public.provider_settings (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.provider_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_settings FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "provider settings admin read" ON public.provider_settings;
CREATE POLICY "provider settings admin read" ON public.provider_settings
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
  ));

DROP POLICY IF EXISTS "provider settings admin write" ON public.provider_settings;
CREATE POLICY "provider settings admin write" ON public.provider_settings
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
  ));
