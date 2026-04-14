export const BACKUP_POWER_TYPE_OPTIONS = [
  { value: "none", label: "None" },
  { value: "inverter", label: "Inverter" },
  { value: "generator", label: "Generator" },
  { value: "solar", label: "Solar" },
  { value: "mixed", label: "Mixed setup" },
] as const;

export const WATER_SUPPLY_TYPE_OPTIONS = [
  { value: "mains", label: "Mains" },
  { value: "borehole", label: "Borehole" },
  { value: "tanker", label: "Tanker" },
  { value: "mixed", label: "Mixed source" },
  { value: "other", label: "Other" },
] as const;

export const INTERNET_AVAILABILITY_OPTIONS = [
  { value: "none", label: "None" },
  { value: "mobile_only", label: "Mobile data only" },
  { value: "broadband", label: "Broadband" },
  { value: "fibre", label: "Fibre" },
] as const;

export const SECURITY_TYPE_OPTIONS = [
  { value: "none", label: "None" },
  { value: "gated_estate", label: "Gated estate" },
  { value: "building_security", label: "Building security" },
  { value: "guard", label: "Security guard" },
  { value: "cctv", label: "CCTV" },
  { value: "mixed", label: "Mixed security" },
] as const;

export const ROAD_ACCESS_QUALITY_OPTIONS = [
  { value: "paved_easy", label: "Paved and easy access" },
  { value: "mixed", label: "Mixed access" },
  { value: "rough", label: "Rough access" },
] as const;

export const FLOOD_RISK_DISCLOSURE_OPTIONS = [
  { value: "low", label: "Owner says low risk" },
  { value: "seasonal", label: "Seasonal caution" },
  { value: "known_risk", label: "Known flood risk" },
  { value: "unknown", label: "Not confirmed" },
] as const;

export type BackupPowerType = (typeof BACKUP_POWER_TYPE_OPTIONS)[number]["value"];
export type WaterSupplyType = (typeof WATER_SUPPLY_TYPE_OPTIONS)[number]["value"];
export type InternetAvailability = (typeof INTERNET_AVAILABILITY_OPTIONS)[number]["value"];
export type SecurityType = (typeof SECURITY_TYPE_OPTIONS)[number]["value"];
export type RoadAccessQuality = (typeof ROAD_ACCESS_QUALITY_OPTIONS)[number]["value"];
export type FloodRiskDisclosure = (typeof FLOOD_RISK_DISCLOSURE_OPTIONS)[number]["value"];

type LocalLivingFact = {
  key:
    | "backup_power_type"
    | "water_supply_type"
    | "internet_availability"
    | "security_type"
    | "road_access_quality"
    | "flood_risk_disclosure";
  label: string;
  value: string;
  tone?: "neutral" | "warning";
};

type LocalLivingValueShape = {
  backup_power_type?: string | null;
  water_supply_type?: string | null;
  internet_availability?: string | null;
  security_type?: string | null;
  road_access_quality?: string | null;
  flood_risk_disclosure?: string | null;
};

function labelFromOptions<T extends readonly { value: string; label: string }[]>(
  options: T,
  value: string | null | undefined
) {
  if (!value) return null;
  return options.find((option) => option.value === value)?.label ?? null;
}

export function formatBackupPowerType(value: BackupPowerType | string | null | undefined) {
  return labelFromOptions(BACKUP_POWER_TYPE_OPTIONS, value);
}

export function formatWaterSupplyType(value: WaterSupplyType | string | null | undefined) {
  return labelFromOptions(WATER_SUPPLY_TYPE_OPTIONS, value);
}

export function formatInternetAvailability(
  value: InternetAvailability | string | null | undefined
) {
  return labelFromOptions(INTERNET_AVAILABILITY_OPTIONS, value);
}

export function formatSecurityType(value: SecurityType | string | null | undefined) {
  return labelFromOptions(SECURITY_TYPE_OPTIONS, value);
}

export function formatRoadAccessQuality(value: RoadAccessQuality | string | null | undefined) {
  return labelFromOptions(ROAD_ACCESS_QUALITY_OPTIONS, value);
}

export function formatFloodRiskDisclosure(
  value: FloodRiskDisclosure | string | null | undefined
) {
  return labelFromOptions(FLOOD_RISK_DISCLOSURE_OPTIONS, value);
}

export function hasStructuredPowerBackup(property: Pick<LocalLivingValueShape, "backup_power_type">) {
  return !!property.backup_power_type && property.backup_power_type !== "none";
}

export function hasBoreholeWater(property: Pick<LocalLivingValueShape, "water_supply_type">) {
  return (
    property.water_supply_type === "borehole" || property.water_supply_type === "mixed"
  );
}

export function hasBroadbandOrFibre(
  property: Pick<LocalLivingValueShape, "internet_availability">
) {
  return (
    property.internet_availability === "broadband" ||
    property.internet_availability === "fibre"
  );
}

export function hasSecurityFeature(property: Pick<LocalLivingValueShape, "security_type">) {
  return !!property.security_type && property.security_type !== "none";
}

export function countLocalLivingDetails(
  property: Pick<
    LocalLivingValueShape,
    | "backup_power_type"
    | "water_supply_type"
    | "internet_availability"
    | "security_type"
    | "road_access_quality"
    | "flood_risk_disclosure"
  >
) {
  return [
    property.backup_power_type,
    property.water_supply_type,
    property.internet_availability,
    property.security_type,
    property.road_access_quality,
    property.flood_risk_disclosure,
  ].filter(Boolean).length;
}

export function buildLocalLivingFacts(
  property: Pick<
    LocalLivingValueShape,
    | "backup_power_type"
    | "water_supply_type"
    | "internet_availability"
    | "security_type"
    | "road_access_quality"
    | "flood_risk_disclosure"
  >
): LocalLivingFact[] {
  const facts: LocalLivingFact[] = [];

  const backupPower = formatBackupPowerType(property.backup_power_type);
  if (backupPower) {
    facts.push({
      key: "backup_power_type",
      label: "Backup power",
      value: backupPower,
    });
  }

  const waterSupply = formatWaterSupplyType(property.water_supply_type);
  if (waterSupply) {
    facts.push({
      key: "water_supply_type",
      label: "Water source",
      value: waterSupply,
    });
  }

  const internetAvailability = formatInternetAvailability(property.internet_availability);
  if (internetAvailability) {
    facts.push({
      key: "internet_availability",
      label: "Internet",
      value: internetAvailability,
    });
  }

  const securityType = formatSecurityType(property.security_type);
  if (securityType) {
    facts.push({
      key: "security_type",
      label: "Security",
      value: securityType,
    });
  }

  const roadAccess = formatRoadAccessQuality(property.road_access_quality);
  if (roadAccess) {
    facts.push({
      key: "road_access_quality",
      label: "Road access",
      value: roadAccess,
    });
  }

  const floodRisk = formatFloodRiskDisclosure(property.flood_risk_disclosure);
  if (floodRisk) {
    facts.push({
      key: "flood_risk_disclosure",
      label: "Flood disclosure",
      value: floodRisk,
      tone:
        property.flood_risk_disclosure === "seasonal" ||
        property.flood_risk_disclosure === "known_risk"
          ? "warning"
          : "neutral",
    });
  }

  return facts;
}
