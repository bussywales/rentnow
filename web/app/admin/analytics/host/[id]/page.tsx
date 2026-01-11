import Link from "next/link";
import { redirect } from "next/navigation";
import { HostAnalyticsPanel } from "@/components/analytics/HostAnalyticsPanel";
import { getLandlordAnalytics, type AnalyticsRangeKey } from "@/lib/analytics/landlord-analytics";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SearchParams = Record<string, string | string[] | undefined>;

type HostAnalyticsProps = {
  params: { id: string };
  searchParams?: SearchParams | Promise<SearchParams>;
};

export default async function AdminHostAnalyticsPage({ params, searchParams }: HostAnalyticsProps) {
  if (!hasServerSupabaseEnv()) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Host analytics</h1>
        <p className="text-sm text-slate-600">
          Supabase is not configured; analytics are unavailable.
        </p>
      </div>
    );
  }

  const resolvedParams = searchParams ? await searchParams : {};
  const rangeKey =
    typeof resolvedParams.range === "string"
      ? (resolvedParams.range as AnalyticsRangeKey)
      : null;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth/required?redirect=/admin/analytics/host/${params.id}&reason=auth`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    redirect("/forbidden?reason=role");
  }

  if (!uuidRegex.test(params.id)) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Host analytics</h1>
        <p className="text-sm text-slate-600">Invalid host id.</p>
        <Link href="/admin/analytics" className="text-sm font-semibold text-slate-700">
          Back to analytics
        </Link>
      </div>
    );
  }

  if (!hasServiceRoleEnv()) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Host analytics</h1>
        <p className="text-sm text-slate-600">
          Service role key missing; analytics are unavailable.
        </p>
      </div>
    );
  }

  const serviceClient = createServiceRoleClient();
  const snapshot = await getLandlordAnalytics({
    hostId: params.id,
    rangeKey,
    supabase: serviceClient,
  });
  const showDiagnostics = process.env.NODE_ENV === "development";

  return (
    <div className="space-y-4">
      <div className="text-sm text-slate-600">
        Viewing analytics for host <span className="font-semibold">{params.id}</span>
      </div>
      <HostAnalyticsPanel
        snapshot={snapshot}
        rangeKey={snapshot.range.key}
        baseHref={`/admin/analytics/host/${params.id}`}
        title="Host analytics"
        showDiagnostics={showDiagnostics}
      />
    </div>
  );
}
