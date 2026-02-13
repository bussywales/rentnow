"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import type { VerificationStatus } from "@/lib/verification/status";
import { getCooldownRemaining, startCooldown } from "@/lib/auth/resendCooldown";
import type { VerificationRequirements } from "@/lib/trust-markers";
import { buildVerificationCenterState } from "@/lib/verification/center";
import type { UserRole } from "@/lib/types";

type Props = {
  initialStatus: VerificationStatus;
  requirements: VerificationRequirements;
  initialEmail?: string | null;
  viewerRole?: UserRole | null;
};

type OtpStage = "idle" | "sending" | "sent" | "verifying" | "verified";

function formatDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString();
}

function roleHelpHref(role?: UserRole | null) {
  if (role === "tenant") return "/help/tenant/verification";
  if (role === "landlord") return "/help/landlord/verification";
  if (role === "agent") return "/help/agent/verification";
  if (role === "admin") return "/help/admin/verification";
  return "/help";
}

function statusBadgeClass(label: string) {
  if (label === "Verified") return "bg-emerald-50 text-emerald-700";
  if (label === "Coming soon") return "bg-indigo-50 text-indigo-700";
  if (label === "Not required right now") return "bg-slate-100 text-slate-600";
  return "bg-amber-50 text-amber-700";
}

export default function VerificationCenterClient({
  initialStatus,
  requirements,
  initialEmail,
  viewerRole = null,
}: Props) {
  const [status, setStatus] = useState<VerificationStatus>(initialStatus);
  const [phoneInput, setPhoneInput] = useState(initialStatus.phone.phoneE164 ?? "");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<"supabase_phone_otp" | "email_fallback" | null>(null);
  const [stage, setStage] = useState<OtpStage>(initialStatus.phone.verified ? "verified" : "idle");
  const [error, setError] = useState<string | null>(null);
  const [cooldownTick, setCooldownTick] = useState(0);

  const centerState = useMemo(
    () =>
      buildVerificationCenterState({
        status,
        requirements,
      }),
    [requirements, status]
  );
  const overallLabel = centerState.completion.isComplete
    ? "Identity verified"
    : "Complete your required steps";
  const helpHref = roleHelpHref(viewerRole);
  const identifier = (initialEmail ?? phoneInput).trim().toLowerCase();
  const cooldownKey = useMemo(
    () => (identifier ? `verification:${identifier}` : null),
    [identifier]
  );
  const cooldownRemaining = useMemo(() => {
    void cooldownTick;
    return cooldownKey ? getCooldownRemaining(cooldownKey) : 0;
  }, [cooldownKey, cooldownTick]);
  const resendAvailable = cooldownRemaining <= 0;
  const countdown = cooldownRemaining;

  useEffect(() => {
    if (!cooldownKey) return;
    const timer = window.setInterval(() => {
      setCooldownTick((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownKey]);

  const isRateLimitError = (message?: string | null) => {
    if (!message) return false;
    const lower = message.toLowerCase();
    return (
      lower.includes("rate limit") ||
      lower.includes("too many") ||
      (lower.includes("rate") && lower.includes("limit")) ||
      lower.includes("429")
    );
  };

  const refreshStatus = async () => {
    const res = await fetch("/api/verification/status");
    if (!res.ok) return;
    const data = await res.json();
    if (data?.status) {
      setStatus(data.status as VerificationStatus);
    }
  };

  const handleStart = async () => {
    setError(null);
    setStage("sending");
    try {
      const res = await fetch("/api/verification/phone/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneE164: phoneInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          isRateLimitError(data?.error)
            ? "We’ve hit the email limit temporarily. Please wait a bit and try again."
            : data?.error || "Unable to send code."
        );
        setStage("idle");
      } else {
        setMode(data?.mode ?? null);
        setStage("sent");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send code.");
      setStage("idle");
    } finally {
      if (cooldownKey) {
        startCooldown(cooldownKey, 60);
        setCooldownTick((prev) => prev + 1);
      }
    }
  };

  const handleConfirm = async () => {
    setError(null);
    setStage("verifying");
    try {
      const res = await fetch("/api/verification/phone/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneE164: phoneInput, code, mode: mode ?? undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Unable to verify code.");
        setStage("sent");
        return;
      }
      setStage("verified");
      setCode("");
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to verify code.");
      setStage("sent");
    }
  };

  const handleResend = async () => {
    if (!resendAvailable) return;
    await handleStart();
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Verification center</p>
            <h1 className="text-2xl font-semibold text-slate-900">Identity verification</h1>
            <p className="text-sm text-slate-600">
              {overallLabel} • {centerState.completion.requiredCompleted}/
              {centerState.completion.requiredTotal} required checks completed
            </p>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
              centerState.completion.isComplete
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700"
            }`}
          >
            {centerState.completion.isComplete ? "Identity verified" : "Pending steps"}
          </span>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Verification helps build trust and unlocks key actions.{" "}
          <Link href={helpHref} className="font-semibold text-sky-700 underline underline-offset-4">
            Read verification guide
          </Link>
          .
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Email</h2>
          <p className="mt-1 text-sm text-slate-600">
            Unlocks secure account recovery and trust checks across the marketplace.
          </p>
          <div className="mt-4 flex items-center justify-between">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(
                centerState.steps.email.statusLabel
              )}`}
            >
              {centerState.steps.email.statusLabel}
            </span>
            {status.email.verified && status.email.verifiedAt && (
              <span className="text-xs text-slate-500">{formatDate(status.email.verifiedAt)}</span>
            )}
          </div>
          {initialEmail && (
            <p className="mt-3 text-xs text-slate-500">Signed in as {initialEmail}</p>
          )}
          {!status.email.verified ? (
            <Link
              href={`/auth/confirm?redirect=${encodeURIComponent("/account/verification")}`}
              className="mt-4 inline-flex items-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Open email confirmation
            </Link>
          ) : null}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Phone</h2>
          <p className="mt-1 text-sm text-slate-600">
            Unlocks faster contact verification and improves listing credibility.
          </p>

          <div className="mt-4">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(
                centerState.steps.phone.statusLabel
              )}`}
            >
              {centerState.steps.phone.statusLabel}
            </span>
          </div>

          {status.phone.verified ? (
            <div className="mt-3 space-y-2">
              {status.phone.phoneE164 && (
                <p className="text-xs text-slate-500">{status.phone.phoneE164}</p>
              )}
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600">Phone (E.164)</label>
                <input
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="+447700900000"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              {stage === "sent" || stage === "verifying" ? (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-600">Verification code</label>
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="123456"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              ) : null}
              {error && <p className="text-xs text-rose-600">{error}</p>}
              <div className="flex flex-wrap items-center gap-2">
                {stage === "sent" || stage === "verifying" ? (
                  <Button onClick={handleConfirm} disabled={stage === "verifying"}>
                    {stage === "verifying" ? "Verifying..." : "Verify code"}
                  </Button>
                ) : (
                  <Button onClick={handleStart} disabled={stage === "sending"}>
                    {stage === "sending" ? "Sending..." : "Send code"}
                  </Button>
                )}
                <button
                  type="button"
                  className="text-xs font-semibold text-slate-600 underline disabled:text-slate-400"
                  onClick={handleResend}
                  disabled={!resendAvailable || stage === "sending"}
                >
                  {resendAvailable ? "Resend code" : `Resend available in ${countdown}s`}
                </button>
              </div>
              {mode && (
                <p className="text-xs text-slate-500">
                  {mode === "supabase_phone_otp"
                    ? "Code sent via SMS"
                    : "Code sent to your email address"}
                </p>
              )}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Bank</h2>
          <p className="mt-1 text-sm text-slate-600">
            Unlocks payouts and settlement controls when enabled by admin policy.
          </p>
          <div className="mt-4 flex items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(
                centerState.steps.bank.statusLabel
              )}`}
            >
              {centerState.steps.bank.statusLabel}
            </span>
            {status.bank.verifiedAt && (
              <span className="text-xs text-slate-500">{formatDate(status.bank.verifiedAt)}</span>
            )}
          </div>
          {requirements.requireBank === false ? (
            <p className="mt-3 text-xs text-slate-500">
              Not required right now. We will only require this when payouts need bank verification.
            </p>
          ) : null}
          {requirements.requireBank && !status.bank.verified ? (
            <p className="mt-3 text-xs text-slate-500">
              Bank self-serve verification is coming soon. You can continue using the platform without this step for now.
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {requirements.requireBank && !status.bank.verified ? (
              <button
                type="button"
                className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-400"
                disabled
              >
                Coming soon
              </button>
            ) : null}
            <Link
              href={helpHref}
              className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Learn more
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
