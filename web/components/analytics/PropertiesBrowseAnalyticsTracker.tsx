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
  commercialFilterUsed?: boolean;
  localLivingFilterUsed?: boolean;
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
      commercialFilterUsed: props.commercialFilterUsed ?? undefined,
      localLivingFilterUsed: props.localLivingFilterUsed ?? undefined,
      surface: "properties_browse",
    };

    trackProductEvent("search_performed", base, {
      dedupeKey: `search:${props.searchKey}`,
    });

    if (props.shouldTrackFilters) {
      trackProductEvent("filter_applied", base, {
        dedupeKey: `filter:${props.searchKey}`,
      });

      if (props.commercialFilterUsed) {
        trackProductEvent(
          "filter_applied",
          {
            ...base,
            category: "commercial_discovery",
            action: "commercial_filters_applied",
          },
          {
            dedupeKey: `filter:commercial:${props.searchKey}`,
          }
        );
      }

      if (props.localLivingFilterUsed) {
        trackProductEvent(
          "filter_applied",
          {
            ...base,
            category: "local_living",
            action: "local_living_filters_applied",
          },
          {
            dedupeKey: `filter:local-living:${props.searchKey}`,
          }
        );
      }
    }
  }, [props]);

  return null;
}
