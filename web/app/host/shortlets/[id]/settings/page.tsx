import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { hasActiveDelegation } from "@/lib/agent-delegations";
import { readActingAsFromCookies } from "@/lib/acting-as.server";
import { MARKET_COOKIE_NAME, formatMarketLabel, resolveMarketFromRequest } from "@/lib/market/market";
import { getMarketSettings } from "@/lib/market/market.server";
import { resolveShortletManageState } from "@/lib/shortlet/manage-state";
import { HostShortletConversionCard } from "@/components/host/HostShortletConversionCard";
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
    .select(
      "id,owner_id,title,city,currency,listing_intent,rental_type,shortlet_settings(property_id,nightly_price_minor,booking_mode,cancellation_policy)"
    )
    .eq("id", propertyId)
    .maybeSingle();

  if (!propertyRow || String(propertyRow.owner_id || "") !== ownerId) {
    redirect("/host");
  }

  const requestHeaders = await headers();
  const requestCookies = await cookies();
  const marketSettings = await getMarketSettings(supabase);
  const selectedMarket = resolveMarketFromRequest({
    headers: requestHeaders,
    cookieValue: requestCookies.get(MARKET_COOKIE_NAME)?.value ?? null,
    appSettings: marketSettings,
  });

  const shortletManageState = resolveShortletManageState({
    listing_intent: propertyRow.listing_intent,
    rental_type: propertyRow.rental_type,
    shortlet_settings: propertyRow.shortlet_settings as
      | Array<{ booking_mode?: string | null; nightly_price_minor?: number | null }>
      | null
      | undefined,
    listing_currency: propertyRow.currency,
    selected_market_country: selectedMarket.country,
    selected_market_currency: selectedMarket.currency,
  });

  console.info("[host/shortlets/settings] guard", {
    role,
    actorUserId: user.id,
    listingId: propertyId,
    listingOwnerId: String(propertyRow.owner_id || ""),
    listingIntent: propertyRow.listing_intent ?? null,
    normalizedListingIntent: shortletManageState.normalizedListingIntent,
    rentalType: propertyRow.rental_type ?? null,
    hasShortletSignal: shortletManageState.hasShortletSignal,
    hasShortletSettingsSignal: shortletManageState.hasSettingsSignal,
    shortletManageable: shortletManageState.isManageable,
    shortletReason: shortletManageState.reason,
    listingCurrency: shortletManageState.listingCurrency,
    selectedMarketCountry: shortletManageState.selectedMarketCountry,
    selectedMarketCurrency: shortletManageState.selectedMarketCurrency,
  });

  if (!shortletManageState.isManageable) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-4">
        <HostShortletConversionCard
          propertyId={propertyId}
          propertyTitle={typeof propertyRow.title === "string" ? propertyRow.title : null}
          propertyCity={typeof propertyRow.city === "string" ? propertyRow.city : null}
          listingCurrency={typeof propertyRow.currency === "string" ? propertyRow.currency : "NGN"}
          selectedMarketLabel={formatMarketLabel(selectedMarket)}
          showMarketMismatchHint={shortletManageState.marketMismatch}
        />
      </div>
    );
  }

  const { data: settingsRow } = await client
    .from("shortlet_settings")
    .select(
      "booking_mode,nightly_price_minor,cleaning_fee_minor,deposit_minor,cancellation_policy,checkin_instructions,checkin_window_start,checkin_window_end,checkout_time,access_method,access_code_hint,parking_info,wifi_info,house_rules,quiet_hours_start,quiet_hours_end,pets_allowed,smoking_allowed,parties_allowed,max_guests_override,emergency_notes"
    )
    .eq("property_id", propertyId)
    .maybeSingle();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-4">
      <HostShortletSettingsForm
        propertyId={propertyId}
        propertyTitle={typeof propertyRow.title === "string" ? propertyRow.title : null}
        propertyCity={typeof propertyRow.city === "string" ? propertyRow.city : null}
        currency={typeof propertyRow.currency === "string" ? propertyRow.currency : "NGN"}
        selectedMarketLabel={formatMarketLabel(selectedMarket)}
        marketMismatchHint={shortletManageState.marketMismatch}
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
          cancellation_policy:
            settingsRow?.cancellation_policy === "flexible_24h" ||
            settingsRow?.cancellation_policy === "flexible_48h" ||
            settingsRow?.cancellation_policy === "moderate_5d" ||
            settingsRow?.cancellation_policy === "strict"
              ? settingsRow.cancellation_policy
              : "flexible_48h",
          checkin_instructions:
            typeof settingsRow?.checkin_instructions === "string"
              ? settingsRow.checkin_instructions
              : null,
          checkin_window_start:
            typeof settingsRow?.checkin_window_start === "string"
              ? settingsRow.checkin_window_start
              : null,
          checkin_window_end:
            typeof settingsRow?.checkin_window_end === "string"
              ? settingsRow.checkin_window_end
              : null,
          checkout_time:
            typeof settingsRow?.checkout_time === "string"
              ? settingsRow.checkout_time
              : null,
          access_method:
            typeof settingsRow?.access_method === "string"
              ? settingsRow.access_method
              : null,
          access_code_hint:
            typeof settingsRow?.access_code_hint === "string"
              ? settingsRow.access_code_hint
              : null,
          parking_info:
            typeof settingsRow?.parking_info === "string"
              ? settingsRow.parking_info
              : null,
          wifi_info:
            typeof settingsRow?.wifi_info === "string" ? settingsRow.wifi_info : null,
          house_rules:
            typeof settingsRow?.house_rules === "string"
              ? settingsRow.house_rules
              : null,
          quiet_hours_start:
            typeof settingsRow?.quiet_hours_start === "string"
              ? settingsRow.quiet_hours_start
              : null,
          quiet_hours_end:
            typeof settingsRow?.quiet_hours_end === "string"
              ? settingsRow.quiet_hours_end
              : null,
          pets_allowed:
            typeof settingsRow?.pets_allowed === "boolean"
              ? settingsRow.pets_allowed
              : null,
          smoking_allowed:
            typeof settingsRow?.smoking_allowed === "boolean"
              ? settingsRow.smoking_allowed
              : null,
          parties_allowed:
            typeof settingsRow?.parties_allowed === "boolean"
              ? settingsRow.parties_allowed
              : null,
          max_guests_override:
            typeof settingsRow?.max_guests_override === "number"
              ? Math.trunc(settingsRow.max_guests_override)
              : null,
          emergency_notes:
            typeof settingsRow?.emergency_notes === "string"
              ? settingsRow.emergency_notes
              : null,
        }}
      />
    </div>
  );
}
