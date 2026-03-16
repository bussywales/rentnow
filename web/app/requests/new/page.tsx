import Link from "next/link";
import { requireTenantPropertyRequestsAccess } from "@/lib/requests/property-requests.server";
import { PropertyRequestFormClient } from "@/components/requests/PropertyRequestFormClient";

export const dynamic = "force-dynamic";

export default async function NewPropertyRequestPage() {
  await requireTenantPropertyRequestsAccess("/requests/new");

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Property requests</p>
        <h1 className="text-3xl font-semibold text-slate-900">Create property request</h1>
        <p className="max-w-2xl text-sm text-slate-600">
          Tell hosts what you need. Save a draft first or publish when the request is ready to
          enter the reviewable demand pool.
        </p>
      </header>

      <div className="flex items-center justify-between">
        <Link href="/requests/my" className="text-sm font-semibold text-sky-700">
          Back to my requests
        </Link>
      </div>

      <PropertyRequestFormClient />
    </div>
  );
}
