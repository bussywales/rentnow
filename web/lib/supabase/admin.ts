import "server-only";
import { createClient } from "@supabase/supabase-js";

type AdminClient = ReturnType<typeof createClient>;

export function hasServiceRoleEnv() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return !!url && !!serviceRole;
}

export function createServiceRoleClient(): AdminClient {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL");
  }
  return createClient(url, serviceRole);
}
