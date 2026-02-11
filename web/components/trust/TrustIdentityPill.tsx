"use client";

import { cn } from "@/components/ui/cn";
import {
  getIdentityTrustLabel,
  isIdentityVerified,
  type TrustMarkerState,
} from "@/lib/trust-markers";
import { useVerificationRequirements } from "@/lib/trust-verification.client";

type Props = {
  markers?: TrustMarkerState | null;
  className?: string;
};

export function TrustIdentityPill({ markers, className }: Props) {
  const verificationRequirements = useVerificationRequirements();
  const verified = isIdentityVerified(markers, verificationRequirements);
  const label = getIdentityTrustLabel(markers, verificationRequirements);
  if (!label) return null;

  return (
    <span
      data-testid="trust-identity-pill"
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold",
        verified ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600",
        className
      )}
    >
      {label}
    </span>
  );
}
