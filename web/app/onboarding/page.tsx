"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/Button";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

const roles = [
  { value: "tenant", label: "Tenant", description: "Search, save, and request viewings." },
  { value: "landlord", label: "Landlord", description: "List properties and manage leads." },
  { value: "agent", label: "Agent", description: "Manage multiple listings and enquiries." },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [supabase] = useState(() => {
    try {
      return createBrowserSupabaseClient();
    } catch {
      return null;
    }
  });
  const [selected, setSelected] = useState("tenant");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(() => !!supabase);
  const [hasSession, setHasSession] = useState(false);
  const [error, setError] = useState<string | null>(() =>
    supabase ? null : "Supabase environment variables are missing."
  );

  const refreshSession = async (options?: { silent?: boolean }) => {
    setCheckingSession(true);
    if (!supabase) {
      setCheckingSession(false);
      return false;
    }
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const authed = !!session?.user;
    setHasSession(authed);
    setCheckingSession(false);
    if (!authed && !options?.silent) {
      setError("Please confirm your email, then log in to continue.");
    } else {
      setError(null);
    }
    return authed;
  };

  useEffect(() => {
    if (!supabase) return;
    supabase.auth
      .getSession()
      .then(({ data }: { data: { session: Session | null } }) => {
        const authed = !!data.session?.user;
        setHasSession(authed);
        if (authed) {
          setError(null);
        }
      })
      .catch(() => undefined)
      .finally(() => setCheckingSession(false));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        const authed = !!session?.user;
        setHasSession(authed);
        if (authed) {
          setError(null);
        }
      }
    );
    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    const authed = await refreshSession();
    if (!authed) {
      setLoading(false);
      return;
    }
    if (!supabase) {
      setError("Supabase environment variables are missing.");
      setLoading(false);
      return;
    }
    const {
      data: { user },
      error: sessionError,
    } = await supabase.auth.getUser();
    if (sessionError || !user) {
      setError("Please confirm your email, then log in to continue.");
      setHasSession(false);
      setLoading(false);
      return;
    }

    const completedNow = selected === "tenant";
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        role: selected,
        onboarding_completed: completedNow,
        onboarding_completed_at: completedNow ? new Date().toISOString() : null,
      });

    if (profileError) {
      setError(profileError.message);
    } else {
      if (selected === "tenant") {
        router.replace(
          `/legal/accept?redirect=${encodeURIComponent("/properties")}`
        );
      } else if (selected === "agent") {
        router.replace("/onboarding/agent");
      } else {
        router.replace("/onboarding/landlord");
      }
    }
    setLoading(false);
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Onboarding</p>
        <h1 className="text-2xl font-semibold text-slate-900">Choose your role</h1>
        <p className="text-sm text-slate-600">You can change this later in your profile.</p>
      </div>
      {!hasSession && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-semibold">Confirm your email to continue.</p>
          <p className="mt-1">
            Check your inbox for the verification email, confirm it, then log in. After that,
            click &quot;Refresh session&quot; to proceed.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => router.push("/auth/login")}>
              Log in
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refreshSession()}
              disabled={checkingSession}
            >
              {checkingSession ? "Checking..." : "Refresh session"}
            </Button>
          </div>
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-3">
        {roles.map((role) => (
          <button
            key={role.value}
            type="button"
            onClick={() => setSelected(role.value)}
            className={`rounded-xl border p-4 text-left shadow-sm transition ${
              selected === role.value
                ? "border-sky-400 bg-sky-50"
                : "border-slate-200 bg-white hover:border-sky-200"
            }`}
          >
            <p className="text-lg font-semibold text-slate-900">{role.label}</p>
            <p className="text-sm text-slate-600">{role.description}</p>
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => router.replace("/dashboard")} disabled={loading}>
          Skip for now
        </Button>
        <Button onClick={handleSave} disabled={loading}>
          {loading ? "Saving..." : "Continue"}
        </Button>
      </div>
    </div>
  );
}
