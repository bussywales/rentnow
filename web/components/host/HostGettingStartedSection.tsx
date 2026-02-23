"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { ChecklistItem } from "@/lib/checklists/role-checklists";
import { HomeCollapsibleSection } from "@/components/home/HomeCollapsibleSection";
import {
  buildHostGettingStartedShowStorageKey,
  isHostGettingStartedComplete,
  parseShowCompletedPreference,
} from "@/lib/host/getting-started-preferences";

type Props = {
  role: "landlord" | "agent";
  hostUserId?: string | null;
  items: ChecklistItem[];
  title: string;
  description?: string;
  storageKey: string;
  testId?: string;
  children: ReactNode;
};

function readShowCompleted(storageKey: string) {
  if (typeof window === "undefined") return false;
  return parseShowCompletedPreference(window.localStorage.getItem(storageKey));
}

function writeShowCompleted(storageKey: string, value: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, value ? "1" : "0");
}

export function HostGettingStartedSection({
  hostUserId,
  items,
  title,
  description,
  storageKey,
  testId,
  children,
}: Props) {
  const showKey = useMemo(
    () => buildHostGettingStartedShowStorageKey(hostUserId),
    [hostUserId]
  );
  const [showCompleted, setShowCompleted] = useState(() => readShowCompleted(showKey));
  const completed = isHostGettingStartedComplete(items);
  const hidden = completed && !showCompleted;

  if (hidden) {
    return (
      <section
        className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm"
        data-testid="host-home-getting-started-complete-chip"
      >
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-800">
            Checklist complete
          </span>
          <button
            type="button"
            className="text-xs font-semibold text-emerald-900 underline underline-offset-4"
            onClick={() => {
              writeShowCompleted(showKey, true);
              setShowCompleted(true);
            }}
          >
            Show again
          </button>
        </div>
      </section>
    );
  }

  return (
    <HomeCollapsibleSection
      title={title}
      description={description}
      storageKey={storageKey}
      testId={testId}
    >
      {completed ? (
        <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          <span className="font-semibold">Checklist complete</span>
          <button
            type="button"
            className="font-semibold text-emerald-900 underline underline-offset-4"
            onClick={() => {
              writeShowCompleted(showKey, false);
              setShowCompleted(false);
            }}
          >
            Hide
          </button>
        </div>
      ) : null}
      {children}
    </HomeCollapsibleSection>
  );
}
