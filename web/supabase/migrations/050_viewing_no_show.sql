-- Viewing no-show signal (host reported)

ALTER TABLE public.viewing_requests
  ADD COLUMN IF NOT EXISTS no_show_reported_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS no_show_reported_by UUID REFERENCES auth.users (id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'viewing_requests_no_show_once'
  ) THEN
    ALTER TABLE public.viewing_requests
      ADD CONSTRAINT viewing_requests_no_show_once
      CHECK (
        no_show_reported_at IS NULL
        OR status = 'approved'
      );
  END IF;
END $$;

-- Prevent changing no-show fields once set
CREATE OR REPLACE FUNCTION public.prevent_no_show_change()
RETURNS trigger AS $$
BEGIN
  IF OLD.no_show_reported_at IS NOT NULL THEN
    NEW.no_show_reported_at := OLD.no_show_reported_at;
    NEW.no_show_reported_by := OLD.no_show_reported_by;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_viewing_requests_no_show_lock ON public.viewing_requests;
CREATE TRIGGER trg_viewing_requests_no_show_lock
BEFORE UPDATE ON public.viewing_requests
FOR EACH ROW
EXECUTE FUNCTION public.prevent_no_show_change();
