"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ListingIntentFilter } from "@/lib/types";
import {
  parseIntent,
  readIntentCookieClient,
  readIntentStorageClient,
  resolveIntent,
  setIntentPersist,
} from "@/lib/search-intent";
import { cn } from "@/components/ui/cn";
import {
  getIntentModeHint,
  LISTING_INTENT_TOGGLE_OPTIONS,
} from "@/lib/properties/listing-intent-ui";

type Props = {
  currentIntent: ListingIntentFilter;
  hasUrlIntent: boolean;
};

export function ListingIntentToggle({ currentIntent, hasUrlIntent }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlIntent = parseIntent(searchParams.get("intent"));
  const hasSavedSearchContext = searchParams.has("savedSearchId");
  const activeIntent = urlIntent ?? currentIntent;
  const intentHint = getIntentModeHint(activeIntent);

  const updateIntent = (intent: ListingIntentFilter, mode: "push" | "replace") => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("intent", intent);
    if (next.has("page")) {
      next.set("page", "1");
    }
    next.delete("savedSearchId");
    next.delete("source");
    const href = `${pathname}?${next.toString()}`;
    if (mode === "replace") {
      router.replace(href);
      return;
    }
    router.push(href);
  };

  useEffect(() => {
    if (hasUrlIntent && urlIntent) {
      setIntentPersist(urlIntent);
      return;
    }
    if (urlIntent) {
      setIntentPersist(urlIntent);
      return;
    }

    const resolved = hasSavedSearchContext
      ? currentIntent
      : resolveIntent({
          cookieIntent: readIntentCookieClient(),
          localIntent: readIntentStorageClient(),
          defaultIntent: currentIntent,
        });
    const intent = resolved ?? "rent";
    setIntentPersist(intent);
    updateIntent(intent, "replace");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasUrlIntent, urlIntent, currentIntent, hasSavedSearchContext]);

  return (
    <div className="space-y-2">
      <div
        className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm"
        role="tablist"
        aria-label="Listing intent"
      >
        {LISTING_INTENT_TOGGLE_OPTIONS.map((option) => {
          const selected = activeIntent === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={selected}
              className={cn(
                "rounded-xl px-3 py-1.5 text-sm font-medium transition",
                selected
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
              onClick={() => {
                if (option.value === activeIntent) return;
                setIntentPersist(option.value);
                updateIntent(option.value, "push");
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {intentHint ? (
        <p className="text-xs text-slate-500" data-testid="intent-mode-hint">
          {intentHint}
        </p>
      ) : null}
    </div>
  );
}
