"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

type Status = "checking" | "exchanging" | "idle" | "success" | "needs-login" | "error";

function ConfirmContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams?.get("code");
  const rawRedirect = searchParams?.get("redirect");
  const redirectTarget =
    rawRedirect && rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")
      ? rawRedirect
      : "/onboarding";
  const loginHref = `/auth/login?redirect=${encodeURIComponent(redirectTarget)}`;

  const [status, setStatus] = useState<Status>(code ? "exchanging" : "checking");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getClient = () => {
    try {
      return createBrowserSupabaseClient();
    } catch {
      setError("Supabase environment variables are missing.");
      setStatus("error");
      return null;
    }
  };

  const goToNextStep = () => {
    router.replace(redirectTarget);
  };

  const checkSession = async () => {
    const supabase = getClient();
    if (!supabase) {
      return;
    }
    setStatus("checking");
    setError(null);
    setMessage(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user) {
      setStatus("success");
      setMessage("Session found. Taking you to choose your role...");
      goToNextStep();
      return;
    }

    setStatus("idle");
    setMessage("Check your email for the verification link, then return here and continue.");
  };

  useEffect(() => {
    const supabase = getClient();
    if (!supabase) {
      return;
    }
    const run = async () => {
      // If we already have a session (e.g., user logged in manually), skip exchange.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        setStatus("success");
        setMessage("Session found. Redirecting to onboarding...");
        goToNextStep();
        return;
      }

      if (code) {
        setStatus("exchanging");
        setMessage("Processing your verification link...");
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          const lower = exchangeError.message?.toLowerCase() || "";
          const isVerifierIssue =
            lower.includes("code verifier") ||
            lower.includes("code_verifier") ||
            lower.includes("auth code and code verifier");
          setStatus("needs-login");
          setMessage(
            isVerifierIssue
              ? "Your email has been confirmed successfully. For security reasons, please log in to continue setting up your account."
              : "We couldn’t finish the sign-in step here. Please log in to continue setting up your account."
          );
          return;
        }
        setStatus("success");
        setMessage("Verified. Redirecting to finish onboarding...");
        goToNextStep();
        return;
      }
      await checkSession();
    };

    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Email confirmation</p>
        <h1 className="text-2xl font-semibold text-slate-900">
          {status === "needs-login" ? "Email confirmed 🎉" : "Finish signing in"}
        </h1>
        <p className="text-sm text-slate-600">
          {status === "needs-login"
            ? "Your email has been confirmed successfully. For security reasons, please log in to continue setting up your account."
            : "If you just clicked the verification link, we will log you in and take you to role selection."}
        </p>
      </div>

      {status === "needs-login" ? (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
          <Link
            href={loginHref}
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Log in to continue
          </Link>
          <p className="text-xs text-slate-500">
            This can happen if the verification link was opened on another browser or device.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-2 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">
              {status === "exchanging"
                ? "Processing magic link..."
                : status === "checking"
                  ? "Checking your session..."
                  : status === "success"
                    ? "Success"
                    : "Almost there"}
            </p>
            {message && <p>{message}</p>}
            {error && <p className="text-red-600">{error}</p>}
            {!message && !error && status === "idle" && (
              <p>Check your inbox and click the verification email. Then hit continue.</p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={() => checkSession()} disabled={status === "exchanging"}>
              {status === "exchanging" ? "Processing..." : "Continue"}
            </Button>
            <Link href={loginHref} className="text-sm font-semibold text-sky-700">
              Go to login
            </Link>
          </div>

          <p className="text-xs text-slate-500">
            If the verification link opens in another device, just log in on this device and return here to continue.
          </p>
        </>
      )}
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex max-w-md flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-sm text-slate-600">
          <p className="font-semibold text-slate-900">Checking your session...</p>
          <p>If you just clicked the verification email, we are processing it.</p>
        </div>
      }
    >
      <ConfirmContent />
    </Suspense>
  );
}
