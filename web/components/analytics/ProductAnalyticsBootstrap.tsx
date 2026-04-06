"use client";

import Script from "next/script";
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  persistAnalyticsAttributionFromLocation,
  trackGaPageView,
} from "@/lib/analytics/product-events.client";

type Props = {
  measurementId?: string | null;
};

export function ProductAnalyticsBootstrap({ measurementId }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window === "undefined") return;
    persistAnalyticsAttributionFromLocation(window.location.href);
    if (!measurementId) return;
    const query = searchParams?.toString();
    const pagePath = query ? `${pathname}?${query}` : pathname;
    trackGaPageView(measurementId, {
      pagePath,
      pageTitle: document.title || null,
    });
  }, [measurementId, pathname, searchParams]);

  if (!measurementId) {
    return null;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} window.gtag = gtag; gtag('js', new Date()); gtag('config', '${measurementId}', { send_page_view: false });`}
      </Script>
    </>
  );
}
