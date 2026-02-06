import { NextResponse } from "next/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  resolveStorefrontPublicOutcome,
  safeTrim,
  type StorefrontPublicRow,
} from "@/lib/agents/agent-storefront";
import { getAgentStorefrontData } from "@/lib/agents/agent-storefront.server";

function formatRow(row: StorefrontPublicRow | null | undefined) {
  if (!row) return null;
  return {
    ok: row.ok ?? null,
    reason: row.reason ?? null,
    slug: row.slug ?? null,
    role: row.role ?? null,
    agent_user_id: row.agent_user_id ?? null,
    display_name: row.display_name ?? null,
    agent_storefront_enabled: row.agent_storefront_enabled ?? null,
    global_enabled: row.global_enabled ?? null,
  };
}

async function fetchPublicRow(
  client: {
    rpc: (
      fn: string,
      args: { input_slug: string }
    ) => Promise<{
      data: unknown;
      error: { code?: string | null; message?: string | null; details?: string | null } | null;
    }>;
  },
  slug: string
) {
  const response = await client.rpc("get_agent_storefront_public", { input_slug: slug });
  const row = (Array.isArray(response.data) ? response.data[0] : response.data) as
    | StorefrontPublicRow
    | null
    | undefined;
  const outcome = resolveStorefrontPublicOutcome(row ?? null);
  return {
    row: formatRow(row),
    outcome,
    error: response.error
      ? {
          code: response.error.code ?? null,
          message: response.error.message ?? null,
          details: response.error.details ?? null,
        }
      : null,
  };
}

export async function GET(request: Request) {
  if (process.env.AGENT_STOREFRONT_DEBUG !== "true") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const slug = safeTrim(searchParams.get("slug"));
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  const serviceRoleAvailable = hasServiceRoleEnv();
  const env = {
    supabaseUrl: !!(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL),
    anonKey: !!(process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    serviceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  const anonClient = await createServerSupabaseClient();
  const anonRpc = await fetchPublicRow(anonClient, slug);
  const serviceRpc = serviceRoleAvailable
    ? await fetchPublicRow(createServiceRoleClient(), slug)
    : { row: null, outcome: { ok: false, reason: "NOT_FOUND" as const }, error: null };

  const storefrontData = await getAgentStorefrontData(slug, { requestId: `debug-${Date.now()}` });

  return NextResponse.json({
    slug,
    env,
    serviceRoleAvailable,
    serviceRpc,
    anonRpc,
    storefrontData,
  });
}
