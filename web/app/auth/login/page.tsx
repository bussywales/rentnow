"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { useRouter, useSearchParams } from "next/navigation";

const getClient = () => {
  try {
    return createBrowserSupabaseClient();
  } catch {
    return null;
  }
};

function LoginContent() {
  const search = useSearchParams();
  const router = useRouter();
  const reason = search.get("reason");
  const redirectTo = search.get("redirect") || "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const supabase = useMemo(() => getClient(), []);
  const [error, setError] = useState<string | null>(() =>
    supabase ? null : "Supabase environment variables are missing."
  );
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const emailFromForm = (formData.get("email") as string | null) ?? "";
    const passwordFromForm = (formData.get("password") as string | null) ?? "";
    const emailTrimmed = (email || emailFromForm).trim();
    const passwordTrimmed = (password || passwordFromForm).trim();
    if (!emailTrimmed || !passwordTrimmed) {
      setError("Email and password are required.");
      setLoading(false);
      return;
    }
    if (!supabase) {
      setError("Supabase environment variables are missing.");
      setLoading(false);
      return;
    }
    const { error: signInError, data } = await supabase.auth.signInWithPassword({
      email: emailTrimmed,
      password: passwordTrimmed,
    });
    if (signInError) {
      setError(signInError.message || "Unable to log in. Please try again.");
    } else {
      const session = data.session;
      if (session?.access_token && session.refresh_token) {
        // Ensure Supabase persists the session client-side
        try {
          await supabase.auth.setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          });
        } catch {
          /* ignore setSession failures; Supabase will fall back to existing state */
        }

        router.replace(redirectTo);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!supabase) {
      setCheckingSession(false);
      return;
    }

    supabase.auth
      .getSession()
      .then(({ data }: { data: { session: Session | null } }) => {
        const session = data.session;
        if (session?.user) {
          router.replace(redirectTo);
          return;
        }
        setCheckingSession(false);
      })
      .catch(() => {
        setCheckingSession(false);
      });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        if (event === "SIGNED_IN" && session?.user) {
          router.replace(redirectTo);
        }
      }
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [redirectTo, router, supabase]);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Log in</h1>
        <p className="text-sm text-slate-600">
          Access your dashboard and messages.
        </p>
        {!checkingSession && reason === "auth" && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Please log in to continue.
          </p>
        )}
      </div>
      {checkingSession ? (
        <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Checking your session...
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input
            type="email"
            required
            placeholder="you@email.com"
            value={email}
            name="email"
            autoComplete="username"
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            type="password"
            required
            placeholder="Password"
            value={password}
            name="password"
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button className="w-full" type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Log in"}
          </Button>
        </form>
      )}
      <p className="text-sm text-slate-600">
        New here?{" "}
        <Link href="/auth/register" className="font-semibold text-sky-700">
          Create an account
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
