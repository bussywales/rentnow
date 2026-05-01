"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

type ResponseAction = "accept" | "decline" | "need_more_information";

type Props = {
  token: string;
  currentStatus: string;
  existingResponseNote?: string | null;
  existingQuoteSummary?: string | null;
};

export function MoveReadyProviderResponseForm({
  token,
  currentStatus,
  existingResponseNote = null,
  existingQuoteSummary = null,
}: Props) {
  const [action, setAction] = useState<ResponseAction>("accept");
  const [responseNote, setResponseNote] = useState(existingResponseNote ?? "");
  const [quoteSummary, setQuoteSummary] = useState(existingQuoteSummary ?? "");
  const [resolvedStatus, setResolvedStatus] = useState(currentStatus);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ tone: "success" | "error"; message: string } | null>(
    null
  );

  const finalised = ["accepted", "declined", "needs_more_information", "awarded"].includes(
    resolvedStatus
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setResult(null);

    const response = await fetch("/api/services/provider/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        action,
        quoteSummary: quoteSummary || null,
        responseNote: responseNote || null,
      }),
    }).catch(() => null);

    setSubmitting(false);

    if (!response) {
      setResult({ tone: "error", message: "Unable to submit the response right now." });
      return;
    }

    const payload = (await response.json().catch(() => null)) as { error?: string; status?: string } | null;
    if (!response.ok) {
      setResult({ tone: "error", message: payload?.error || "Unable to submit the response." });
      return;
    }

    setResolvedStatus(payload?.status || resolvedStatus);
    setResult({
      tone: "success",
      message:
        action === "accept"
          ? "Interest recorded. The operator will review your note and coordinate the next step."
          : action === "need_more_information"
          ? "Your request for more information has been recorded for operator follow-through."
          : "Lead declined. The operator can now route the request elsewhere.",
    });
  }

  if (finalised) {
    return (
      <Alert
        variant="info"
        title="Lead already responded"
        description={existingResponseNote || "This lead already has a recorded response."}
      />
    );
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit} data-testid="move-ready-provider-response-form">
      {result ? (
        <Alert
          variant={result.tone === "success" ? "success" : "error"}
          title={result.tone === "success" ? "Response saved" : "Response not saved"}
          description={result.message}
        />
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setAction("accept")}
          className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
            action === "accept"
              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
              : "border-slate-200 bg-white text-slate-700"
          }`}
        >
          Interested / available
        </button>
        <button
          type="button"
          onClick={() => setAction("need_more_information")}
          className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
            action === "need_more_information"
              ? "border-amber-300 bg-amber-50 text-amber-900"
              : "border-slate-200 bg-white text-slate-700"
          }`}
        >
          Need more information
        </button>
        <button
          type="button"
          onClick={() => setAction("decline")}
          className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
            action === "decline"
              ? "border-rose-300 bg-rose-50 text-rose-900"
              : "border-slate-200 bg-white text-slate-700"
          }`}
        >
          Decline lead
        </button>
      </div>

      <label className="block space-y-1 text-sm font-medium text-slate-700">
        Indicative quote or range (optional)
        <input
          value={quoteSummary}
          onChange={(event) => setQuoteSummary(event.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
          placeholder="Example: NGN 120,000 to 150,000"
        />
      </label>

      <label className="block space-y-1 text-sm font-medium text-slate-700">
        Short note
        <textarea
          value={responseNote}
          onChange={(event) => setResponseNote(event.target.value)}
          className="min-h-[140px] w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm text-slate-900"
          placeholder="Share availability, clarifying questions, or the next operator-facing detail."
        />
      </label>

      <Button type="submit" disabled={submitting}>
        {submitting ? "Saving..." : "Send response"}
      </Button>
    </form>
  );
}
