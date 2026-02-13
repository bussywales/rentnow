"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { normalizeRole } from "@/lib/roles";
import {
  HELP_DRAWER_CLOSE_EVENT,
  HELP_DRAWER_OPEN_EVENT,
  UPDATES_DRAWER_CLOSE_EVENT,
  dispatchOverlayEvent,
} from "@/lib/ui/overlay-events";

type Props = {
  initialAuthed: boolean;
  initialRole?: string | null;
};

type DrawerGroup = {
  title: string;
  description: string;
  links: Array<{ label: string; href: string; meta: string }>;
};

const GROUPS: DrawerGroup[] = [
  {
    title: "Getting started",
    description: "Get your search setup right in under five minutes.",
    links: [
      { label: "Tenant Help Centre overview", href: "/help/tenant", meta: "Start here" },
      { label: "Tenant getting started", href: "/help/tenant/getting-started", meta: "Checklist" },
    ],
  },
  {
    title: "Browse & shortlist",
    description: "Find homes faster and keep your shortlist organised.",
    links: [
      { label: "Tenant core workflows", href: "/help/tenant/core-workflows", meta: "Workflow" },
      { label: "Alerts and notifications", href: "/help/tenant/alerts-and-notifications", meta: "Alerts" },
    ],
  },
  {
    title: "Troubleshooting",
    description: "Resolve common issues before contacting support.",
    links: [
      { label: "Tenant troubleshooting", href: "/help/tenant/troubleshooting", meta: "Fixes" },
      { label: "Tenant success tips", href: "/help/tenant/success-tips", meta: "Best practices" },
    ],
  },
];

export function TenantHelpDrawer({ initialAuthed, initialRole = null }: Props) {
  const role = normalizeRole(initialRole);
  const canShow = initialAuthed && role === "tenant";
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousActiveRef = useRef<HTMLElement | null>(null);
  const bodyOverflowRef = useRef<string>("");

  const closeDrawer = useCallback(() => {
    setOpen(false);
  }, []);

  const openDrawer = useCallback(() => {
    if (typeof document !== "undefined") {
      const active = document.activeElement;
      if (active instanceof HTMLElement) {
        previousActiveRef.current = active;
      }
    }
    dispatchOverlayEvent(UPDATES_DRAWER_CLOSE_EVENT);
    dispatchOverlayEvent(HELP_DRAWER_OPEN_EVENT);
    setOpen(true);
  }, []);

  useEffect(() => {
    if (!canShow || typeof window === "undefined") return undefined;
    const handleClose = () => closeDrawer();
    window.addEventListener(HELP_DRAWER_CLOSE_EVENT, handleClose);
    return () => {
      window.removeEventListener(HELP_DRAWER_CLOSE_EVENT, handleClose);
    };
  }, [canShow, closeDrawer]);

  useEffect(() => {
    if (!open || typeof document === "undefined") return undefined;
    const body = document.body;
    bodyOverflowRef.current = body.style.overflow;
    body.style.overflow = "hidden";

    const focusTarget = closeButtonRef.current ?? drawerRef.current;
    focusTarget?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDrawer();
        return;
      }
      if (event.key !== "Tab") return;
      const container = drawerRef.current;
      if (!container) return;
      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex='-1'])"
        )
      ).filter((node) => !node.hasAttribute("disabled"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      body.style.overflow = bodyOverflowRef.current;
    };
  }, [closeDrawer, open]);

  useEffect(() => {
    if (open) return;
    const target = previousActiveRef.current ?? buttonRef.current;
    target?.focus();
  }, [open]);

  if (!canShow) return null;

  const portalTarget = typeof document !== "undefined" ? document.body : null;

  return (
    <div className="relative">
      <button
        type="button"
        ref={buttonRef}
        aria-label="Open help"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100"
        data-testid="help-open"
        onClick={openDrawer}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path
            d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-1.2 2-2 2.6-.6.4-1 .8-1 1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M12 17h.01" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {portalTarget &&
        createPortal(
          <>
            {open && (
              <div className="fixed inset-0 z-[1000]" aria-hidden={!open}>
                <button
                  type="button"
                  className="fixed inset-0 bg-slate-900/40"
                  onClick={closeDrawer}
                  aria-label="Close help"
                  data-testid="help-backdrop"
                />
                <aside
                  ref={drawerRef}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="help-drawer-title"
                  tabIndex={-1}
                  className="fixed right-0 top-0 z-[1001] h-dvh w-full max-w-full border-l border-slate-200 bg-white shadow-2xl sm:w-[460px]"
                  data-testid="help-drawer"
                >
                  <div className="flex h-full flex-col">
                    <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Help</p>
                        <h2 id="help-drawer-title" className="text-lg font-semibold text-slate-900">
                          Tenant Help Centre
                        </h2>
                        <p className="text-xs text-slate-500">
                          Guides for searching, shortlisting, viewings, and staying safe.
                        </p>
                      </div>
                      <Button ref={closeButtonRef} variant="secondary" size="sm" onClick={closeDrawer}>
                        Close
                      </Button>
                    </div>

                    <div className="flex-1 overflow-y-auto px-6 py-5">
                      <div className="space-y-5">
                        {GROUPS.map((group) => (
                          <section key={group.title} className="space-y-2">
                            <div>
                              <h3 className="text-sm font-semibold text-slate-900">{group.title}</h3>
                              <p className="text-xs text-slate-500">{group.description}</p>
                            </div>
                            <div className="space-y-2">
                              {group.links.map((link) => (
                                <Link
                                  key={link.href}
                                  href={link.href}
                                  onClick={closeDrawer}
                                  className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:border-slate-300"
                                >
                                  {link.label}
                                  <span className="text-xs font-normal text-slate-500">{link.meta}</span>
                                </Link>
                              ))}
                            </div>
                          </section>
                        ))}
                      </div>
                    </div>

                    <div className="border-t border-slate-200 px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href="/help/tenant"
                          onClick={closeDrawer}
                          className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Open tenant help
                        </Link>
                        <Link
                          href="/support"
                          onClick={closeDrawer}
                          className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Contact support
                        </Link>
                      </div>
                    </div>
                  </div>
                </aside>
              </div>
            )}
          </>,
          portalTarget
        )}
    </div>
  );
}
