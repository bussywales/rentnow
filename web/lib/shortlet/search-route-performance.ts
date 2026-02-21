export type ShortletSearchPipelineDebugMetrics = {
  dbRowsFetched: number;
  postFilterCount: number;
  availabilityPruned: number;
  profileLookupsCount: number;
  finalCount: number;
  durationMs: number;
};

export function resolveShortletSourceRowsLimit(input: {
  offset: number;
  limit: number;
  maxRows: number;
}): number {
  const offset = Math.max(0, Math.trunc(Number(input.offset) || 0));
  const limit = Math.max(1, Math.trunc(Number(input.limit) || 1));
  const maxRows = Math.max(1, Math.trunc(Number(input.maxRows) || 1));
  const headroom = 80;
  const minRows = 120;
  const requested = offset + limit + headroom;
  return Math.min(maxRows, Math.max(minRows, requested));
}

export function createShortletSearchDebugMetrics(input: ShortletSearchPipelineDebugMetrics) {
  return {
    dbRowsFetched: Math.max(0, Math.trunc(Number(input.dbRowsFetched) || 0)),
    postFilterCount: Math.max(0, Math.trunc(Number(input.postFilterCount) || 0)),
    availabilityPruned: Math.max(0, Math.trunc(Number(input.availabilityPruned) || 0)),
    profileLookupsCount: Math.max(0, Math.trunc(Number(input.profileLookupsCount) || 0)),
    finalCount: Math.max(0, Math.trunc(Number(input.finalCount) || 0)),
    durationMs: Math.max(0, Math.trunc(Number(input.durationMs) || 0)),
  };
}
