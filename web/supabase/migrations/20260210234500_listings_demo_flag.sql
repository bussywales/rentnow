ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS properties_is_demo_idx
  ON public.properties (is_demo);

INSERT INTO public.app_settings (key, value)
VALUES
  ('demo_badge_enabled', '{"enabled": true}'::jsonb),
  ('demo_watermark_enabled', '{"enabled": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;
