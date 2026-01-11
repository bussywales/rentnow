-- Push alert retention cleanup (idempotent).

CREATE OR REPLACE FUNCTION public.cleanup_push_alerts(retention_days INTEGER DEFAULT 60)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  IF retention_days < 1 THEN
    RAISE EXCEPTION 'retention_days must be >= 1';
  END IF;

  DELETE FROM public.saved_search_alerts
  WHERE created_at < (NOW() - make_interval(days => retention_days))
    AND channel ILIKE '%push%';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END $$;

REVOKE ALL ON FUNCTION public.cleanup_push_alerts(INTEGER) FROM PUBLIC;
