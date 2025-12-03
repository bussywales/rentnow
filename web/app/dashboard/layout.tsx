export const dynamic = "force-dynamic";

import Link from "next/link";
import { getProfile } from "@/lib/auth";
import type { ReactNode } from "react";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  let profile = null;
  try {
    profile = await getProfile();
  } catch (err) {
    console.warn("Supabase not configured; rendering dashboard shell", err);
  }

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
              Role: {profile?.role || "demo"} • Manage listings, messages, and viewings.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Link href="/dashboard" className="rounded-full bg-white/10 px-3 py-1">
              My properties
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
      {children}
    </div>
  );
}
