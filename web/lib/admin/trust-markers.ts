import type { UserRole } from "@/lib/types";
import type { TrustMarkerState } from "@/lib/trust-markers";

export type TrustMarkerRow = TrustMarkerState & {
  id: string;
  role: UserRole | null;
};

export type TrustMarkerSummary = {
  hostCount: number;
  emailVerified: number;
  phoneVerified: number;
  bankVerified: number;
  reliabilitySet: number;
};

const HOST_ROLES: UserRole[] = ["landlord", "agent"];

export function buildTrustMarkerSummary(rows: TrustMarkerRow[]): TrustMarkerSummary {
  const hostRows = rows.filter((row) => row.role && HOST_ROLES.includes(row.role));
  const reliabilitySet = hostRows.filter((row) =>
    Boolean(
      row.reliability_power ||
        row.reliability_water ||
        row.reliability_internet
    )
  );

  return {
    hostCount: hostRows.length,
    emailVerified: hostRows.filter((row) => row.email_verified).length,
    phoneVerified: hostRows.filter((row) => row.phone_verified).length,
    bankVerified: hostRows.filter((row) => row.bank_verified).length,
    reliabilitySet: reliabilitySet.length,
  };
}
