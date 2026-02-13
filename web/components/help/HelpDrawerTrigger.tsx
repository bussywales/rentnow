"use client";

import { openHelpDrawer } from "@/lib/ui/overlay-events";

export function HelpDrawerTrigger({
  label = "Need help?",
  className = "",
  testId,
}: {
  label?: string;
  className?: string;
  testId?: string;
}) {
  const classes = [
    "inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50",
    className,
  ]
    .join(" ")
    .trim();

  return (
    <button
      type="button"
      className={classes}
      onClick={() => openHelpDrawer()}
      data-testid={testId}
    >
      {label}
    </button>
  );
}
