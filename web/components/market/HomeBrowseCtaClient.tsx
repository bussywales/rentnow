"use client";

import { useEffect, useState } from "react";
import type { PropertyRequestQuickStartEntry } from "@/lib/requests/property-request-entry";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { clearLastBrowseIntent, getRecentBrowseIntent } from "@/lib/market/browse-intent";

type Props = {
  fallbackHref: string;
  fallbackLabel: string;
  requestAction?: PropertyRequestQuickStartEntry | null;
  requestActionTestId?: string;
};

export function HomeBrowseCtaClient({
  fallbackHref,
  fallbackLabel,
  requestAction = null,
  requestActionTestId = "home-browse-cta-request",
}: Props) {
  const [cleared, setCleared] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setIsMounted(true);
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, []);

  const intent = !cleared && isMounted ? getRecentBrowseIntent(14) : null;
  const continueHref = intent?.lastSearchParams ? `/properties${intent.lastSearchParams}` : null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <ButtonLink href="/properties" variant="secondary">
        Browse all homes
      </ButtonLink>
      {requestAction ? (
        <ButtonLink href={requestAction.href} variant="secondary" data-testid={requestActionTestId}>
          {requestAction.label}
        </ButtonLink>
      ) : null}
      {continueHref ? (
        <>
          <ButtonLink href={continueHref}>Continue browsing</ButtonLink>
          <button
            type="button"
            onClick={() => {
              clearLastBrowseIntent();
              setCleared(true);
            }}
            className="text-sm font-semibold text-slate-200 underline-offset-4 hover:underline"
          >
            Clear
          </button>
        </>
      ) : (
        <ButtonLink href={fallbackHref}>Start in {fallbackLabel}</ButtonLink>
      )}
    </div>
  );
}
