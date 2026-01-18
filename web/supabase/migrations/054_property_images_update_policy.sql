-- Allow owners/agents/admins to update property_images (for ordering).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'property_images'
      AND policyname = 'images owner/admin update'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "images owner/admin update" ON public.property_images
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.properties pr
          WHERE pr.id = property_id
            AND (
              pr.owner_id = auth.uid()
              OR EXISTS (
                SELECT 1 FROM public.agent_delegations d
                WHERE d.agent_id = auth.uid()
                  AND d.landlord_id = pr.owner_id
                  AND d.status = 'active'
              )
              OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
            )
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.properties pr
          WHERE pr.id = property_id
            AND (
              pr.owner_id = auth.uid()
              OR EXISTS (
                SELECT 1 FROM public.agent_delegations d
                WHERE d.agent_id = auth.uid()
                  AND d.landlord_id = pr.owner_id
                  AND d.status = 'active'
              )
              OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
            )
        )
      );
    $policy$;
  END IF;
END $$;
