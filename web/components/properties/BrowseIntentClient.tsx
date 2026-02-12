"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  dismissBrowseContinueForSession,
  getRecentBrowseIntent,
  isBrowseContinueDismissed,
  setLastBrowseIntent,
} from "@/lib/market/browse-intent";

type Props = {
  persistFilters: boolean;
  showContinueBanner: boolean;
};

export function BrowseIntentClient({ persistFilters, showContinueBanner }: Props) {
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const [dismissedNow, setDismissedNow] = useState(false);
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  useEffect(() => {
    if (!persistFilters) return;
    if (!queryString) return;
    setLastBrowseIntent({
      lastSearchParams: `?${queryString}`,
    });
  }, [persistFilters, queryString]);

  const intent = isClient && showContinueBanner ? getRecentBrowseIntent(14) : null;
  const continueHref = intent?.lastSearchParams ? `/properties${intent.lastSearchParams}` : null;
  const dismissed = dismissedNow || (!isClient ? true : isBrowseContinueDismissed());

  if (!showContinueBanner || !continueHref || dismissed) return null;

  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50/70 px-4 py-3 text-sm text-slate-700 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
        Continue where you left off
      </p>
      <p className="mt-1 text-sm text-slate-600">
        Jump back to your most recent browse filters.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link href={continueHref}>
          <Button size="sm">Continue browsing</Button>
        </Link>
        <button
          type="button"
          className="text-sm font-semibold text-slate-600 underline-offset-4 hover:underline"
          onClick={() => {
            dismissBrowseContinueForSession();
            setDismissedNow(true);
          }}
        >
          Not now
        </button>
      </div>
    </div>
  );
}
