"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

type Props = {
  token: string;
  currentStatus: string;
  existingResponseNote?: string | null;
};

export function MoveReadyProviderResponseForm({
  token,
  currentStatus,
  existingResponseNote = null,
}: Props) {
  const [action, setAction] = useState<"accept" | "decline">("accept");
  const [responseNote, setResponseNote] = useState(existingResponseNote ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ tone: "success" | "error"; message: string } | null>(
    null
  );

  const finalised = currentStatus === "accepted" || currentStatus === "declined";

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
        responseNote: responseNote || null,
      }),
    }).catch(() => null);

    setSubmitting(false);

    if (!response) {
      setResult({ tone: "error", message: "Unable to submit the response right now." });
      return;
    }

    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setResult({ tone: "error", message: payload?.error || "Unable to submit the response." });
      return;
    }

    setResult({
      tone: "success",
      message:
        action === "accept"
          ? "Lead accepted. The operator can now follow through with your note."
          : "Lead declined. The operator can route the request elsewhere.",
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
          Accept lead
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
        Short note
        <textarea
          value={responseNote}
          onChange={(event) => setResponseNote(event.target.value)}
          className="min-h-[140px] w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm text-slate-900"
          placeholder="Share a short availability or quote note for the operator and host."
        />
      </label>

      <Button type="submit" disabled={submitting}>
        {submitting ? "Saving..." : "Send response"}
      </Button>
    </form>
  );
}
