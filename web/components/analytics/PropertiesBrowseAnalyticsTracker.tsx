"use client";

import { useEffect } from "react";
import { trackProductEvent } from "@/lib/analytics/product-events.client";

type Props = {
  searchKey: string;
  shouldTrackSearch: boolean;
  shouldTrackFilters: boolean;
  market: string;
  role: string | null;
  intent: string | null;
  city: string | null;
  area: string | null;
  propertyType: string | null;
  resultsCount: number;
  filterCount: number;
  searchSource: string | null;
};

export function PropertiesBrowseAnalyticsTracker(props: Props) {
  useEffect(() => {
    if (!props.shouldTrackSearch) return;
    const base = {
      market: props.market,
      role: props.role ?? undefined,
      intent: props.intent ?? undefined,
      city: props.city ?? undefined,
      area: props.area ?? undefined,
      propertyType: props.propertyType ?? undefined,
      resultsCount: props.resultsCount,
      filterCount: props.filterCount,
      searchSource: props.searchSource ?? undefined,
    };

    trackProductEvent("search_performed", base, {
      dedupeKey: `search:${props.searchKey}`,
    });

    if (props.shouldTrackFilters) {
      trackProductEvent("filter_applied", base, {
        dedupeKey: `filter:${props.searchKey}`,
      });
    }
  }, [props]);

  return null;
}
