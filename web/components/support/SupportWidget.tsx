"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

const QUICK_ACTIONS: Array<{ id: string; label: string; href: string }> = [
  { id: "payments", label: "Payments help", href: "/help/tenant/shortlets" },
  { id: "pending-booking", label: "Booking pending help", href: "/help/tenant/shortlets-trips-timeline" },
  { id: "host-approvals", label: "Host approvals help", href: "/help/landlord/shortlets-bookings" },
  { id: "account-login", label: "Account/login help", href: "/help/troubleshooting/getting-started" },
  { id: "report-issue", label: "Report an issue", href: "/support" },
  { id: "contact-support", label: "Contact support", href: "/support" },
];

export function SupportWidget() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const panelRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  useEffect(() => {
    if (open) {
      panelRef.current?.focus();
      return;
    }
    triggerRef.current?.focus();
  }, [open]);

  return (
    <div className="fixed bottom-4 right-4 z-[55] sm:bottom-6 sm:right-6" data-testid="support-widget">
      {open ? (
        <div
          ref={panelRef}
          tabIndex={-1}
          className="w-[min(92vw,360px)] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"
          data-testid="support-widget-panel"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Support</p>
              <h2 className="text-base font-semibold text-slate-900">How can we help?</h2>
            </div>
            <Button variant="secondary" size="sm" onClick={close}>
              Close
            </Button>
          </div>

          <label htmlFor="support-widget-query" className="mt-3 block text-xs font-medium text-slate-500">
            Search
          </label>
          <input
            id="support-widget-query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="How can we help?"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            data-testid="support-widget-search"
          />

          <div className="mt-3 grid grid-cols-1 gap-2">
            {QUICK_ACTIONS.map((action) => (
              <Link
                key={action.id}
                href={action.href}
                onClick={close}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                data-testid={`support-widget-action-${action.id}`}
              >
                {action.label}
              </Link>
            ))}
          </div>

          <div className="mt-3 border-t border-slate-100 pt-3">
            <Link
              href="/support"
              onClick={close}
              className="text-sm font-semibold text-sky-700 underline underline-offset-4"
              data-testid="support-widget-open-support"
            >
              Open full support page
            </Link>
          </div>
        </div>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-12 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-lg transition hover:bg-slate-50"
          aria-label="Open support widget"
          data-testid="support-widget-toggle"
        >
          Help
        </button>
      )}
    </div>
  );
}
