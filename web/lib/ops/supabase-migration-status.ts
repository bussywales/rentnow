export const SUPABASE_MIGRATION_ID_PATTERN = /^(\d{3}|\d{14})_/;

export type SupabaseMigrationTableState = {
  localIds: string[];
  remoteIds: string[];
};

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

export function collectLocalMigrationIds(fileNames: ReadonlyArray<string>): string[] {
  const ids = fileNames
    .map((fileName) => fileName.match(SUPABASE_MIGRATION_ID_PATTERN)?.[1] ?? null)
    .filter((value): value is string => value !== null);
  return uniqueSorted(ids);
}

export function parseSupabaseMigrationListOutput(stdout: string): SupabaseMigrationTableState {
  const localIds = new Set<string>();
  const remoteIds = new Set<string>();

  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line.includes("|")) continue;
    const match = line.match(/^\s*([0-9]{3}|[0-9]{14})?\s*\|\s*([0-9]{3}|[0-9]{14})?\s*\|/);
    if (!match) continue;

    const localId = match[1]?.trim();
    const remoteId = match[2]?.trim();
    if (localId) localIds.add(localId);
    if (remoteId) remoteIds.add(remoteId);
  }

  return {
    localIds: uniqueSorted(localIds),
    remoteIds: uniqueSorted(remoteIds),
  };
}

export function findPendingLocalMigrations(input: SupabaseMigrationTableState): string[] {
  const remoteIdSet = new Set(input.remoteIds);
  return input.localIds.filter((migrationId) => !remoteIdSet.has(migrationId));
}

export function findRemoteOnlyMigrations(input: SupabaseMigrationTableState): string[] {
  const localIdSet = new Set(input.localIds);
  return input.remoteIds.filter((migrationId) => !localIdSet.has(migrationId));
}
