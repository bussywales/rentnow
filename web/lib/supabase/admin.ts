import { createClient } from "@supabase/supabase-js";

type AdminClient = ReturnType<typeof createClient>;

let lastServiceClientOptions: Record<string, unknown> | null = null;

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
  const options: Record<string, unknown> = {
    db: { schema: "public" },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  };
  lastServiceClientOptions = options;
  return createClient(url, serviceRole, options);
}

export function getLastServiceClientOptions() {
  return lastServiceClientOptions;
}
