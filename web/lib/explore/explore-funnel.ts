import { recordExploreAnalyticsEvent, type ExploreAnalyticsEventName } from "@/lib/explore/explore-analytics";

export type ExploreFunnelIntent = "shortlet" | "rent" | "buy";

export type TrackExploreFunnelEventInput = {
  name: ExploreAnalyticsEventName;
  listingId?: string | null;
  marketCode?: string | null;
  intentType?: ExploreFunnelIntent | null;
  index?: number;
  feedSize?: number;
  action?: string | null;
  result?: string | null;
  fromIndex?: number;
  toIndex?: number;
  depth?: number;
  trustCueVariant?: "none" | "instant_confirmation" | null;
  trustCueEnabled?: boolean | null;
};

export function trackExploreFunnelEvent(input: TrackExploreFunnelEventInput) {
  return recordExploreAnalyticsEvent({
    name: input.name,
    listingId: input.listingId ?? null,
    marketCode: input.marketCode ?? null,
    intentType: input.intentType ?? null,
    index: input.index,
    feedSize: input.feedSize,
    action: input.action ?? null,
    result: input.result ?? null,
    fromIndex: input.fromIndex,
    toIndex: input.toIndex,
    depth: input.depth,
    trustCueVariant: input.trustCueVariant ?? null,
    trustCueEnabled: input.trustCueEnabled ?? null,
  });
}
