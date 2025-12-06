"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export default function ConfirmPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "ready" | "error">("checking");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    supabase.auth
      .getSession()
      .then(({ data }: { data: { session: { user?: unknown } | null } }) => {
        if (data.session?.user) {
          router.replace("/onboarding");
        } else {
          setStatus("ready");
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Unable to verify session");
        setStatus("error");
      });
  }, [router]);

  const handleCheck = async () => {
    setStatus("checking");
    setError(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        router.replace("/onboarding");
      } else {
        setStatus("ready");
        setError("We couldn’t find a session. Try logging in after confirming your email.");
      }
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Unable to verify session");
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Email confirmation</p>
        <h1 className="text-2xl font-semibold text-slate-900">Finish signing in</h1>
        <p className="text-sm text-slate-600">
          If you just clicked the verification link, we’ll log you in and take you to role selection.
        </p>
      </div>

      {status === "checking" && (
        <p className="text-sm text-slate-600">Verifying your session...</p>
      )}

      {status !== "checking" && (
        <div className="space-y-3 text-sm text-slate-700">
          <Button className="w-full" onClick={handleCheck}>
            {status === "error" ? "Try again" : "Continue"}
          </Button>
          <div className="flex flex-col gap-1 text-xs text-slate-600">
            <span>Didn&apos;t get an email? Check spam or request a new one from the login page.</span>
            <Link href="/auth/login" className="font-semibold text-sky-700">
              Go to login
            </Link>
          </div>
          {error && <p className="text-xs text-rose-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
