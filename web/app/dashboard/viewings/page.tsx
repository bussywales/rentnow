import { Button } from "@/components/ui/Button";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import type { ViewingRequest, UserRole } from "@/lib/types";

export const dynamic = "force-dynamic";

const viewingRequests: ViewingRequest[] = [
  {
    id: "v1",
    property_id: "mock-1",
    tenant_id: "tenant-1",
    preferred_date: "2025-01-06",
    preferred_time_window: "10:00 - 12:00",
    note: "Happy to do virtual if easier.",
    status: "pending",
    created_at: new Date().toISOString(),
  },
];

export default async function ViewingsPage() {
  const supabaseReady = hasServerSupabaseEnv();
  let currentUserId: string | null = null;
  let role: UserRole | null = null;
  let requests: ViewingRequest[] = viewingRequests;

  if (supabaseReady) {
    try {
      const supabase = await createServerSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        currentUserId = user.id;
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        role = (profile?.role as UserRole) ?? null;

        if (role === "tenant") {
          const { data, error } = await supabase
            .from("viewing_requests")
            .select("*, properties(id, title)")
            .eq("tenant_id", user.id)
            .order("created_at", { ascending: false });

          if (!error && data) {
            requests = data as ViewingRequest[];
          }
        } else {
          const { data, error } = await supabase
            .from("viewing_requests")
            .select("*, properties!inner(id, owner_id, title)")
            .eq("properties.owner_id", user.id)
            .order("created_at", { ascending: false });

          if (!error && data) {
            requests = data as ViewingRequest[];
          }
        }
      }
    } catch (err) {
      console.warn("Falling back to mock viewing requests", err);
    }
  }

  const demoMode = !supabaseReady || !currentUserId;
  const isTenant = role === "tenant";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Viewing requests</h1>
        <p className="text-sm text-slate-600">
          {isTenant
            ? "Your viewing requests and their status."
            : "Coordinate tours and confirm availability on your listings."}
        </p>
        {demoMode && (
          <p className="mt-2 text-sm text-amber-700">
            Demo mode: connect Supabase and sign in to see your real viewing requests.
          </p>
        )}
      </div>

      <div className="space-y-3">
        {requests.map((req) => (
          <div
            key={req.id}
            className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between"
          >
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Property: {(req as any).properties?.title || req.property_id}
              </p>
              <p className="text-sm text-slate-600">
                {req.preferred_date}
                {req.preferred_time_window ? ` - ${req.preferred_time_window}` : ""}
              </p>
              {req.note && <p className="text-sm text-slate-600">{req.note}</p>}
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Status: {req.status}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm">Accept</Button>
              <Button size="sm" variant="secondary">
                Decline
              </Button>
            </div>
          </div>
        ))}
        {!requests.length && (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center">
            <p className="text-base font-semibold text-slate-900">No viewings yet</p>
            <p className="mt-1 text-sm text-slate-600">
              Requests will appear here after tenants ask to view your listings.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
