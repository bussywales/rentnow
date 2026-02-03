import Link from "next/link";
import { redirect } from "next/navigation";
import { PropertyCard } from "@/components/properties/PropertyCard";
import { Button } from "@/components/ui/Button";
import { logAuthRedirect } from "@/lib/auth/auth-redirect-log";
import { resolveServerRole } from "@/lib/auth/role";
import { fetchSavedProperties } from "@/lib/saved-properties.server";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function TenantSavedPage() {
  if (!hasServerSupabaseEnv()) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4">
        <h1 className="text-2xl font-semibold text-slate-900">Saved homes</h1>
        <p className="text-sm text-slate-600">
          Supabase is not configured, so saved homes are unavailable right now.
        </p>
        <Link href="/properties" className="text-sky-700 font-semibold">
          Browse homes
        </Link>
      </div>
    );
  }

  const { supabase, user, role } = await resolveServerRole();
  if (!user) {
    logAuthRedirect("/tenant/saved");
    redirect("/auth/login?reason=auth");
  }
  if (!role) {
    redirect("/onboarding");
  }
  if (role !== "tenant") {
    redirect(role === "admin" ? "/admin/support" : "/host");
  }

  const properties = await fetchSavedProperties({
    supabase,
    userId: user.id,
    limit: 60,
  });

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Saved homes</h1>
          <p className="text-sm text-slate-600">
            {properties.length
              ? "Your saved listings, ready when you are."
              : "No saved homes yet."}
          </p>
        </div>
        <Link href="/properties">
          <Button variant="secondary" size="sm">
            Browse listings
          </Button>
        </Link>
      </div>

      {properties.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {properties.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              href={`/properties/${property.id}`}
              showSave
              initialSaved
              showCta
              viewerRole="tenant"
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center">
          <h2 className="text-lg font-semibold text-slate-900">
            Save homes to revisit later
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Tap the heart on any listing to keep it here across devices.
          </p>
          <Link href="/properties" className="mt-4 inline-flex">
            <Button>Browse listings</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
