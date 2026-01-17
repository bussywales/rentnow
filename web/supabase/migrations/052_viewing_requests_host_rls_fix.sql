-- Fix host viewings RLS policies with conditional creation

ALTER TABLE public.viewing_requests ENABLE ROW LEVEL SECURITY;

-- Host can read requests for properties they own
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'viewing_requests'
      AND polname = 'viewings host select'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "viewings host select"
      ON public.viewing_requests
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.properties p
          WHERE p.id = viewing_requests.property_id
            AND p.owner_id = auth.uid()
        )
      );
    $policy$;
  END IF;
END$$;

-- Host can update requests for properties they own
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'viewing_requests'
      AND polname = 'viewings host update'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "viewings host update"
      ON public.viewing_requests
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.properties p
          WHERE p.id = viewing_requests.property_id
            AND p.owner_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.properties p
          WHERE p.id = viewing_requests.property_id
            AND p.owner_id = auth.uid()
        )
      );
    $policy$;
  END IF;
END$$;
