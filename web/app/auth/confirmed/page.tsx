"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

function ConfirmedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams?.get("redirect") || "/onboarding";
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    supabase.auth
      .getSession()
      .then(({ data }: { data: { session: { user?: { id: string } } | null } }) => {
        if (data.session?.user) {
          router.replace(redirect);
        }
      })
      .finally(() => setChecking(false));
  }, [redirect, router]);

  const loginHref = `/auth/login?redirect=${encodeURIComponent(redirect)}`;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Email confirmed</p>
        <h1 className="text-2xl font-semibold text-slate-900">You’re all set</h1>
        <p className="text-sm text-slate-600">
          Thanks for verifying your email. Log in to continue to onboarding.
        </p>
      </div>
      <div className="space-y-2 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        <p className="font-semibold text-slate-900">
          {checking ? "Checking your session..." : "Ready to continue"}
        </p>
        <p>If you already logged in on this device, we’ll take you straight to onboarding.</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href={loginHref}>
          <Button>Go to login</Button>
        </Link>
        <Link href="/onboarding" className="text-sm font-semibold text-sky-700">
          Skip to onboarding
        </Link>
      </div>
    </div>
  );
}

export default function EmailConfirmedPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex max-w-md flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-sm text-slate-600">
          <p className="font-semibold text-slate-900">Loading...</p>
          <p>Verifying your session.</p>
        </div>
      }
    >
      <ConfirmedContent />
    </Suspense>
  );
}
