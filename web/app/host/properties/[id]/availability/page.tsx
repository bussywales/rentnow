import { redirect } from "next/navigation";
import { WeeklyAvailabilityEditor } from "@/components/availability/WeeklyAvailabilityEditor";
import { ExceptionsEditor } from "@/components/availability/ExceptionsEditor";
import { SlotPreview } from "@/components/availability/SlotPreview";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";

type Params = { id: string };

export default async function AvailabilityPage({ params }: { params: Params }) {
  if (!hasServerSupabaseEnv()) {
    redirect("/forbidden");
  }
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/login?reason=auth");
  }

  const propertyId = params.id;
  const { data: property } = await supabase
    .from("properties")
    .select("id, owner_id, title, timezone")
    .eq("id", propertyId)
    .maybeSingle();

  if (!property || (property.owner_id !== user.id)) {
    redirect("/forbidden");
  }

  const { data: rules } = await supabase
    .from("property_availability_rules")
    .select("day_of_week, start_minute, end_minute")
    .eq("property_id", propertyId);

  const { data: exceptions } = await supabase
    .from("property_availability_exceptions")
    .select("local_date, exception_type, start_minute, end_minute")
    .eq("property_id", propertyId);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Availability</p>
        <h1 className="text-2xl font-semibold text-slate-900">{property.title}</h1>
        <p className="text-sm text-slate-600">
          Times are in {property.timezone}. Tenants can only request slots you allow here.
        </p>
      </div>

      <WeeklyAvailabilityEditor propertyId={propertyId} initialRules={rules || []} />

      <ExceptionsEditor propertyId={propertyId} initial={exceptions || []} />

      <SlotPreview propertyId={propertyId} />
    </div>
  );
}
