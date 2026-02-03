-- Ensure admin_review_view uses invoker privileges (not security definer)
DO $$
BEGIN
  IF to_regclass('public.admin_review_view') IS NOT NULL THEN
    EXECUTE 'ALTER VIEW public.admin_review_view SET (security_invoker = true)';
  END IF;
END $$;
