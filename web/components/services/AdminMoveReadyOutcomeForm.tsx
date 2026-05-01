"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

type AwardCandidate = {
  providerId: string;
  businessName: string;
  responseStatus: string;
  quoteSummary?: string | null;
  responseNote?: string | null;
};

type Props = {
  requestId: string;
  currentStatus: string;
  awardCandidates: AwardCandidate[];
};

export function AdminMoveReadyOutcomeForm({ requestId, currentStatus, awardCandidates }: Props) {
  const router = useRouter();
  const [submittingAction, setSubmittingAction] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);

  const finalised = ["awarded", "closed_no_match", "closed"].includes(currentStatus);

  async function submit(body: Record<string, unknown>, actionKey: string, successMessage: string) {
    setSubmittingAction(actionKey);
    setMessage(null);

    const response = await fetch(`/api/admin/services/requests/${requestId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);

    setSubmittingAction(null);

    if (!response) {
      setMessage({ tone: "error", text: "Unable to update the request outcome right now." });
      return;
    }

    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setMessage({ tone: "error", text: payload?.error || "Unable to update the request outcome." });
      return;
    }

    setMessage({ tone: "info", text: successMessage });
    router.refresh();
  }

  if (finalised) {
    return (
      <Alert
        variant="info"
        title="Request outcome locked"
        description="This request already has a final operator outcome recorded."
      />
    );
  }

  return (
    <div className="space-y-4" data-testid="move-ready-outcome-form">
      {message ? (
        <Alert
          variant={message.tone === "error" ? "error" : "info"}
          title={message.tone === "error" ? "Outcome not saved" : "Outcome saved"}
          description={message.text}
        />
      ) : null}

      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Award a responding provider</h3>
          <p className="mt-1 text-sm text-slate-600">
            Keep PropatyHub as the intermediary. Award the supplier internally instead of exposing direct contact handoff here.
          </p>
        </div>
        {awardCandidates.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">
            No positive provider responses are ready for award yet.
          </p>
        ) : (
          <div className="space-y-3">
            {awardCandidates.map((candidate) => {
              const actionKey = `award:${candidate.providerId}`;
              return (
                <div key={candidate.providerId} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{candidate.businessName}</p>
                      <p className="text-sm text-slate-600">{candidate.responseStatus}</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() =>
                        submit(
                          { action: "award", providerId: candidate.providerId },
                          actionKey,
                          "Provider awarded. Operator follow-through can continue from this request."
                        )
                      }
                      disabled={submittingAction !== null}
                    >
                      {submittingAction === actionKey ? "Awarding..." : "Award request"}
                    </Button>
                  </div>
                  {candidate.quoteSummary ? (
                    <p className="mt-3 text-sm text-slate-700">Indicative quote: {candidate.quoteSummary}</p>
                  ) : null}
                  {candidate.responseNote ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{candidate.responseNote}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-sm font-semibold text-slate-900">No-match closure</h3>
        <p className="mt-1 text-sm text-slate-600">
          Use this only when vetted supplier follow-through is exhausted and there is no safe provider to award.
        </p>
        <div className="mt-3">
          <Button
            variant="secondary"
            onClick={() =>
              submit(
                { action: "close_no_match" },
                "close_no_match",
                "Request closed as no match."
              )
            }
            disabled={submittingAction !== null}
          >
            {submittingAction === "close_no_match" ? "Closing..." : "Close as no match"}
          </Button>
        </div>
      </div>
    </div>
  );
}
