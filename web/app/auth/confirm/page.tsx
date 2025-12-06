"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type Status = "checking" | "exchanging" | "idle" | "success" | "error";

function ConfirmContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams?.get("code");

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
    router.replace("/onboarding");
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
    setError("We could not find a session. Log in after confirming your email, then try again.");
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
          const hint = exchangeError.message?.toLowerCase().includes("code verifier")
            ? "It looks like the magic link opened in a different browser/device. Log in here with your email/password, then hit Continue."
            : "Unable to finish sign-in. Log in and then press Continue.";
          setStatus("idle");
          setError(exchangeError.message);
          setMessage(hint);
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
        <h1 className="text-2xl font-semibold text-slate-900">Finish signing in</h1>
        <p className="text-sm text-slate-600">
          If you just clicked the verification link, we will log you in and take you to role selection.
        </p>
      </div>

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
        <Link href="/auth/login" className="text-sm font-semibold text-sky-700">
          Go to login
        </Link>
      </div>

      <p className="text-xs text-slate-500">
        If the verification link opens in another device, just log in on this device and return here to continue.
      </p>
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
