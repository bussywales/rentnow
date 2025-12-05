"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useSearchParams } from "next/navigation";

function LoginContent() {
  const search = useSearchParams();
  const reason = search.get("reason");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const getClient = () => {
    try {
      return createBrowserSupabaseClient();
    } catch {
      setError("Supabase environment variables are missing.");
      return null;
    }
  };

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
    const supabase = getClient();
    if (!supabase) {
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
      }
      window.location.href = "/dashboard";
    }
    setLoading(false);
  };

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Log in</h1>
        <p className="text-sm text-slate-600">
          Access your dashboard and messages.
        </p>
        {reason === "auth" && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Please log in to continue.
          </p>
        )}
      </div>
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
