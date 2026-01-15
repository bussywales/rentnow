import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { ViewingRequestCard, type ViewingRequestItem } from "@/components/viewings/ViewingRequestCard";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { logAuthRedirect } from "@/lib/auth/auth-redirect-log";
import { resolveServerRole } from "@/lib/auth/role";

export const dynamic = "force-dynamic";

export default async function TenantViewingsPage() {
  if (hasServerSupabaseEnv()) {
    const { user, role } = await resolveServerRole();
    if (!user) {
      logAuthRedirect("/tenant/viewings");
      redirect("/auth/login?reason=auth");
    }
    if (!role) {
      redirect("/onboarding");
    }
    if (role !== "tenant") {
      redirect(role === "admin" ? "/admin/support" : "/host");
    }
  }

  const cookieHeader = (await cookies()).toString();
  let viewings: ViewingRequestItem[] = [];
  let fetchError: string | null = null;

  try {
    const res = await fetch("/api/viewings/tenant", {
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
      cache: "no-store",
    });

    if (!res || !res.ok) {
      fetchError = "Couldn't load your viewing requests.";
    } else {
      const json = await res.json();
      if (Array.isArray(json.viewings)) {
        viewings = json.viewings;
      } else {
        fetchError = "Couldn't load your viewing requests.";
      }
    }
  } catch {
    fetchError = "Couldn't load your viewing requests.";
  }

  if (fetchError) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 sm:px-6 lg:px-8">
        <ErrorState
          title="Viewing requests unavailable"
          description={fetchError}
          retryAction={
            <Link href="/tenant/viewings">
              <Button size="sm">Try again</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Viewing requests</h1>
        <p className="text-sm text-slate-600">
          Your viewing requests and their status.
        </p>
      </div>

      {viewings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center">
          <p className="text-base font-semibold text-slate-900">No viewing requests yet</p>
          <p className="mt-1 text-sm text-slate-600">
            Request a viewing from any home to see it listed here.
          </p>
          <Link href="/properties" className="mt-3 inline-flex">
            <Button size="sm" variant="secondary">
              Browse homes
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {viewings.map((req) => (
            <ViewingRequestCard key={req.id} request={req} />
          ))}
        </div>
      )}
    </div>
  );
}
