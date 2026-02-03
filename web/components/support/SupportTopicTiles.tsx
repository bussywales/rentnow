"use client";

import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import type { SupportTopicTile } from "@/lib/support/support-content";

type Props = {
  topics: SupportTopicTile[];
  activeId?: string | null;
  onSelect: (topic: SupportTopicTile) => void;
};

const iconMap: Record<SupportTopicTile["icon"], ReactNode> = {
  account: (
    <svg
      aria-hidden
      className="h-5 w-5 text-sky-600"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" />
      <path d="M4 20a8 8 0 0 1 16 0" />
    </svg>
  ),
  saved: (
    <svg
      aria-hidden
      className="h-5 w-5 text-sky-600"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <path d="M5 4h14a1 1 0 0 1 1 1v15l-8-4-8 4V5a1 1 0 0 1 1-1Z" />
    </svg>
  ),
  contact: (
    <svg
      aria-hidden
      className="h-5 w-5 text-sky-600"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <path d="M21 15a4 4 0 0 1-4 4H7l-4 3V7a4 4 0 0 1 4-4h8" />
      <path d="M16 3h5v5" />
      <path d="M21 3 12 12" />
    </svg>
  ),
  report: (
    <svg
      aria-hidden
      className="h-5 w-5 text-sky-600"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <path d="M5 4v16" />
      <path d="M5 4h10l-2 4 2 4H5" />
    </svg>
  ),
  safety: (
    <svg
      aria-hidden
      className="h-5 w-5 text-sky-600"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <path d="M12 3 5 6v6c0 5 3 8 7 9 4-1 7-4 7-9V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
  other: (
    <svg
      aria-hidden
      className="h-5 w-5 text-sky-600"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <path d="M12 20h.01" />
      <path d="M12 4a4 4 0 0 1 4 4c0 2-2 3-3 4" />
      <path d="M12 16v-1" />
      <path d="M12 4a4 4 0 0 0-4 4" />
    </svg>
  ),
};

export function SupportTopicTiles({ topics, activeId, onSelect }: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="support-topic-tiles">
      {topics.map((topic) => (
        <button
          key={topic.id}
          type="button"
          onClick={() => onSelect(topic)}
          className={cn(
            "group flex h-full items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200",
            activeId === topic.id && "border-sky-200 bg-sky-50/60"
          )}
          data-testid="support-topic-tile"
          data-topic-id={topic.id}
        >
          <span className="mt-0.5 rounded-full bg-sky-100 p-2">
            {iconMap[topic.icon]}
          </span>
          <span>
            <span className="block text-sm font-semibold text-slate-900">
              {topic.title}
            </span>
            <span className="block text-sm text-slate-500">
              {topic.description}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
