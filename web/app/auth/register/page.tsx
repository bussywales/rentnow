"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { getCooldownRemaining, startCooldown } from "@/lib/auth/resendCooldown";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function normalizeRedirect(
  value?: string | string[] | undefined,
  fallback = "/onboarding"
) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback;
  return trimmed;
}

export default function RegisterPage({ searchParams }: PageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedDisclaimer, setAcceptedDisclaimer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldownTick, setCooldownTick] = useState(0);

  const getClient = () => {
    try {
      return createBrowserSupabaseClient();
    } catch {
      setError("Supabase environment variables are missing.");
      return null;
    }
  };

  const redirectTo = normalizeRedirect(searchParams?.redirect);
  const trimmedEmail = email.trim().toLowerCase();
  const cooldownKey = useMemo(
    () => (trimmedEmail ? `signup:${trimmedEmail}` : null),
    [trimmedEmail]
  );
  const cooldownRemaining = useMemo(() => {
    void cooldownTick;
    return cooldownKey ? getCooldownRemaining(cooldownKey) : 0;
  }, [cooldownKey, cooldownTick]);

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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!acceptedTerms || !acceptedDisclaimer) {
      setError("Please agree to the terms and disclaimer to continue.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = getClient();
    if (!supabase) {
      setLoading(false);
      return;
    }
    const siteUrl =
      (typeof window !== "undefined" ? window.location.origin : "") ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://www.propatyhub.com";
    const normalizedSite = siteUrl.replace(/\/$/, "");
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${normalizedSite}/auth/confirm?redirect=${encodeURIComponent(redirectTo)}`,
      },
    });
    if (signUpError) {
      setError(
        isRateLimitError(signUpError.message)
          ? "We’ve hit the email limit temporarily. Please wait a bit and try again."
          : signUpError.message
      );
    } else {
      setSuccess(
        "Check your email to confirm your account. After confirming, log in and you'll be taken to choose your role."
      );
    }
    if (cooldownKey) {
      startCooldown(cooldownKey, 60);
      setCooldownTick((prev) => prev + 1);
    }
    setLoading(false);
  };

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Create account</h1>
        <p className="text-sm text-slate-600">Choose a role on the next step.</p>
      </div>
      {success ? (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">Check your email</p>
          <p>{success}</p>
          <p className="text-xs text-slate-600">
            Tip: the verification link will bring you back to PropatyHub. If you&apos;ve already confirmed, just{" "}
            <Link
              href={`/auth/login?redirect=${encodeURIComponent(redirectTo)}`}
              className="font-semibold text-sky-700"
            >
              log in
            </Link>{" "}
            and you&apos;ll be redirected to choose your role.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href={`/auth/confirm?redirect=${encodeURIComponent(redirectTo)}`}>
              <Button size="sm" variant="secondary">
                I&apos;ve confirmed — continue
              </Button>
            </Link>
            <Link
              href={`/auth/login?redirect=${encodeURIComponent(redirectTo)}`}
              className="text-sm font-semibold text-sky-700"
            >
              Go to login
            </Link>
          </div>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input
            type="email"
            required
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <PasswordInput
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          <PasswordInput
            required
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
          <label className="flex items-start gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-1"
            />
            <span>
              I agree to the{" "}
              <Link href="/legal" className="font-semibold text-sky-700 hover:underline">
                Terms & Conditions
              </Link>
              .
            </span>
          </label>
          <label className="flex items-start gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={acceptedDisclaimer}
              onChange={(e) => setAcceptedDisclaimer(e.target.checked)}
              className="mt-1"
            />
            <span>
              I understand the{" "}
              <Link
                href="/legal/disclaimer"
                className="font-semibold text-sky-700 hover:underline"
              >
                marketplace disclaimer
              </Link>
              .
            </span>
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button
            className="w-full"
            type="submit"
            disabled={loading || cooldownRemaining > 0}
            data-testid="auth-register-submit"
          >
            {loading ? "Creating..." : "Create account"}
          </Button>
          {cooldownRemaining > 0 && (
            <p className="text-xs text-slate-500" data-testid="auth-resend-countdown">
              Resend available in {cooldownRemaining}s
            </p>
          )}
        </form>
      )}
      <p className="text-sm text-slate-600">
        Already have an account?{" "}
        <Link
          href={`/auth/login?redirect=${encodeURIComponent(redirectTo)}`}
          className="font-semibold text-sky-700"
        >
          Log in
        </Link>
      </p>
    </div>
  );
}
