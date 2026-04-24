"use client";

import { ProductEventTracker } from "@/components/analytics/ProductEventTracker";

export function BootcampPageAnalytics() {
  return (
    <ProductEventTracker
      eventName="bootcamp_page_viewed"
      dedupeKey="bootcamp:page:viewed"
      properties={{
        category: "bootcamp_launch",
        surface: "bootcamp_page",
      }}
    />
  );
}
