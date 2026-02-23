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

type Props = {
  prefillName?: string | null;
  prefillEmail?: string | null;
  prefillRole?: string | null;
};

function mapEscalationReasonToCategory(reason: string | null) {
  if (!reason) return "general";
  if (reason.includes("charge")) return "billing";
  if (reason.includes("keyword")) return "safety";
  if (reason.includes("booking")) return "listing";
  return "general";
}

export function SupportWidget({
  prefillName = null,
  prefillEmail = null,
  prefillRole = null,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [shouldEscalate, setShouldEscalate] = useState(false);
  const [escalationReason, setEscalationReason] = useState<string | null>(null);
  const [contactName, setContactName] = useState(prefillName ?? "");
  const [contactEmail, setContactEmail] = useState(prefillEmail ?? "");
  const [escalationNote, setEscalationNote] = useState("");
  const [showEscalationForm, setShowEscalationForm] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [escalationTicketId, setEscalationTicketId] = useState<string | null>(null);
  const [escalationError, setEscalationError] = useState<string | null>(null);
  const [suggested, setSuggested] = useState<Array<{ title: string; href: string; snippet: string }>>([]);
  const [searching, setSearching] = useState(false);
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

  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggested([]);
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(
          `/api/support/help-search?q=${encodeURIComponent(trimmed)}&limit=4`,
          { signal: controller.signal }
        );
        const body = await response.json().catch(() => null);
        if (!response.ok) {
          setSuggested([]);
          return;
        }
        const results = Array.isArray(body?.results) ? body.results : [];
        setSuggested(
          results.map((item: { title?: string; href?: string; snippet?: string }) => ({
            title: item.title || "Support article",
            href: item.href || "/support",
            snippet: item.snippet || "",
          }))
        );
      } catch {
        setSuggested([]);
      } finally {
        setSearching(false);
      }
    }, 220);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [open, query]);

  useEffect(() => {
    if (!shouldEscalate || escalationNote.trim()) return;
    const latestUserMessage = [...chatMessages].reverse().find((item) => item.role === "user");
    if (!latestUserMessage?.content) return;
    setEscalationNote(latestUserMessage.content);
  }, [chatMessages, escalationNote, shouldEscalate]);

  const handleAssistantSend = useCallback(async () => {
    const message = chatInput.trim();
    if (!message || assistantBusy) return;

    const nextHistory = [...chatMessages, { role: "user" as const, content: message }];
    setChatMessages(nextHistory);
    setChatInput("");
    setAssistantBusy(true);

    try {
      const response = await fetch("/api/support/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          history: chatMessages,
        }),
      });

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setChatMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "I could not process that right now. Please open full support so we can help directly.",
          },
        ]);
        setShouldEscalate(true);
        setEscalationReason("assistant_error");
        return;
      }

      const assistantReply =
        typeof body?.answer === "string" && body.answer.trim().length
          ? body.answer.trim()
          : "I found related help guidance above.";
      setChatMessages((prev) => [...prev, { role: "assistant", content: assistantReply }]);
      setShouldEscalate(Boolean(body?.shouldEscalate));
      setEscalationReason(typeof body?.escalationReason === "string" ? body.escalationReason : null);
      if (Array.isArray(body?.suggestedArticles) && body.suggestedArticles.length > 0) {
        setSuggested(
          body.suggestedArticles.map(
            (item: { title?: string; href?: string; snippet?: string }) => ({
              title: item.title || "Support article",
              href: item.href || "/support",
              snippet: item.snippet || "",
            })
          )
        );
      }
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Network issue detected. Please try again or escalate to support.",
        },
      ]);
      setShouldEscalate(true);
      setEscalationReason("network_error");
    } finally {
      setAssistantBusy(false);
    }
  }, [assistantBusy, chatInput, chatMessages]);

  const handleEscalateSubmit = useCallback(async () => {
    if (!shouldEscalate || escalating) return;
    const message = escalationNote.trim();
    if (message.length < 10) {
      setEscalationError("Add a bit more detail before escalating.");
      return;
    }
    if (!contactEmail.trim()) {
      setEscalationError("Email is required so support can reply.");
      return;
    }

    setEscalationError(null);
    setEscalating(true);
    try {
      const response = await fetch("/api/support/escalate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: mapEscalationReasonToCategory(escalationReason),
          name: contactName.trim() || null,
          email: contactEmail.trim(),
          role: prefillRole || null,
          message,
          pageUrl: typeof window !== "undefined" ? window.location.href : null,
          escalationReason,
          aiTranscript: chatMessages,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setEscalationError(body?.error || "Unable to escalate right now.");
        return;
      }
      setEscalationTicketId(typeof body?.requestId === "string" ? body.requestId : "submitted");
      setShowEscalationForm(false);
    } catch {
      setEscalationError("Unable to escalate right now.");
    } finally {
      setEscalating(false);
    }
  }, [
    shouldEscalate,
    escalating,
    escalationNote,
    contactEmail,
    escalationReason,
    contactName,
    prefillRole,
    chatMessages,
  ]);

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

          {query.trim().length >= 2 ? (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Suggested articles
              </p>
              {searching ? (
                <p className="mt-2 text-xs text-slate-500">Searching help docs…</p>
              ) : suggested.length ? (
                <div className="mt-2 space-y-2" data-testid="support-widget-suggested-results">
                  {suggested.map((item) => (
                    <Link
                      key={`${item.href}:${item.title}`}
                      href={item.href}
                      onClick={close}
                      className="block rounded-lg border border-slate-200 bg-white px-3 py-2 transition hover:bg-slate-50"
                    >
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      {item.snippet ? (
                        <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{item.snippet}</p>
                      ) : null}
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-500">No direct match yet. You can escalate to support.</p>
              )}
            </div>
          ) : null}

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

          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Ask assistant</p>
              {assistantBusy ? <p className="text-xs text-slate-400">Thinking…</p> : null}
            </div>

            <div className="mt-2 max-h-40 space-y-2 overflow-y-auto pr-1" data-testid="support-widget-chat-thread">
              {chatMessages.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Ask a support question and I&apos;ll answer from our help docs.
                </p>
              ) : (
                chatMessages.map((message, index) => (
                  <div
                    key={`${message.role}:${index}`}
                    className={`rounded-lg px-3 py-2 text-xs ${
                      message.role === "user"
                        ? "ml-6 bg-sky-50 text-sky-900"
                        : "mr-6 bg-slate-100 text-slate-700"
                    }`}
                  >
                    {message.content}
                  </div>
                ))
              )}
            </div>

            <div className="mt-2 flex gap-2">
              <input
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" || event.shiftKey) return;
                  event.preventDefault();
                  void handleAssistantSend();
                }}
                placeholder="Ask about bookings, payments, approvals..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                data-testid="support-widget-chat-input"
              />
              <Button
                type="button"
                onClick={() => void handleAssistantSend()}
                disabled={assistantBusy || chatInput.trim().length < 2}
                size="sm"
              >
                Ask
              </Button>
            </div>

            {shouldEscalate ? (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-xs text-amber-800">
                  This looks like it needs human follow-up{escalationReason ? ` (${escalationReason})` : ""}.
                </p>
                {escalationTicketId ? (
                  <p className="mt-1 text-xs font-semibold text-emerald-800" data-testid="support-widget-ticket">
                    Ticket received — reference #{escalationTicketId}
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowEscalationForm((prev) => !prev)}
                    className="mt-1 inline-flex text-xs font-semibold text-amber-900 underline underline-offset-4"
                    data-testid="support-widget-escalate"
                  >
                    Escalate to Support
                  </button>
                )}

                {showEscalationForm ? (
                  <div className="mt-2 space-y-2 rounded-lg border border-amber-200 bg-white p-2">
                    <input
                      value={contactName}
                      onChange={(event) => setContactName(event.target.value)}
                      placeholder="Name (optional)"
                      className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-sky-500"
                    />
                    <input
                      value={contactEmail}
                      onChange={(event) => setContactEmail(event.target.value)}
                      placeholder="Email"
                      type="email"
                      className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-sky-500"
                    />
                    <textarea
                      value={escalationNote}
                      onChange={(event) => setEscalationNote(event.target.value)}
                      rows={3}
                      placeholder="Tell us what is failing and what you already tried."
                      className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-sky-500"
                    />
                    {escalationError ? <p className="text-xs text-rose-600">{escalationError}</p> : null}
                    <Button type="button" size="sm" onClick={() => void handleEscalateSubmit()} disabled={escalating}>
                      {escalating ? "Sending…" : "Send to support"}
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
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
