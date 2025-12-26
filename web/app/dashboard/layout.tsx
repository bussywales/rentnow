export const dynamic = "force-dynamic";

import Link from "next/link";
import { getProfile, getSession } from "@/lib/auth";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabaseReady = hasServerSupabaseEnv();
  let profile = null;
  if (supabaseReady) {
    const session = await getSession();
    if (!session) {
      redirect("/auth/login?reason=auth");
    }
    profile = await getProfile();
    if (!profile?.role) {
      redirect("/onboarding");
    }
  }

  const profileIncomplete =
    profile?.role === "landlord" || profile?.role === "agent"
      ? !profile?.phone || !profile?.preferred_contact
      : false;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4">
      <div className="rounded-2xl bg-slate-900 px-5 py-4 text-white shadow-lg">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">
              Dashboard
            </p>
            <p className="text-xl font-semibold">
              {profile?.full_name || "Your"} workspace
            </p>
            <p className="text-sm text-slate-200">
              Role: {profile?.role || "demo"} - Manage listings, messages, and viewings.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Link href="/dashboard" className="rounded-full bg-white/10 px-3 py-1">
              My properties
            </Link>
            <Link
              href="/dashboard/saved-searches"
              className="rounded-full bg-white/10 px-3 py-1"
            >
              Saved searches
            </Link>
            <Link href="/dashboard/messages" className="rounded-full bg-white/10 px-3 py-1">
              Messages
            </Link>
            <Link href="/dashboard/viewings" className="rounded-full bg-white/10 px-3 py-1">
              Viewings
            </Link>
          </div>
        </div>
      </div>
      {profileIncomplete && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Complete your profile to get listings approved faster.</p>
          <p className="mt-1 text-amber-800">
            Add a phone number and preferred contact so tenants can reach you quickly.
          </p>
          <Link
            href={`/onboarding/${profile?.role}`}
            className="mt-2 inline-flex text-sm font-semibold text-amber-900 underline-offset-4 hover:underline"
          >
            Finish setup
          </Link>
        </div>
      )}
      {children}
    </div>
  );
}
