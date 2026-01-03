-- Ensure profiles.id is the auth.users FK (idempotent).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_index i
    WHERE i.indrelid = 'public.profiles'::regclass
      AND i.indisprimary
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indrelid
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(i.indkey)
    WHERE c.oid = 'public.profiles'::regclass
      AND a.attname = 'id'
      AND i.indisunique
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_id_unique UNIQUE (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND contype = 'f'
      AND confrelid = 'auth.users'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_id_fkey
      FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'id'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE public.profiles
      ALTER COLUMN id SET NOT NULL;
  END IF;
END $$;
