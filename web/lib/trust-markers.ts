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

export function isIdentityVerified(markers?: TrustMarkerState | null): boolean {
  if (!markers) return false;
  if (markers.bank_verified) return true;
  if (markers.email_verified && markers.phone_verified) return true;
  return false;
}

export function getIdentityTrustLabel(markers?: TrustMarkerState | null): string {
  return isIdentityVerified(markers) ? "Identity verified" : "Identity pending";
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
