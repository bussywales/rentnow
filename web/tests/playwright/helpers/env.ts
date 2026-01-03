export const HAS_SUPABASE_ENV =
  (!!process.env.SUPABASE_URL || !!process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  (!!process.env.SUPABASE_ANON_KEY || !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

