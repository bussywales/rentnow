export type SchemaClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        eq: (column: string, value: string) => Promise<{
          data?: Array<{ column_name?: string | null }>;
          error?: { message?: string | null } | null;
        }>;
      };
    };
  };
};

export type CriticalSchemaRequirement = {
  table: string;
  column: string;
  feature: string;
};

export type CriticalSchemaReadinessResult = {
  ready: boolean;
  checkedAt: string;
  checkedCount: number;
  missing: CriticalSchemaRequirement[];
  queryError: string | null;
};

export const CRITICAL_SCHEMA_REQUIREMENTS: CriticalSchemaRequirement[] = [
  {
    table: "properties",
    column: "commercial_layout_type",
    feature: "commercial listing authoring",
  },
  {
    table: "properties",
    column: "enclosed_rooms",
    feature: "commercial listing authoring",
  },
  {
    table: "properties",
    column: "backup_power_type",
    feature: "local living details",
  },
  {
    table: "properties",
    column: "water_supply_type",
    feature: "local living details",
  },
  {
    table: "properties",
    column: "internet_availability",
    feature: "local living details",
  },
  {
    table: "properties",
    column: "security_type",
    feature: "local living details",
  },
  {
    table: "properties",
    column: "road_access_quality",
    feature: "local living details",
  },
  {
    table: "properties",
    column: "flood_risk_disclosure",
    feature: "local living details",
  },
] as const;

export async function getCriticalSchemaReadiness(
  client: SchemaClient,
  requirements: CriticalSchemaRequirement[] = CRITICAL_SCHEMA_REQUIREMENTS
): Promise<CriticalSchemaReadinessResult> {
  const checkedAt = new Date().toISOString();
  const columnsByTable = new Map<string, Set<string>>();

  for (const table of new Set(requirements.map((requirement) => requirement.table))) {
    const { data, error } = await client
      .from("information_schema.columns")
      .select("column_name")
      .eq("table_schema", "public")
      .eq("table_name", table);

    if (error) {
      return {
        ready: false,
        checkedAt,
        checkedCount: requirements.length,
        missing: requirements,
        queryError: error.message?.trim() || "Schema readiness query failed",
      };
    }

    columnsByTable.set(
      table,
      new Set(
        (data ?? [])
          .map((row) => String(row.column_name || "").trim())
          .filter(Boolean)
      )
    );
  }

  const missing = requirements.filter(
    (requirement) => !columnsByTable.get(requirement.table)?.has(requirement.column)
  );

  return {
    ready: missing.length === 0,
    checkedAt,
    checkedCount: requirements.length,
    missing,
    queryError: null,
  };
}
