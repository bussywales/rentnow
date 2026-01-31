"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { CONTACT_EXCHANGE_BLOCK_CODE } from "@/lib/messaging/contact-exchange";
import {
  LEAD_FINANCING,
  LEAD_INTENTS,
  LEAD_TIMELINES,
  type LeadFinancing,
  type LeadIntent,
  type LeadTimeline,
} from "@/lib/leads/types";

type Props = {
  propertyId: string;
  disabled?: boolean;
};

export function EnquireToBuyButton({ propertyId, disabled }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [financingStatus, setFinancingStatus] = useState<LeadFinancing>("UNDECIDED");
  const [timeline, setTimeline] = useState<LeadTimeline>("ASAP");
  const [intent, setIntent] = useState<LeadIntent>("BUY");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);

  const budgetHint = useMemo(() => {
    if (!budgetMin && !budgetMax) return null;
    return `${budgetMin || "Any"} – ${budgetMax || "Any"}`;
  }, [budgetMin, budgetMax]);

  const reset = () => {
    setBudgetMin("");
    setBudgetMax("");
    setFinancingStatus("UNDECIDED");
    setTimeline("ASAP");
    setIntent("BUY");
    setMessage("");
    setConsent(false);
    setError(null);
  };

  const handleSubmit = async () => {
    setError(null);
    if (message.trim().length < 10) {
      setError("Please include a short message (10+ characters).");
      return;
    }
    if (!consent) {
      setError("Please confirm you will keep communication in-app.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: propertyId,
          budget_min: budgetMin || null,
          budget_max: budgetMax || null,
          financing_status: financingStatus,
          timeline,
          intent,
          message: message.trim(),
          consent,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.code === CONTACT_EXCHANGE_BLOCK_CODE) {
          setError(data?.message || "Contact details can’t be shared.");
          return;
        }
        setError(data?.error || "Unable to send enquiry.");
        return;
      }
      const threadId = data?.thread_id as string | undefined;
      if (threadId) {
        setOpen(false);
        reset();
        router.push(`/dashboard/messages?thread=${threadId}`);
        return;
      }
      setError("Enquiry sent. Check your messages.");
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={disabled}>
        Enquire to buy
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Enquire to buy</p>
                <p className="text-xs text-slate-600">
                  Send a verified lead to the host/agent.
                </p>
              </div>
              <button
                type="button"
                className="text-sm font-semibold text-slate-500 hover:text-slate-700"
                onClick={() => setOpen(false)}
                aria-label="Close enquiry"
              >
                ×
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto px-4 py-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Budget min</label>
                  <Input
                    type="number"
                    value={budgetMin}
                    onChange={(e) => setBudgetMin(e.target.value)}
                    placeholder="e.g. 50000"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Budget max</label>
                  <Input
                    type="number"
                    value={budgetMax}
                    onChange={(e) => setBudgetMax(e.target.value)}
                    placeholder="e.g. 150000"
                  />
                </div>
              </div>
              {budgetHint && (
                <p className="text-xs text-slate-500">Budget: {budgetHint}</p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Financing</label>
                  <select
                    className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm"
                    value={financingStatus}
                    onChange={(event) =>
                      setFinancingStatus(event.target.value as LeadFinancing)
                    }
                  >
                    {LEAD_FINANCING.map((option) => (
                      <option key={option} value={option}>
                        {option.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Timeline</label>
                  <select
                    className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm"
                    value={timeline}
                    onChange={(event) => setTimeline(event.target.value as LeadTimeline)}
                  >
                    {LEAD_TIMELINES.map((option) => (
                      <option key={option} value={option}>
                        {option.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Intent</label>
                <select
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm"
                  value={intent}
                  onChange={(event) => setIntent(event.target.value as LeadIntent)}
                >
                  {LEAD_INTENTS.map((option) => (
                    <option key={option} value={option}>
                      {option.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Message</label>
                <Textarea
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your buying criteria, timing, and any must-haves."
                />
              </div>
              <label className="flex items-start gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300"
                />
                Keep communication in-app for safety.
              </label>
              {error && <p className="text-xs text-rose-600">{error}</p>}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Sending..." : "Send enquiry"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
