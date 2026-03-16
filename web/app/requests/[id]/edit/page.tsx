import Link from "next/link";
import { redirect } from "next/navigation";
import { PropertyRequestFormClient } from "@/components/requests/PropertyRequestFormClient";
import {
  loadOwnedPropertyRequest,
  requireTenantPropertyRequestsAccess,
} from "@/lib/requests/property-requests.server";

export const dynamic = "force-dynamic";

export default async function EditPropertyRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const access = await requireTenantPropertyRequestsAccess(`/requests/${id}/edit`);
  const request = await loadOwnedPropertyRequest({
    supabase: access.supabase,
    userId: access.userId,
    requestId: id,
  });

  if (!request) {
    redirect("/requests/my");
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Property requests</p>
        <h1 className="text-3xl font-semibold text-slate-900">Edit property request</h1>
        <p className="max-w-2xl text-sm text-slate-600">
          Update the structured brief, then save changes or publish it when the request is ready.
        </p>
      </header>

      <div className="flex items-center justify-between">
        <Link href={`/requests/${request.id}`} className="text-sm font-semibold text-sky-700">
          Back to request
        </Link>
      </div>

      <PropertyRequestFormClient initialRequest={request} />
    </div>
  );
}
