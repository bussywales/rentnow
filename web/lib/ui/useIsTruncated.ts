"use client";

import { useCallback, useEffect, useState } from "react";

type TruncationTarget = Pick<HTMLElement, "clientWidth" | "scrollWidth" | "clientHeight" | "scrollHeight">;

export function isElementTruncated(target: TruncationTarget | null | undefined): boolean {
  if (!target) return false;
  return target.scrollWidth > target.clientWidth || target.scrollHeight > target.clientHeight;
}

export function useIsTruncated<T extends HTMLElement>() {
  const [node, setNode] = useState<T | null>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  const ref = useCallback((nextNode: T | null) => {
    setNode(nextNode);
    setIsTruncated(isElementTruncated(nextNode));
  }, []);

  useEffect(() => {
    if (!node) return;
    let frameId: number | null = null;
    const scheduleRecompute = () => {
      if (typeof window === "undefined") return;
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      frameId = window.requestAnimationFrame(() => {
        setIsTruncated(isElementTruncated(node));
        frameId = null;
      });
    };
    scheduleRecompute();

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            scheduleRecompute();
          })
        : null;
    resizeObserver?.observe(node);

    const handleResize = () => scheduleRecompute();
    window.addEventListener("resize", handleResize, { passive: true });

    const fontsApi = typeof document !== "undefined" ? (document as Document & { fonts?: FontFaceSet }).fonts : undefined;
    let removedFontsListener = false;
    const fontHandler = () => scheduleRecompute();
    if (fontsApi && typeof fontsApi.addEventListener === "function") {
      fontsApi.addEventListener("loadingdone", fontHandler);
      fontsApi.ready.then(fontHandler).catch(() => undefined);
    }

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", handleResize);
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      if (!removedFontsListener && fontsApi && typeof fontsApi.removeEventListener === "function") {
        fontsApi.removeEventListener("loadingdone", fontHandler);
      }
      removedFontsListener = true;
    };
  }, [node]);

  return {
    ref,
    isTruncated,
    recompute: () => setIsTruncated(isElementTruncated(node)),
  };
}
