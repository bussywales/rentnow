"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { isBookingsTargetFromLocation } from "@/lib/host/bookings-navigation";

export function HostBookingsHashAnchorClient(props: {
  targetId?: string;
  topOffsetPx?: number;
}) {
  const searchParams = useSearchParams();
  const targetId = props.targetId ?? "host-bookings";
  const topOffsetPx = Number.isFinite(props.topOffsetPx)
    ? Math.max(0, props.topOffsetPx ?? 0)
    : 0;

  useEffect(() => {
    let retryTimer: number | null = null;

    const scrollToTarget = (behavior: ScrollBehavior, attempt = 0) => {
      const tab = searchParams.get("tab");
      const hash = window.location.hash;
      const shouldScroll = isBookingsTargetFromLocation({ tab, hash });
      if (!shouldScroll) return;

      const target = document.getElementById(targetId);
      if (!target) {
        if (attempt < 6) {
          retryTimer = window.setTimeout(() => scrollToTarget(behavior, attempt + 1), 60);
        }
        return;
      }

      const targetTop = target.getBoundingClientRect().top + window.scrollY - topOffsetPx;
      window.scrollTo({
        top: Math.max(0, targetTop),
        behavior,
      });
    };

    const onHashChange = () => {
      window.requestAnimationFrame(() => {
        scrollToTarget("smooth");
      });
    };

    window.requestAnimationFrame(() => {
      window.setTimeout(() => scrollToTarget("auto"), 30);
    });

    window.addEventListener("hashchange", onHashChange);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
      if (retryTimer) {
        window.clearTimeout(retryTimer);
      }
    };
  }, [searchParams, targetId, topOffsetPx]);

  return null;
}
