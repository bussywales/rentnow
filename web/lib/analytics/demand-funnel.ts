import type { SupabaseClient } from "@supabase/supabase-js";

export type DemandFunnelStageKey = "views" | "saves" | "enquiries" | "viewings";

export type DemandFunnelStage = {
  key: DemandFunnelStageKey;
  label: string;
  count: number | null;
  previous: number | null;
  delta: number | null;
  available: boolean;
};

export type DemandFunnelConversion = {
  from: DemandFunnelStageKey;
  to: DemandFunnelStageKey;
  label: string;
  rate: number | null;
  available: boolean;
};

export type DemandFunnelDropOff = {
  label: string;
  rate: number | null;
  available: boolean;
};

export type DemandFunnelAvailability = {
  views: boolean;
  saves: boolean;
  enquiries: boolean;
  viewings: boolean;
};

export type DemandFunnelSnapshot = {
  stages: DemandFunnelStage[];
  conversions: DemandFunnelConversion[];
  dropOff: DemandFunnelDropOff | null;
  availability: DemandFunnelAvailability;
  notes: string[];
};

type FunnelRange = {
  start: string;
  end: string;
  previousStart: string;
  previousEnd: string;
};

type FunnelScope = {
  hostId?: string | null;
  propertyIds?: string[] | null;
};

type StageCounts = {
  views: number | null;
  saves: number | null;
  enquiries: number | null;
  viewings: number | null;
};

type StageAvailability = DemandFunnelAvailability;

type CountResult = { count: number | null; error: { message: string } | null };

type MessageRow = {
  property_id: string;
  sender_id: string;
  properties?: { owner_id: string }[] | null;
};

const STAGE_LABELS: Record<DemandFunnelStageKey, string> = {
  views: "Views",
  saves: "Saves",
  enquiries: "Enquiries",
  viewings: "Viewing requests",
};

const CONVERSION_STEPS: Array<{ from: DemandFunnelStageKey; to: DemandFunnelStageKey }> = [
  { from: "views", to: "saves" },
  { from: "saves", to: "enquiries" },
  { from: "enquiries", to: "viewings" },
];

const toDelta = (current: number | null, previous: number | null) => {
  if (current === null || previous === null) return null;
  return current - previous;
};

const computeRate = (from: DemandFunnelStage, to: DemandFunnelStage): DemandFunnelConversion => {
  if (!from.available || !to.available || from.count === null || to.count === null || from.count === 0) {
    return {
      from: from.key,
      to: to.key,
      label: `${from.label} → ${to.label}`,
      rate: null,
      available: false,
    };
  }
  return {
    from: from.key,
    to: to.key,
    label: `${from.label} → ${to.label}`,
    rate: Math.round((to.count / from.count) * 100),
    available: true,
  };
};

const emptyCounts: StageCounts = {
  views: null,
  saves: null,
  enquiries: null,
  viewings: null,
};

const emptyAvailability: StageAvailability = {
  views: false,
  saves: false,
  enquiries: false,
  viewings: false,
};

export function buildDemandFunnelSnapshot(input: {
  current: StageCounts;
  previous: StageCounts;
  availability: StageAvailability;
  notes?: string[];
}): DemandFunnelSnapshot {
  const notes = input.notes ?? [];
  const stages: DemandFunnelStage[] = (Object.keys(STAGE_LABELS) as DemandFunnelStageKey[]).map(
    (key) => ({
      key,
      label: STAGE_LABELS[key],
      count: input.current[key],
      previous: input.previous[key],
      delta: toDelta(input.current[key], input.previous[key]),
      available: input.availability[key],
    })
  );

  const stageMap = stages.reduce<Record<DemandFunnelStageKey, DemandFunnelStage>>((acc, stage) => {
    acc[stage.key] = stage;
    return acc;
  }, {} as Record<DemandFunnelStageKey, DemandFunnelStage>);

  const conversions = CONVERSION_STEPS.map((step) =>
    computeRate(stageMap[step.from], stageMap[step.to])
  );

  const dropOffCandidate = conversions
    .filter((conversion) => conversion.available && conversion.rate !== null)
    .sort((a, b) => (a.rate ?? 0) - (b.rate ?? 0))[0];

  return {
    stages,
    conversions,
    dropOff: dropOffCandidate
      ? { label: dropOffCandidate.label, rate: dropOffCandidate.rate, available: true }
      : {
          label: "Not available",
          rate: null,
          available: false,
        },
    availability: input.availability,
    notes,
  };
}

async function safeCount(
  promise: PromiseLike<CountResult>,
  label: string,
  notes: string[]
) {
  const result = await promise;
  if (result.error) {
    notes.push(`${label}: ${result.error.message}`);
    return { value: null, available: false };
  }
  return { value: result.count ?? null, available: true };
}

const applyScopeFilters = (query: any, scope: FunnelScope, ownerJoin?: boolean) => {
  let updated = query;
  if (scope.propertyIds && scope.propertyIds.length) {
    updated = updated.in("property_id", scope.propertyIds);
  }
  if (scope.hostId && ownerJoin) {
    updated = updated.eq("properties.owner_id", scope.hostId);
  }
  return updated;
};

async function fetchEnquiries(
  supabase: SupabaseClient,
  range: { start: string; end: string },
  scope: FunnelScope,
  notes: string[],
  label: string
) {
  const { data, error } = await applyScopeFilters(
    supabase
      .from("messages")
      .select("property_id, sender_id, properties!inner(owner_id)")
      .gte("created_at", range.start)
      .lt("created_at", range.end),
    scope,
    true
  );

  if (error) {
    notes.push(`${label}: ${error.message}`);
    return { value: null, available: false };
  }

  const seen = new Set<string>();
  (data as MessageRow[] | null)?.forEach((row) => {
    const ownerId = row.properties?.[0]?.owner_id;
    if (!row.property_id || !row.sender_id || !ownerId) return;
    if (row.sender_id === ownerId) return;
    seen.add(`${row.property_id}:${row.sender_id}`);
  });

  return { value: seen.size, available: true };
}

async function fetchStageCounts(
  supabase: SupabaseClient,
  range: { start: string; end: string },
  scope: FunnelScope,
  notes: string[],
  labelPrefix: string
): Promise<{ counts: StageCounts; availability: StageAvailability }> {
  const viewsSelect = scope.hostId ? "id, properties!inner(owner_id)" : "id";
  const savesSelect = scope.hostId ? "id, properties!inner(owner_id)" : "id";
  const viewingsSelect = scope.hostId ? "id, properties!inner(owner_id)" : "id";

  const viewsQuery = applyScopeFilters(
    supabase
      .from("property_views")
      .select(viewsSelect, { count: "exact", head: true })
      .in("viewer_role", ["tenant", "anon"])
      .gte("created_at", range.start)
      .lt("created_at", range.end),
    scope,
    Boolean(scope.hostId)
  );

  const savesQuery = applyScopeFilters(
    supabase
      .from("saved_properties")
      .select(savesSelect, { count: "exact", head: true })
      .gte("created_at", range.start)
      .lt("created_at", range.end),
    scope,
    Boolean(scope.hostId)
  );

  const viewingsQuery = applyScopeFilters(
    supabase
      .from("viewing_requests")
      .select(viewingsSelect, { count: "exact", head: true })
      .gte("created_at", range.start)
      .lt("created_at", range.end),
    scope,
    Boolean(scope.hostId)
  );

  const [views, saves, viewings, enquiries] = await Promise.all([
    safeCount(viewsQuery, `${labelPrefix}.views`, notes),
    safeCount(savesQuery, `${labelPrefix}.saves`, notes),
    safeCount(viewingsQuery, `${labelPrefix}.viewings`, notes),
    fetchEnquiries(supabase, range, scope, notes, `${labelPrefix}.enquiries`),
  ]);

  return {
    counts: {
      views: views.value,
      saves: saves.value,
      enquiries: enquiries.value,
      viewings: viewings.value,
    },
    availability: {
      views: views.available,
      saves: saves.available,
      enquiries: enquiries.available,
      viewings: viewings.available,
    },
  };
}

export async function getDemandFunnelSnapshot(params: {
  supabase: SupabaseClient;
  range: FunnelRange;
  scope?: FunnelScope;
}): Promise<DemandFunnelSnapshot> {
  const scope = params.scope ?? {};
  const notes: string[] = [];

  const current = await fetchStageCounts(
    params.supabase,
    { start: params.range.start, end: params.range.end },
    scope,
    notes,
    "current"
  );

  const previous = await fetchStageCounts(
    params.supabase,
    { start: params.range.previousStart, end: params.range.previousEnd },
    scope,
    notes,
    "previous"
  );

  return buildDemandFunnelSnapshot({
    current: current.counts ?? emptyCounts,
    previous: previous.counts ?? emptyCounts,
    availability: current.availability ?? emptyAvailability,
    notes,
  });
}
