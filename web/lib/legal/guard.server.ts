import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserRole } from "@/lib/types";
import { getLegalAcceptanceStatus } from "@/lib/legal/acceptance.server";
import { resolveJurisdiction } from "@/lib/legal/jurisdiction.server";

type RequireInput = {
  request: Request;
  supabase: SupabaseClient;
  userId: string;
  role: UserRole;
};

type RequireDeps = {
  getLegalAcceptanceStatus?: typeof getLegalAcceptanceStatus;
  resolveJurisdiction?: typeof resolveJurisdiction;
};

export async function requireLegalAcceptance(
  input: RequireInput,
  deps: RequireDeps = {}
): Promise<
  | { ok: true; status: Awaited<ReturnType<typeof getLegalAcceptanceStatus>> }
  | { ok: false; response: NextResponse }
> {
  const getStatus = deps.getLegalAcceptanceStatus ?? getLegalAcceptanceStatus;
  const resolve = deps.resolveJurisdiction ?? resolveJurisdiction;

  try {
    const { searchParams } = new URL(input.request.url);
    const jurisdiction = await resolve({
      searchParams,
      userId: input.userId,
      supabase: input.supabase,
    });

    const status = await getStatus({
      userId: input.userId,
      role: input.role,
      jurisdiction,
      supabase: input.supabase,
    });

    if (status.isComplete) {
      return { ok: true, status };
    }

    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Legal acceptance required",
          code: "LEGAL_ACCEPTANCE_REQUIRED",
          jurisdiction: status.jurisdiction,
          missing_audiences: [...status.missingAudiences, ...status.pendingAudiences],
        },
        { status: 428 }
      ),
    };
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Unable to verify legal acceptance", code: "LEGAL_ACCEPTANCE_UNAVAILABLE" },
        { status: 503 }
      ),
    };
  }
}
