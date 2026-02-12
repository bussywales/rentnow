"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import { clearLastBrowseIntent, getRecentBrowseIntent } from "@/lib/market/browse-intent";

type Props = {
  fallbackHref: string;
  fallbackLabel: string;
};

export function HomeBrowseCtaClient({ fallbackHref, fallbackLabel }: Props) {
  const [cleared, setCleared] = useState(false);
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const intent = !cleared && isClient ? getRecentBrowseIntent(14) : null;
  const continueHref = intent?.lastSearchParams ? `/properties${intent.lastSearchParams}` : null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link href="/properties">
        <Button variant="secondary">Browse all homes</Button>
      </Link>
      {continueHref ? (
        <>
          <Link href={continueHref}>
            <Button>Continue browsing</Button>
          </Link>
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
        <Link href={fallbackHref}>
          <Button>Start in {fallbackLabel}</Button>
        </Link>
      )}
    </div>
  );
}
