"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { HelpArticleRenderer } from "@/components/help/articles/HelpArticleRenderer";
import {
  HELP_DRAWER_CLOSE_EVENT,
  HELP_DRAWER_OPEN_EVENT,
  UPDATES_DRAWER_CLOSE_EVENT,
  dispatchOverlayEvent,
  openHelpDrawer,
} from "@/lib/ui/overlay-events";
import { getRelatedHelpLinks, resolveHelpContext, type HelpContextRole } from "@/lib/help/help-context";
import type { UserRole } from "@/lib/types";

type HelpDocPayload = {
  slug: string;
  title: string;
  description: string;
  updatedAt: string;
  body: string;
};

type HelpDocsByRole = Record<HelpContextRole, HelpDocPayload[]>;

type Props = {
  initialAuthed: boolean;
  initialRole?: UserRole | "super_admin" | null;
  docsByRole: HelpDocsByRole;
};

function normalizeViewerRole(role: UserRole | "super_admin" | null | undefined): HelpContextRole {
  if (role === "admin" || role === "super_admin") return "admin";
  if (role === "agent") return "agent";
  if (role === "landlord") return "landlord";
  return "tenant";
}

function resolveHelpIndexHref(role: HelpContextRole) {
  return `/help/${role}`;
}

export function HelpDrawer({ initialAuthed, initialRole = null, docsByRole }: Props) {
  const viewerRole = normalizeViewerRole(initialRole);
  const canShow = initialAuthed;
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousActiveRef = useRef<HTMLElement | null>(null);
  const bodyOverflowRef = useRef<string>("");

  const context = useMemo(
    () => resolveHelpContext({ pathname, role: viewerRole }),
    [pathname, viewerRole]
  );

  const activeDoc = useMemo(() => {
    const docs = docsByRole[context.role] ?? [];
    return docs.find((doc) => doc.slug === context.slug) ?? docs[0] ?? null;
  }, [context.role, context.slug, docsByRole]);

  const relatedDocs = useMemo(() => {
    if (!activeDoc) return [];
    const related = getRelatedHelpLinks({
      role: context.role,
      currentSlug: activeDoc.slug,
    });
    const docs = docsByRole[context.role] ?? [];
    return related
      .map((item) => {
        const match = docs.find((doc) => doc.slug === item.slug);
        if (!match) return null;
        return {
          slug: item.slug,
          section: item.section,
          title: match.title,
          href: `/help/${context.role}/${match.slug}`,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  }, [activeDoc, context.role, docsByRole]);

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
    setOpen(true);
  }, []);

  useEffect(() => {
    if (!canShow || typeof window === "undefined") return undefined;
    const handleOpen = () => openDrawer();
    const handleClose = () => closeDrawer();
    window.addEventListener(HELP_DRAWER_OPEN_EVENT, handleOpen);
    window.addEventListener(HELP_DRAWER_CLOSE_EVENT, handleClose);
    return () => {
      window.removeEventListener(HELP_DRAWER_OPEN_EVENT, handleOpen);
      window.removeEventListener(HELP_DRAWER_CLOSE_EVENT, handleClose);
    };
  }, [canShow, closeDrawer, openDrawer]);

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
      if (!focusable.length) return;
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
        onClick={() => openHelpDrawer()}
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
                          Guided Help Centre
                        </h2>
                        <p className="text-xs text-slate-500">
                          You&apos;re viewing help for: {context.section}
                        </p>
                      </div>
                      <Button ref={closeButtonRef} variant="secondary" size="sm" onClick={closeDrawer}>
                        Close
                      </Button>
                    </div>

                    <div className="flex-1 overflow-y-auto px-6 py-5">
                      {activeDoc ? (
                        <div className="space-y-5">
                          <section className="rounded-2xl border border-slate-200 bg-white p-4">
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                              {context.role} guide
                            </p>
                            <h3 className="mt-2 text-xl font-semibold text-slate-900">{activeDoc.title}</h3>
                            <p className="mt-1 text-sm text-slate-600">{activeDoc.description}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                              <span>Last updated {activeDoc.updatedAt}</span>
                              <span>•</span>
                              <Link
                                href={`/help/${context.role}/${activeDoc.slug}`}
                                onClick={closeDrawer}
                                className="font-semibold text-slate-800 underline underline-offset-4"
                              >
                                Open full page
                              </Link>
                            </div>
                          </section>

                          <article className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
                            <HelpArticleRenderer source={activeDoc.body} />
                          </article>

                          {relatedDocs.length > 0 ? (
                            <section className="rounded-2xl border border-slate-200 bg-white p-4">
                              <h3 className="text-sm font-semibold text-slate-900">Related articles</h3>
                              <div className="mt-3 space-y-2">
                                {relatedDocs.map((item) => (
                                  <Link
                                    key={item.slug}
                                    href={item.href}
                                    onClick={closeDrawer}
                                    className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                                  >
                                    {item.title}
                                    <span className="text-xs font-normal text-slate-500">{item.section}</span>
                                  </Link>
                                ))}
                              </div>
                            </section>
                          ) : null}

                          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <h3 className="text-sm font-semibold text-slate-900">Still stuck?</h3>
                            <p className="mt-1 text-xs text-slate-600">
                              Contact support and include the page you&apos;re on plus what you already tried.
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <a
                                href="mailto:support@propatyhub.com?subject=Help%20request%20from%20PropatyHub"
                                className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                Email support
                              </a>
                              <Link
                                href={resolveHelpIndexHref(context.role)}
                                onClick={closeDrawer}
                                className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                Browse all {context.role} guides
                              </Link>
                              <Link
                                href="/help/troubleshooting/using-help-drawer"
                                onClick={closeDrawer}
                                className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                Using the help drawer
                              </Link>
                            </div>
                          </section>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                          We couldn&apos;t load a contextual article for this page.
                          <div className="mt-2">
                            <Link
                              href={resolveHelpIndexHref(context.role)}
                              onClick={closeDrawer}
                              className="font-semibold text-slate-800 underline underline-offset-4"
                            >
                              Open help index
                            </Link>
                          </div>
                        </div>
                      )}
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
