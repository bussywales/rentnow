"use client";

import { useEffect } from "react";

export function CtaHashAnchorClient(props: {
  targetId?: string;
  topOffsetPx?: number;
}) {
  const targetId = props.targetId ?? "cta";
  const topOffsetPx = Number.isFinite(props.topOffsetPx) ? Math.max(0, props.topOffsetPx ?? 0) : 0;

  useEffect(() => {
    const scrollToHashTarget = (behavior: ScrollBehavior) => {
      const hash = window.location.hash?.replace(/^#/, "");
      if (!hash || hash !== targetId) return;

      const target = document.getElementById(targetId);
      if (!target) return;

      const targetTop = target.getBoundingClientRect().top + window.scrollY - topOffsetPx;
      window.scrollTo({
        top: Math.max(0, targetTop),
        behavior,
      });
    };

    const onHashChange = () => {
      window.requestAnimationFrame(() => {
        scrollToHashTarget("smooth");
      });
    };

    const onInitialLoad = () => {
      window.requestAnimationFrame(() => {
        window.setTimeout(() => scrollToHashTarget("auto"), 30);
      });
    };

    onInitialLoad();
    window.addEventListener("hashchange", onHashChange);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
    };
  }, [targetId, topOffsetPx]);

  return null;
}
