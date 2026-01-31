"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type Mode = "request" | "update" | "success" | "error";

const getClient = () => {
  try {
    return createBrowserSupabaseClient();
  } catch {
    return null;
  }
};

function ResetContent() {
  const searchParams = useSearchParams();
  const code = searchParams?.get("code");
  const from = searchParams?.get("from");
  const supabase = useMemo(() => getClient(), []);

  const [mode, setMode] = useState<Mode>(() => (supabase ? "request" : "error"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(() =>
    supabase ? null : "Supabase environment variables are missing."
  );
  const [loading, setLoading] = useState(false);

  const resolveSiteUrl = () => {
    if (typeof window !== "undefined") {
      return window.location.origin.replace(/\/$/, "");
    }
    return (process.env.NEXT_PUBLIC_SITE_URL || "https://www.propatyhub.com").replace(/\/$/, "");
  };

  const parseHashTokens = () => {
    if (typeof window === "undefined") return null;
    const hash = window.location.hash?.replace(/^#/, "");
    if (!hash) return null;
    const params = new URLSearchParams(hash);
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    const type = params.get("type");
    if (access_token && refresh_token) {
      return { access_token, refresh_token, type };
    }
    return null;
  };

  const hasStoredCodeVerifier = () => {
    if (typeof window === "undefined") return false;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) return false;
    try {
      const host = new URL(supabaseUrl).hostname;
      const projectRef = host.split(".")[0];
      const key = `sb-${projectRef}-auth-token-code-verifier`;
      return Boolean(window.localStorage.getItem(key));
    } catch {
      return false;
    }
  };

  const isMissingCodeVerifier = (message?: string | null) => {
    if (!message) return false;
    return (
      message.includes("code verifier") ||
      message.includes("code_verifier") ||
      message.includes("auth code and code verifier")
    );
  };

  useEffect(() => {
    if (!supabase) return;

    const run = async () => {
      setError(null);
      setMessage(null);

      const hashTokens = parseHashTokens();
      if (hashTokens?.access_token && hashTokens.refresh_token) {
        await supabase.auth.setSession({
          access_token: hashTokens.access_token,
          refresh_token: hashTokens.refresh_token,
        });
        if (typeof window !== "undefined") {
          window.history.replaceState(null, "", window.location.pathname + window.location.search);
        }
      }

      if (code) {
        if (!hasStoredCodeVerifier()) {
          setMode("request");
          setMessage(
            "Reset link opened in a different browser. Request a new reset link."
          );
          return;
        }
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setMode("request");
          if (isMissingCodeVerifier(exchangeError.message)) {
            setMessage(
              "Reset link opened in a different browser. Request a new reset link."
            );
            return;
          }
          setError("Unable to process reset link. Request a new reset link.");
          return;
        }
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        setMode("update");
        return;
      }

      if (from === "reset_email" && !code && !hashTokens?.type) {
        setMessage("Request a new reset link to continue.");
      }
      setMode("request");
    };

    void run();
  }, [code, from, supabase]);

  useEffect(() => {
    if (!supabase) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        if (event === "PASSWORD_RECOVERY" || session?.user) {
          setMode("update");
        }
      }
    );
    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const handleRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) {
      setError("Supabase environment variables are missing.");
      return;
    }
    const emailTrimmed = email.trim();
    if (!emailTrimmed) {
      setError("Enter the email you used to sign up.");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    const redirectTo = `${resolveSiteUrl()}/auth/reset?from=reset_email`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(emailTrimmed, {
      redirectTo,
    });
    if (resetError) {
      setError(resetError.message || "Unable to send reset email.");
    } else {
      setMessage("Check your email for the reset link. It will bring you back here.");
    }
    setLoading(false);
  };

  const handleUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) {
      setError("Supabase environment variables are missing.");
      return;
    }
    const passwordTrimmed = password.trim();
    const confirmTrimmed = confirm.trim();
    if (!passwordTrimmed || !confirmTrimmed) {
      setError("Enter and confirm your new password.");
      return;
    }
    if (passwordTrimmed !== confirmTrimmed) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password: passwordTrimmed });
    if (updateError) {
      setError(updateError.message || "Unable to update password.");
      setLoading(false);
      return;
    }
    setMode("success");
    setLoading(false);
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        window.location.assign("/auth/login?reset=success");
      }, 1200);
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Password reset</p>
        <h1 className="text-2xl font-semibold text-slate-900">
          {mode === "update" ? "Set a new password" : "Reset your password"}
        </h1>
        <p className="text-sm text-slate-600">
          {mode === "update"
            ? "Choose a new password to continue."
            : "We’ll email you a reset link to finish the process."}
        </p>
      </div>

      {mode === "request" && (
        <form className="space-y-4" onSubmit={handleRequest}>
          <Input
            type="email"
            required
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          {message && <p className="text-sm text-slate-700">{message}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Sending..." : "Send reset link"}
          </Button>
        </form>
      )}

      {mode === "update" && (
        <form className="space-y-4" onSubmit={handleUpdate}>
          <PasswordInput
            required
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          <PasswordInput
            required
            placeholder="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Updating..." : "Update password"}
          </Button>
        </form>
      )}

      {mode === "success" && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">Password updated</p>
          <p>You can now log in with your new password.</p>
          <Link href="/auth/login" className="text-sm font-semibold text-sky-700">
            Go to login
          </Link>
        </div>
      )}

      {mode === "error" && (
        <p className="text-sm text-red-600">{error || "Unable to load reset form."}</p>
      )}

      <p className="text-xs text-slate-500">
        Need help? Make sure the reset link opens in the same browser where you started the request.
      </p>
    </div>
  );
}

export default function ResetPage() {
  return (
    <Suspense fallback={null}>
      <ResetContent />
    </Suspense>
  );
}
