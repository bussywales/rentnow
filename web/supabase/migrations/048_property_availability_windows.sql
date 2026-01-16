-- Property availability windows (weekly rules + date exceptions)

-- Rules: weekly recurring windows in local minutes
CREATE TABLE IF NOT EXISTS public.property_availability_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL,
  start_minute INTEGER NOT NULL,
  end_minute INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT property_availability_rules_day_check CHECK (day_of_week >= 0 AND day_of_week <= 6),
  CONSTRAINT property_availability_rules_minute_check CHECK (
    start_minute >= 0 AND end_minute <= 1440 AND start_minute < end_minute
  )
);

CREATE INDEX IF NOT EXISTS idx_property_availability_rules_property
  ON public.property_availability_rules (property_id);

CREATE INDEX IF NOT EXISTS idx_property_availability_rules_day
  ON public.property_availability_rules (property_id, day_of_week);

-- Exceptions: date-specific blackout or add_window adjustments
CREATE TABLE IF NOT EXISTS public.property_availability_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  local_date DATE NOT NULL,
  exception_type TEXT NOT NULL,
  start_minute INTEGER,
  end_minute INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT property_availability_exceptions_type_check
    CHECK (exception_type IN ('blackout', 'add_window')),
  CONSTRAINT property_availability_exceptions_minute_check CHECK (
    (start_minute IS NULL AND end_minute IS NULL)
    OR (start_minute IS NOT NULL AND end_minute IS NOT NULL AND start_minute >= 0 AND end_minute <= 1440 AND start_minute < end_minute)
  )
);

CREATE INDEX IF NOT EXISTS idx_property_availability_exceptions_property
  ON public.property_availability_exceptions (property_id);

CREATE INDEX IF NOT EXISTS idx_property_availability_exceptions_date
  ON public.property_availability_exceptions (property_id, local_date);

-- RLS: owners only
ALTER TABLE public.property_availability_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_availability_exceptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "availability rules owner manage" ON public.property_availability_rules;
CREATE POLICY "availability rules owner manage" ON public.property_availability_rules
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_id
        AND p.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_id
        AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "availability exceptions owner manage" ON public.property_availability_exceptions;
CREATE POLICY "availability exceptions owner manage" ON public.property_availability_exceptions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_id
        AND p.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_id
        AND p.owner_id = auth.uid()
    )
  );
