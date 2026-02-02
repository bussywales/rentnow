export const dynamic = "force-dynamic";

import type { ReactNode } from "react";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { resolveServerRole } from "@/lib/auth/role";
import { getLegalAcceptanceStatus } from "@/lib/legal/acceptance.server";
import { LegalAcceptanceGate } from "@/components/legal/LegalAcceptanceGate";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  if (!hasServerSupabaseEnv()) return children;

  const { supabase, user, role } = await resolveServerRole();
  let requireLegalAcceptance = false;
  if (user && role === "admin") {
    try {
      const acceptance = await getLegalAcceptanceStatus({
        userId: user.id,
        role,
        supabase,
      });
      requireLegalAcceptance = !acceptance.isComplete;
    } catch {
      // Avoid blocking admin access on transient acceptance failures.
    }
  }

  if (requireLegalAcceptance) {
    return <LegalAcceptanceGate />;
  }

  return <>{children}</>;
}
