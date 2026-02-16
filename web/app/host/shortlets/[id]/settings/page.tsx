import { redirect } from "next/navigation";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { hasActiveDelegation } from "@/lib/agent-delegations";
import { readActingAsFromCookies } from "@/lib/acting-as.server";
import { mapLegacyListingIntent } from "@/lib/shortlet/shortlet.server";
import { HostShortletSettingsForm } from "@/components/host/HostShortletSettingsForm";

export const dynamic = "force-dynamic";

type Params = { id?: string };

export default async function HostShortletSettingsPage({
  params,
}: {
  params: Params | Promise<Params>;
}) {
  const resolvedParams = (await Promise.resolve(params)) as Params;
  const propertyId = decodeURIComponent(String(resolvedParams?.id || "")).trim();
  if (!propertyId) redirect("/host");

  const { supabase, user } = await getServerAuthUser();
  if (!user) {
    redirect(`/auth/required?redirect=/host/shortlets/${encodeURIComponent(propertyId)}/settings&reason=auth`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = profile?.role ?? null;
  if (role !== "landlord" && role !== "agent") {
    redirect("/forbidden?reason=role");
  }

  let ownerId = user.id;
  if (role === "agent") {
    const actingAs = await readActingAsFromCookies();
    if (actingAs && actingAs !== user.id) {
      const allowed = await hasActiveDelegation(supabase, user.id, actingAs);
      if (allowed) ownerId = actingAs;
    }
  }

  const client = hasServiceRoleEnv() ? createServiceRoleClient() : supabase;
  const { data: propertyRow } = await client
    .from("properties")
    .select("id,owner_id,title,city,currency,listing_intent,rental_type")
    .eq("id", propertyId)
    .maybeSingle();

  if (!propertyRow || String(propertyRow.owner_id || "") !== ownerId) {
    redirect("/host");
  }

  const listingIntent = mapLegacyListingIntent(propertyRow.listing_intent);
  const isShortlet = listingIntent === "shortlet" || String(propertyRow.rental_type || "") === "short_let";
  if (!isShortlet) {
    redirect(`/dashboard/properties/${encodeURIComponent(propertyId)}?step=basics`);
  }

  const { data: settingsRow } = await client
    .from("shortlet_settings")
    .select("booking_mode,nightly_price_minor,cleaning_fee_minor,deposit_minor")
    .eq("property_id", propertyId)
    .maybeSingle();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-4">
      <HostShortletSettingsForm
        propertyId={propertyId}
        propertyTitle={typeof propertyRow.title === "string" ? propertyRow.title : null}
        propertyCity={typeof propertyRow.city === "string" ? propertyRow.city : null}
        currency={typeof propertyRow.currency === "string" ? propertyRow.currency : "NGN"}
        initialSettings={{
          booking_mode: settingsRow?.booking_mode === "instant" ? "instant" : "request",
          nightly_price_minor:
            typeof settingsRow?.nightly_price_minor === "number"
              ? Math.trunc(settingsRow.nightly_price_minor)
              : null,
          cleaning_fee_minor:
            typeof settingsRow?.cleaning_fee_minor === "number"
              ? Math.trunc(settingsRow.cleaning_fee_minor)
              : 0,
          deposit_minor:
            typeof settingsRow?.deposit_minor === "number"
              ? Math.trunc(settingsRow.deposit_minor)
              : 0,
        }}
      />
    </div>
  );
}
