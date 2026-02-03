"use client";

import { cn } from "@/components/ui/cn";
import type { SupportFaqItem } from "@/lib/support/support-content";

type Props = {
  items: SupportFaqItem[];
  className?: string;
  openId?: string | null;
  onOpenChange?: (id: string | null) => void;
};

export function SupportFaqAccordion({
  items,
  className,
  openId,
  onOpenChange,
}: Props) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm",
        className
      )}
      data-testid="support-faq"
      id="support-faq"
    >
      <h3 className="text-base font-semibold text-slate-900">FAQ</h3>
      <p className="text-sm text-slate-500">
        Quick answers to the most common support questions.
      </p>
      <div className="mt-4 space-y-2">
        {items.map((item) => (
          <details
            key={item.id}
            className="group rounded-xl border border-slate-200 bg-slate-50 p-3"
            open={openId === item.id}
            onToggle={(event) => {
              const target = event.currentTarget;
              if (target.open) {
                onOpenChange?.(item.id);
              } else if (openId === item.id) {
                onOpenChange?.(null);
              }
            }}
            data-testid={`support-faq-item-${item.id}`}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
              {item.question}
              <svg
                aria-hidden
                className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </summary>
            <p className="mt-2 text-sm text-slate-600">{item.answer}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
