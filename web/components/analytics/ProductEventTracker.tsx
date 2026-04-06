"use client";

import { useEffect } from "react";
import { trackProductEvent } from "@/lib/analytics/product-events.client";
import type {
  ProductAnalyticsEventName,
  ProductAnalyticsEventProperties,
} from "@/lib/analytics/product-events";

type Props = {
  eventName: ProductAnalyticsEventName;
  properties?: ProductAnalyticsEventProperties;
  dedupeKey?: string | null;
};

export function ProductEventTracker({ eventName, properties, dedupeKey }: Props) {
  useEffect(() => {
    trackProductEvent(eventName, properties, { dedupeKey });
  }, [dedupeKey, eventName, properties]);

  return null;
}
