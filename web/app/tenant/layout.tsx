export const dynamic = "force-dynamic";

import type { ReactNode } from "react";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { resolveServerRole } from "@/lib/auth/role";
import { getLegalAcceptanceStatus } from "@/lib/legal/acceptance.server";
import { LegalAcceptanceGate } from "@/components/legal/LegalAcceptanceGate";
import { resolveJurisdiction } from "@/lib/legal/jurisdiction.server";

export default async function TenantLayout({ children }: { children: ReactNode }) {
  if (!hasServerSupabaseEnv()) return children;

  const { supabase, user, role } = await resolveServerRole();
  let requireLegalAcceptance = false;
  if (user && role) {
    try {
      const jurisdiction = await resolveJurisdiction({
        userId: user.id,
        supabase,
      });
      const acceptance = await getLegalAcceptanceStatus({
        userId: user.id,
        role,
        jurisdiction,
        supabase,
      });
      requireLegalAcceptance = !acceptance.isComplete;
    } catch {
      // Ignore acceptance failures to avoid blocking tenant access on transient errors.
    }
  }

  if (requireLegalAcceptance) {
    return <LegalAcceptanceGate />;
  }

  return <>{children}</>;
}
