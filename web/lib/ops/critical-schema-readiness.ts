export type SchemaClient = {
  rpc: (
    fn: "get_public_table_columns",
    params: { target_table_names: string[] }
  ) => Promise<{
    data?: Array<{ table_name?: string | null; column_name?: string | null }>;
    error?: { message?: string | null } | null;
  }>;
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
  const targetTables = [...new Set(requirements.map((requirement) => requirement.table))];

  const { data, error } = await client.rpc("get_public_table_columns", {
    target_table_names: targetTables,
  });

  if (error) {
    return {
      ready: false,
      checkedAt,
      checkedCount: requirements.length,
      missing: requirements,
      queryError: error.message?.trim() || "Schema readiness query failed",
    };
  }

  for (const table of targetTables) {
    columnsByTable.set(table, new Set());
  }

  for (const row of data ?? []) {
    const tableName = String(row.table_name || "").trim();
    const columnName = String(row.column_name || "").trim();
    if (!tableName || !columnName) continue;
    const existing = columnsByTable.get(tableName);
    if (!existing) continue;
    existing.add(columnName);
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
