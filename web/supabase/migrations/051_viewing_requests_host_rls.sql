-- RLS policies to allow hosts to read/update viewing requests for their properties

ALTER TABLE public.viewing_requests ENABLE ROW LEVEL SECURITY;

-- Host can read requests for properties they own
CREATE POLICY IF NOT EXISTS "viewings host select"
ON public.viewing_requests
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = viewing_requests.property_id
      AND p.owner_id = auth.uid()
  )
);

-- Host can update requests for properties they own
CREATE POLICY IF NOT EXISTS "viewings host update"
ON public.viewing_requests
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = viewing_requests.property_id
      AND p.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = viewing_requests.property_id
      AND p.owner_id = auth.uid()
  )
);
