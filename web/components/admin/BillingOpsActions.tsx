"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

const planOptions = ["free", "starter", "pro", "tenant_pro"] as const;

type Props = {
  profileId: string;
  email: string | null;
  currentPlan: string;
  billingSource: string;
  validUntil: string | null;
  billingNotes: string | null;
  billingNotesUpdatedAt: string | null;
  canReturnToProviderBilling: boolean;
  returnToProviderBillingHint: string | null;
  replayableEvents: Array<{
    eventId: string;
    eventType: string;
    status: string | null;
    reason: string | null;
    createdAt: string | null;
  }>;
  showBillingTestReset: boolean;
  canResetBillingTestAccount: boolean;
  billingTestResetStatus: "not_test_account" | "blocked_active_subscription" | "ready_now" | "reset_available";
  billingTestResetHint: string | null;
};

type Status = "idle" | "loading" | "done" | "error";

function toDateInput(value: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

export function BillingOpsActions({
  profileId,
  email,
  currentPlan,
  billingSource,
  validUntil,
  billingNotes,
  billingNotesUpdatedAt,
  canReturnToProviderBilling,
  returnToProviderBillingHint,
  replayableEvents,
  showBillingTestReset,
  canResetBillingTestAccount,
  billingTestResetStatus,
  billingTestResetHint,
}: Props) {
  const router = useRouter();
  const [planTier, setPlanTier] = useState(currentPlan);
  const [validUntilValue, setValidUntilValue] = useState(toDateInput(validUntil));
  const [actionStatus, setActionStatus] = useState<Status>("idle");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [notes, setNotes] = useState(billingNotes || "");
  const [noteStatus, setNoteStatus] = useState<Status>("idle");
  const [noteMessage, setNoteMessage] = useState<string | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [selectedReplayEventId, setSelectedReplayEventId] = useState(replayableEvents[0]?.eventId ?? "");

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
    router.refresh();
  };

  const refreshSnapshot = () => {
    setActionStatus("idle");
    setActionMessage("Billing snapshot refreshed.");
    router.refresh();
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
    if (!actionReason.trim()) {
      setActionStatus("error");
      setActionMessage("Reason is required to expire a plan.");
      return;
    }
    await runAction(
      {
        action: "expire_now",
        profileId,
        reason: actionReason.trim(),
      },
      "Plan expired."
    );
  };

  const setPlan = async () => {
    const ok = confirm("Apply a manual plan override?");
    if (!ok) return;
    if (!actionReason.trim()) {
      setActionStatus("error");
      setActionMessage("Reason is required for plan changes.");
      return;
    }
    await runAction(
      {
        action: "set_plan_tier",
        profileId,
        planTier,
        validUntil: validUntilValue ? `${validUntilValue}T23:59:59.999Z` : null,
        reason: actionReason.trim(),
      },
      "Plan updated."
    );
  };

  const returnToProviderBilling = async () => {
    const ok = confirm(
      "Clear the manual override and restore provider-owned billing from Stripe for this account?"
    );
    if (!ok) return;
    if (!canReturnToProviderBilling) {
      setActionStatus("error");
      setActionMessage(returnToProviderBillingHint || "No recoverable Stripe provider state was found.");
      return;
    }
    if (!actionReason.trim()) {
      setActionStatus("error");
      setActionMessage("Reason is required to return billing to the provider.");
      return;
    }
    await runAction(
      {
        action: "return_to_provider_billing",
        profileId,
        reason: actionReason.trim(),
      },
      "Manual override cleared. Billing was restored from Stripe."
    );
  };

  const replayStripeEvent = async () => {
    if (!selectedReplayEventId) {
      setActionStatus("error");
      setActionMessage("Select a replay-eligible Stripe event first.");
      return;
    }
    if (!actionReason.trim()) {
      setActionStatus("error");
      setActionMessage("Reason is required to replay a Stripe event.");
      return;
    }
    const ok = confirm("Replay the selected Stripe webhook event for this account?");
    if (!ok) return;
    setActionStatus("loading");
    setActionMessage(null);
    const res = await fetch("/api/admin/billing/stripe/replay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: selectedReplayEventId,
        reason: actionReason.trim(),
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setActionStatus("error");
      setActionMessage(data?.error || `Replay failed (${res.status})`);
      return;
    }
    const data = await res.json().catch(() => ({}));
    setActionStatus("done");
    setActionMessage(
      data?.status === "processed"
        ? "Stripe event replayed and processed."
        : `Replay completed with status: ${data?.status || "unknown"}.`
    );
    router.refresh();
  };

  const resetBillingTestAccount = async () => {
    const ok = confirm(
      "Reset this billing test account to a free expired-manual baseline? Historical subscriptions and webhook records will be preserved."
    );
    if (!ok) return;
    if (!canResetBillingTestAccount) {
      setActionStatus("error");
      setActionMessage(
        billingTestResetHint ||
          "This account cannot be reset right now. Cancel any active subscription first and confirm it is a designated test account."
      );
      return;
    }
    if (!actionReason.trim()) {
      setActionStatus("error");
      setActionMessage("Reason is required to reset a billing test account.");
      return;
    }
    await runAction(
      {
        action: "reset_billing_test_account",
        profileId,
        reason: actionReason.trim(),
      },
      "Billing test account reset to a reusable free baseline."
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
        Loaded account: {email || profileId}. Manual overrides take precedence over Stripe. Current source:{" "}
        {billingSource || "manual"}.
      </p>
      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        <p className="font-semibold text-slate-700">Operator guidance</p>
        <ul className="mt-2 space-y-1">
          <li>Use <span className="font-semibold">Return to Stripe billing</span> only when manual override is masking stored Stripe truth.</li>
          <li>Use <span className="font-semibold">Replay Stripe event</span> only after the underlying cause has been fixed.</li>
          <li><span className="font-semibold">Reset billing test account</span> never deletes historical subscriptions, webhook rows, or revenue records.</li>
        </ul>
      </div>

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
        {billingSource === "manual" && (
          <Button
            size="sm"
            variant="secondary"
            type="button"
            onClick={returnToProviderBilling}
            disabled={actionStatus === "loading" || !canReturnToProviderBilling}
          >
            Return to Stripe billing
          </Button>
        )}
        <Button size="sm" variant="secondary" type="button" onClick={refreshSnapshot} disabled={actionStatus === "loading"}>
          Refresh billing snapshot
        </Button>
      </div>
      {billingSource === "manual" && (
        <p className="mt-2 text-xs text-slate-500">
          {returnToProviderBillingHint ||
            "Use this when a paid Stripe account is still masked by a manual support override."}
        </p>
      )}

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-semibold text-slate-700">Billing test account reset</p>
        <p className="mt-1 text-xs text-slate-500">
          Internal use only. Reset clears current <code>profile_plans</code> state back to free and preserves
          historical subscriptions, Stripe webhook events, and revenue records.
        </p>
        <p className="mt-2 text-xs text-slate-600">
          {billingTestResetHint ||
            "Reset is available only for designated internal test accounts. Active provider subscriptions must be cancelled first."}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2 py-1 text-xs ${
              billingTestResetStatus === "ready_now"
                ? "bg-emerald-100 text-emerald-700"
                : billingTestResetStatus === "reset_available"
                ? "bg-cyan-100 text-cyan-700"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {billingTestResetStatus === "ready_now"
              ? "Reusable now"
              : billingTestResetStatus === "reset_available"
              ? "Reset available"
              : billingTestResetStatus === "blocked_active_subscription"
              ? "Blocked by active subscription"
              : "Not a test account"}
          </span>
          {showBillingTestReset && (
            <Button
              size="sm"
              variant="secondary"
              type="button"
              onClick={resetBillingTestAccount}
              disabled={actionStatus === "loading" || !canResetBillingTestAccount}
            >
              Reset billing test account
            </Button>
          )}
        </div>
      </div>

      <div className="mt-4">
        <label className="text-xs font-semibold text-slate-700">
          Reason (required for plan changes, provider recovery, and replay)
          <input
            className="mt-2 w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
            value={actionReason}
            onChange={(event) => setActionReason(event.target.value)}
            placeholder="e.g. Chargeback, manual downgrade request"
            disabled={actionStatus === "loading"}
          />
        </label>
      </div>

      {actionMessage && (
        <div
          className={`mt-4 rounded-xl border px-3 py-2 text-xs ${
            actionStatus === "error"
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {actionMessage}
        </div>
      )}

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-semibold text-slate-700">Replay Stripe event</p>
        <p className="mt-1 text-xs text-slate-500">
          Reprocess an ignored or failed Stripe webhook for this loaded account using the normal provider-owned path.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <select
            className="min-w-[18rem] rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
            value={selectedReplayEventId}
            onChange={(event) => setSelectedReplayEventId(event.target.value)}
            disabled={actionStatus === "loading" || replayableEvents.length === 0}
          >
            {replayableEvents.length === 0 ? (
              <option value="">No replay-eligible events</option>
            ) : (
              replayableEvents.map((event) => (
                <option key={event.eventId} value={event.eventId}>
                  {event.eventType} • {event.status || "received"} • {event.reason || "no reason"} •{" "}
                  {(event.createdAt || "").replace("T", " ").replace("Z", "") || "—"}
                </option>
              ))
            )}
          </select>
          <Button
            size="sm"
            variant="secondary"
            type="button"
            onClick={replayStripeEvent}
            disabled={actionStatus === "loading" || replayableEvents.length === 0}
          >
            Replay Stripe event
          </Button>
        </div>
        {!replayableEvents.length && (
          <p className="mt-2 text-xs text-slate-500">
            No ignored or failed Stripe events are currently eligible for replay on this account.
          </p>
        )}
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
