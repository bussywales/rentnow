export type TrustMarkerState = {
  email_verified?: boolean | null;
  phone_verified?: boolean | null;
  bank_verified?: boolean | null;
  reliability_power?: string | null;
  reliability_water?: string | null;
  reliability_internet?: string | null;
  trust_updated_at?: string | null;
};

export type TrustBadgeItem = {
  key: "email" | "phone" | "bank";
  label: string;
  verified: boolean;
};

export type VerificationRequirements = {
  requireEmail: boolean;
  requirePhone: boolean;
  requireBank: boolean;
};

export const DEFAULT_VERIFICATION_REQUIREMENTS: VerificationRequirements = {
  requireEmail: true,
  requirePhone: false,
  requireBank: false,
};

export function normalizeVerificationRequirements(
  input?: Partial<VerificationRequirements> | null
): VerificationRequirements {
  return {
    requireEmail: input?.requireEmail ?? DEFAULT_VERIFICATION_REQUIREMENTS.requireEmail,
    requirePhone: input?.requirePhone ?? DEFAULT_VERIFICATION_REQUIREMENTS.requirePhone,
    requireBank: input?.requireBank ?? DEFAULT_VERIFICATION_REQUIREMENTS.requireBank,
  };
}

function getEnabledChecks(requirements: VerificationRequirements) {
  return [
    requirements.requireEmail ? "email" : null,
    requirements.requirePhone ? "phone" : null,
    requirements.requireBank ? "bank" : null,
  ].filter(Boolean) as Array<"email" | "phone" | "bank">;
}

function isCheckSatisfied(markers: TrustMarkerState | null | undefined, check: "email" | "phone" | "bank") {
  if (!markers) return false;
  if (check === "email") return markers.email_verified === true;
  if (check === "phone") return markers.phone_verified === true;
  return markers.bank_verified === true;
}

export function hasEnabledVerificationRequirements(
  requirements?: Partial<VerificationRequirements> | null
): boolean {
  const normalized = normalizeVerificationRequirements(requirements);
  return getEnabledChecks(normalized).length > 0;
}

export function isAdvertiserVerified(
  markers?: TrustMarkerState | null,
  requirements?: Partial<VerificationRequirements> | null
): boolean {
  const normalized = normalizeVerificationRequirements(requirements);
  const enabledChecks = getEnabledChecks(normalized);
  if (!enabledChecks.length) return false;
  return enabledChecks.every((check) => isCheckSatisfied(markers, check));
}

export function isAdvertiserIdentityPending(
  markers?: TrustMarkerState | null,
  requirements?: Partial<VerificationRequirements> | null
): boolean {
  const normalized = normalizeVerificationRequirements(requirements);
  const enabledChecks = getEnabledChecks(normalized);
  if (!enabledChecks.length) return false;
  const satisfiedCount = enabledChecks.filter((check) => isCheckSatisfied(markers, check)).length;
  return satisfiedCount > 0 && satisfiedCount < enabledChecks.length;
}

export function isIdentityVerified(
  markers?: TrustMarkerState | null,
  requirements?: Partial<VerificationRequirements> | null
): boolean {
  return isAdvertiserVerified(markers, requirements);
}

export function getIdentityTrustLabel(
  markers?: TrustMarkerState | null,
  requirements?: Partial<VerificationRequirements> | null
): string | null {
  if (!hasEnabledVerificationRequirements(requirements)) return null;
  if (isAdvertiserVerified(markers, requirements)) return "Identity verified";
  if (isAdvertiserIdentityPending(markers, requirements)) return "Identity pending";
  return null;
}

const RELIABILITY_LEVELS = ["excellent", "good", "fair", "poor"] as const;
type ReliabilityLevel = (typeof RELIABILITY_LEVELS)[number];

const RELIABILITY_LABELS: Record<ReliabilityLevel, string> = {
  excellent: "Excellent",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
};

type ReliabilityKey = "reliability_power" | "reliability_water" | "reliability_internet";

const RELIABILITY_FIELDS: Array<{ key: ReliabilityKey; label: string }> = [
  { key: "reliability_power", label: "Power" },
  { key: "reliability_water", label: "Water" },
  { key: "reliability_internet", label: "Internet" },
];

function normalizeReliabilityLevel(value?: string | null): ReliabilityLevel | null {
  if (!value) return null;
  const normalized = value.toLowerCase().trim();
  if ((RELIABILITY_LEVELS as readonly string[]).includes(normalized)) {
    return normalized as ReliabilityLevel;
  }
  return null;
}

export function buildTrustBadges(
  markers?: TrustMarkerState | null
): TrustBadgeItem[] {
  if (!markers) return [];
  return [
    {
      key: "email",
      label: markers.email_verified ? "Email verified" : "Email not verified",
      verified: !!markers.email_verified,
    },
    {
      key: "phone",
      label: markers.phone_verified ? "Phone verified" : "Phone not verified",
      verified: !!markers.phone_verified,
    },
    {
      key: "bank",
      label: markers.bank_verified ? "Bank verified" : "Bank not verified",
      verified: !!markers.bank_verified,
    },
  ];
}

export function buildReliabilityItems(markers?: TrustMarkerState | null) {
  if (!markers) return [];
  return RELIABILITY_FIELDS.flatMap((field) => {
    const value = markers[field.key];
    const normalized = normalizeReliabilityLevel(value);
    if (!normalized) return [];
    return [
      {
        key: field.key,
        label: field.label,
        value: RELIABILITY_LABELS[normalized],
      },
    ];
  });
}
