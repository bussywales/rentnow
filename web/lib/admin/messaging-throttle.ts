export type ThrottleEventRow = {
  actor_profile_id: string;
  thread_key: string;
  created_at?: string | null;
};

export type ThrottleCountEntry = {
  key: string;
  count: number;
};

export type ThrottleTelemetrySummary = {
  sampleSize: number;
  topSenders: ThrottleCountEntry[];
  topThreads: ThrottleCountEntry[];
};

function buildCounts(values: string[], maxItems: number) {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, maxItems);
}

export function buildThrottleTelemetrySummary(
  events: ThrottleEventRow[],
  maxItems = 8
): ThrottleTelemetrySummary {
  const senders = events.map((event) => event.actor_profile_id);
  const threads = events.map((event) => event.thread_key);
  return {
    sampleSize: events.length,
    topSenders: buildCounts(senders, maxItems),
    topThreads: buildCounts(threads, maxItems),
  };
}
