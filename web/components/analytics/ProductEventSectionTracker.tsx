"use client";

import { useEffect, useRef } from "react";
import { trackProductEvent } from "@/lib/analytics/product-events.client";
import type {
  ProductAnalyticsEventName,
  ProductAnalyticsEventProperties,
} from "@/lib/analytics/product-events";

type Props = {
  eventName: ProductAnalyticsEventName;
  properties?: ProductAnalyticsEventProperties;
  dedupeKey?: string | null;
  rootMargin?: string;
};

export function ProductEventSectionTracker({
  eventName,
  properties,
  dedupeKey,
  rootMargin = "0px 0px -25% 0px",
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;

    let sent = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (sent) return;
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        sent = true;
        trackProductEvent(eventName, properties, { dedupeKey });
        observer.disconnect();
      },
      { rootMargin, threshold: 0.2 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [dedupeKey, eventName, properties, rootMargin]);

  return <div ref={ref} aria-hidden="true" className="h-0 w-0 overflow-hidden" />;
}
