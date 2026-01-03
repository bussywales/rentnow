"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

const planOptions = ["free", "starter", "pro", "tenant_pro"] as const;

type Props = {
  profileId: string;
  currentPlan: string;
  billingSource: string;
  validUntil: string | null;
  billingNotes: string | null;
  billingNotesUpdatedAt: string | null;
};

type Status = "idle" | "loading" | "done" | "error";

function toDateInput(value: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

export function BillingOpsActions({
  profileId,
  currentPlan,
  billingSource,
  validUntil,
  billingNotes,
  billingNotesUpdatedAt,
}: Props) {
  const [planTier, setPlanTier] = useState(currentPlan);
  const [validUntilValue, setValidUntilValue] = useState(toDateInput(validUntil));
  const [actionStatus, setActionStatus] = useState<Status>("idle");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [notes, setNotes] = useState(billingNotes || "");
  const [noteStatus, setNoteStatus] = useState<Status>("idle");
  const [noteMessage, setNoteMessage] = useState<string | null>(null);

  const runAction = async (body: Record<string, unknown>, message: string) => {
    setActionStatus("loading");
    setActionMessage(null);
    const res = await fetch("/api/admin/billing/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setActionStatus("error");
      setActionMessage(data?.error || `Action failed (${res.status})`);
      return;
    }
    setActionStatus("done");
    setActionMessage(message);
  };

  const extendValidUntil = async () => {
    const ok = confirm("Extend valid until by 30 days? This creates a manual override.");
    if (!ok) return;
    await runAction(
      {
        action: "extend_valid_until",
        profileId,
        days: 30,
      },
      "Extended by 30 days."
    );
  };

  const expireNow = async () => {
    const ok = confirm("Expire this plan immediately? This will restrict access.");
    if (!ok) return;
    await runAction(
      {
        action: "expire_now",
        profileId,
      },
      "Plan expired."
    );
  };

  const setPlan = async () => {
    const ok = confirm("Apply a manual plan override?");
    if (!ok) return;
    await runAction(
      {
        action: "set_plan_tier",
        profileId,
        planTier,
        validUntil: validUntilValue ? `${validUntilValue}T23:59:59.999Z` : null,
      },
      "Plan updated."
    );
  };

  const saveNotes = async () => {
    setNoteStatus("loading");
    setNoteMessage(null);
    const res = await fetch("/api/admin/billing/notes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profileId,
        note: notes,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setNoteStatus("error");
      setNoteMessage(data?.error || `Notes update failed (${res.status})`);
      return;
    }
    setNoteStatus("done");
    setNoteMessage("Notes saved.");
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-slate-900">Support actions</h3>
      <p className="mt-1 text-sm text-slate-600">
        Manual overrides take precedence over Stripe. Current source: {billingSource || "manual"}.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" type="button" onClick={extendValidUntil} disabled={actionStatus === "loading"}>
          Extend 30 days
        </Button>
        <Button
          size="sm"
          variant="secondary"
          type="button"
          onClick={expireNow}
          disabled={actionStatus === "loading"}
        >
          Expire now
        </Button>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-semibold text-slate-700">Set plan tier</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <label className="text-slate-600">
            Tier
            <select
              className="ml-2 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
              value={planTier}
              onChange={(event) => setPlanTier(event.target.value)}
              disabled={actionStatus === "loading"}
            >
              {planOptions.map((plan) => (
                <option key={plan} value={plan}>
                  {plan.replace("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="text-slate-600">
            Valid until
            <input
              className="ml-2 rounded-md border border-slate-300 px-2 py-1 text-xs"
              type="date"
              value={validUntilValue}
              onChange={(event) => setValidUntilValue(event.target.value)}
              disabled={actionStatus === "loading"}
            />
          </label>
          <Button
            size="sm"
            type="button"
            onClick={setPlan}
            disabled={actionStatus === "loading"}
          >
            {actionStatus === "loading" ? "Saving..." : "Apply plan"}
          </Button>
        </div>
        {actionMessage && <p className="mt-2 text-xs text-slate-600">{actionMessage}</p>}
        {actionStatus === "error" && !actionMessage && (
          <p className="mt-2 text-xs text-rose-600">Action failed.</p>
        )}
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-semibold text-slate-700">Billing notes</p>
        <p className="mt-1 text-xs text-slate-500">
          Last updated: {billingNotesUpdatedAt?.replace("T", " ").replace("Z", "") || "—"}
        </p>
        <textarea
          className="mt-2 w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
          rows={4}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          disabled={noteStatus === "loading"}
        />
        <div className="mt-2">
          <Button
            size="sm"
            type="button"
            variant="secondary"
            onClick={saveNotes}
            disabled={noteStatus === "loading"}
          >
            {noteStatus === "loading" ? "Saving..." : "Save notes"}
          </Button>
        </div>
        {noteMessage && <p className="mt-2 text-xs text-slate-600">{noteMessage}</p>}
        {noteStatus === "error" && !noteMessage && (
          <p className="mt-2 text-xs text-rose-600">Notes update failed.</p>
        )}
      </div>
    </div>
  );
}
