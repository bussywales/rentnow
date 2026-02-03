"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import {
  HELP_DRAWER_OPEN_EVENT,
  UPDATES_DRAWER_OPEN_EVENT,
  openProductUpdatesDrawer,
} from "@/lib/ui/overlay-events";

type Props = {
  initialAuthed: boolean;
};

type OnboardingUpdate = {
  id: string;
  title: string;
  summary: string;
  image_url?: string | null;
  published_at?: string | null;
};

type OnboardingPayload = {
  dismissed_at?: string | null;
  last_seen_at?: string | null;
  updates?: OnboardingUpdate[];
};

const SESSION_KEY = "ph_updates_onboarding_shown";
const SUMMARY_LIMIT = 120;

function truncateSummary(summary: string) {
  const trimmed = summary.trim();
  if (trimmed.length <= SUMMARY_LIMIT) return trimmed;
  return `${trimmed.slice(0, SUMMARY_LIMIT)}…`;
}

export function ProductUpdatesOnboarding({ initialAuthed }: Props) {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const [updates, setUpdates] = useState<OnboardingUpdate[]>([]);
  const [loading, setLoading] = useState(false);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousActiveRef = useRef<HTMLElement | null>(null);
  const bodyOverflowRef = useRef<string>("");
  const attemptedRef = useRef(false);

  const isEligibleRoute = useMemo(() => {
    if (!pathname) return false;
    if (pathname === "/tenant/home") return true;
    if (pathname === "/host/listings") return true;
    if (pathname.startsWith("/admin")) return true;
    return false;
  }, [pathname]);

  const closeModal = useCallback(() => {
    setOpen(false);
  }, []);

  const dismissOnboarding = useCallback(async () => {
    try {
      const res = await fetch("/api/product-updates/onboarding", { method: "POST" });
      await res.json().catch(() => ({}));
    } catch {
      // ignore
    }
  }, []);

  const dismissAndClose = useCallback(async () => {
    closeModal();
    await dismissOnboarding();
  }, [closeModal, dismissOnboarding]);

  useEffect(() => {
    if (!open || typeof document === "undefined") return undefined;
    const body = document.body;
    bodyOverflowRef.current = body.style.overflow;
    body.style.overflow = "hidden";
    const focusTarget = closeButtonRef.current ?? modalRef.current;
    focusTarget?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        void dismissAndClose();
        return;
      }
      if (event.key !== "Tab") return;
      const container = modalRef.current;
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
  }, [closeModal, dismissAndClose, open]);

  useEffect(() => {
    if (open) return;
    previousActiveRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!initialAuthed || !isEligibleRoute) return;
    if (typeof window === "undefined") return;
    if (attemptedRef.current) return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    attemptedRef.current = true;
    setLoading(true);
    void (async () => {
      try {
        const res = await fetch("/api/product-updates/onboarding");
        const data = (await res.json().catch(() => ({}))) as OnboardingPayload;
        if (!res.ok) return;
        const dismissed = data.dismissed_at ?? null;
        const nextUpdates = Array.isArray(data.updates) ? data.updates : [];
        if (!nextUpdates.length) return;
        if (dismissed) {
          const latestPublished = nextUpdates.find((row) => row.published_at)?.published_at;
          if (latestPublished && new Date(latestPublished) <= new Date(dismissed)) {
            return;
          }
        }
        setUpdates(nextUpdates);
        sessionStorage.setItem(SESSION_KEY, "1");
        previousActiveRef.current = document.activeElement as HTMLElement | null;
        setOpen(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [initialAuthed, isEligibleRoute]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleUpdatesOpen = () => closeModal();
    const handleHelpOpen = () => closeModal();
    window.addEventListener(UPDATES_DRAWER_OPEN_EVENT, handleUpdatesOpen);
    window.addEventListener(HELP_DRAWER_OPEN_EVENT, handleHelpOpen);
    return () => {
      window.removeEventListener(UPDATES_DRAWER_OPEN_EVENT, handleUpdatesOpen);
      window.removeEventListener(HELP_DRAWER_OPEN_EVENT, handleHelpOpen);
    };
  }, [closeModal]);

  if (!initialAuthed || !isEligibleRoute || loading || updates.length === 0) {
    return null;
  }

  const portalTarget = typeof document !== "undefined" ? document.body : null;

  return (
    <>
      {portalTarget &&
        createPortal(
          <>
            {open && (
              <div className="fixed inset-0 z-[1002] flex items-center justify-center px-4">
                <button
                  type="button"
                  className="fixed inset-0 bg-slate-900/40"
                  aria-label="Close onboarding"
                  onClick={() => void dismissAndClose()}
                />
                <div
                  ref={modalRef}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="updates-onboarding-title"
                  tabIndex={-1}
                  className="relative w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
                  data-testid="updates-onboarding"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Updates</p>
                      <h2
                        id="updates-onboarding-title"
                        className="mt-1 text-2xl font-semibold text-slate-900"
                      >
                        What’s new on PropatyHub
                      </h2>
                      <p className="mt-2 text-sm text-slate-600">
                        Catch up on the latest changes, then jump back in.
                      </p>
                    </div>
                    <Button
                      ref={closeButtonRef}
                      variant="secondary"
                      size="sm"
                      onClick={() => void dismissAndClose()}
                    >
                      Close
                    </Button>
                  </div>

                  <div className="mt-5 space-y-3">
                    {updates.map((update) => (
                      <div
                        key={update.id}
                        className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:flex-row sm:items-start"
                      >
                        {update.image_url && (
                          <div className="relative h-20 w-full overflow-hidden rounded-xl sm:h-20 sm:w-28">
                            <Image
                              src={update.image_url}
                              alt="Update preview"
                              fill
                              sizes="(max-width: 640px) 100vw, 120px"
                              className="object-cover"
                            />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900">{update.title}</p>
                          <p className="mt-1 text-sm text-slate-600">
                            {truncateSummary(update.summary)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <Button
                      onClick={async () => {
                        await dismissAndClose();
                        openProductUpdatesDrawer();
                      }}
                      data-testid="updates-onboarding-open"
                    >
                      Open inbox
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={async () => {
                        await dismissAndClose();
                      }}
                      data-testid="updates-onboarding-dismiss"
                    >
                      Not now
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>,
          portalTarget
        )}
    </>
  );
}
