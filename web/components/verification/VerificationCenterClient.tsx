"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { VerificationStatus } from "@/lib/verification/status";
import { getCooldownRemaining, startCooldown } from "@/lib/auth/resendCooldown";

type Props = {
  initialStatus: VerificationStatus;
  initialEmail?: string | null;
};

type OtpStage = "idle" | "sending" | "sent" | "verifying" | "verified";

function formatDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString();
}

export default function VerificationCenterClient({ initialStatus, initialEmail }: Props) {
  const [status, setStatus] = useState<VerificationStatus>(initialStatus);
  const [phoneInput, setPhoneInput] = useState(initialStatus.phone.phoneE164 ?? "");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<"supabase_phone_otp" | "email_fallback" | null>(null);
  const [stage, setStage] = useState<OtpStage>(initialStatus.phone.verified ? "verified" : "idle");
  const [error, setError] = useState<string | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  const overallLabel = status.overall === "verified" ? "Identity verified" : "Complete these steps";
  const identifier = (initialEmail ?? phoneInput).trim().toLowerCase();
  const cooldownKey = useMemo(
    () => (identifier ? `verification:${identifier}` : null),
    [identifier]
  );
  const resendAvailable = cooldownRemaining <= 0;
  const countdown = cooldownRemaining;

  useEffect(() => {
    if (!cooldownKey) {
      setCooldownRemaining(0);
      return;
    }
    const update = () => setCooldownRemaining(getCooldownRemaining(cooldownKey));
    update();
    const timer = window.setInterval(update, 1000);
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
        setCooldownRemaining(getCooldownRemaining(cooldownKey));
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
            <p className="text-sm text-slate-600">{overallLabel}</p>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
              status.overall === "verified"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700"
            }`}
          >
            {status.overall === "verified" ? "Identity verified" : "Pending steps"}
          </span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Email</h2>
          <p className="mt-1 text-sm text-slate-600">
            Verified emails improve trust and keep your account secure.
          </p>
          <div className="mt-4 flex items-center justify-between">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                status.email.verified ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
              }`}
            >
              {status.email.verified ? "Verified" : "Not verified"}
            </span>
            {status.email.verified && status.email.verifiedAt && (
              <span className="text-xs text-slate-500">{formatDate(status.email.verifiedAt)}</span>
            )}
          </div>
          {initialEmail && (
            <p className="mt-3 text-xs text-slate-500">Signed in as {initialEmail}</p>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Phone</h2>
          <p className="mt-1 text-sm text-slate-600">Verify a phone number so tenants can trust you.</p>

          {status.phone.verified ? (
            <div className="mt-4 space-y-2">
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                Verified
              </span>
              {status.phone.phoneE164 && (
                <p className="text-xs text-slate-500">{status.phone.phoneE164}</p>
              )}
            </div>
          ) : (
            <div className="mt-4 space-y-3">
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
            Required before payouts. Admins will enable this when ready.
          </p>
          <div className="mt-4 flex items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                status.bank.verified ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
              }`}
            >
              {status.bank.verified ? "Verified" : "Pending"}
            </span>
            {status.bank.verifiedAt && (
              <span className="text-xs text-slate-500">{formatDate(status.bank.verifiedAt)}</span>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
