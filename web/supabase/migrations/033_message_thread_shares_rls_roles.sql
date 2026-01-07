-- Message thread shares RLS policy roles (idempotent).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'message_thread_shares'
      AND policyname = 'message thread shares select participants'
  ) THEN
    ALTER POLICY "message thread shares select participants"
      ON public.message_thread_shares
      TO authenticated;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'message_thread_shares'
      AND policyname = 'message thread shares insert participants'
  ) THEN
    ALTER POLICY "message thread shares insert participants"
      ON public.message_thread_shares
      TO authenticated;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'message_thread_shares'
      AND policyname = 'message thread shares update participants'
  ) THEN
    ALTER POLICY "message thread shares update participants"
      ON public.message_thread_shares
      TO authenticated;
  END IF;
END $$;
