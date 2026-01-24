import { createClient } from "@supabase/supabase-js";

type AdminClient = ReturnType<typeof createClient>;

if (typeof window !== "undefined") {
  throw new Error("Supabase admin client is server-only.");
}

export function normalizeSupabaseUrl(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `https://${trimmed}`;
}

export function hasServiceRoleEnv() {
  const url = normalizeSupabaseUrl(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return !!url && !!serviceRole;
}

export function createServiceRoleClient(): AdminClient {
  const url = normalizeSupabaseUrl(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL");
  }
  return createClient(url, serviceRole);
}
