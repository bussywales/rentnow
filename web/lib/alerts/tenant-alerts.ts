import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/env";
import { getTenantPlanForTier } from "@/lib/plans";
import { parseFiltersFromSavedSearch, propertyMatchesFilters } from "@/lib/search-filters";
import type { Property, SavedSearch } from "@/lib/types";

type AlertDispatchResult = {
  ok: boolean;
  matched: number;
  sent: number;
  skipped: number;
  status?: number;
  error?: string;
};

type EmailDispatchGuard = {
  ok: boolean;
  status: number;
  error?: string;
};

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function isPlanExpired(validUntil: string | null) {
  if (!validUntil) return false;
  const parsed = Date.parse(validUntil);
  return Number.isFinite(parsed) && parsed < Date.now();
}

export function getEmailDispatchGuard(): EmailDispatchGuard {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) {
    return { ok: false, status: 503, error: "Email not configured" };
  }
  return { ok: true, status: 200 };
}

async function sendAlertEmail(input: {
  to: string;
  property: Property;
  searchName: string;
}) {
  const guard = getEmailDispatchGuard();
  if (!guard.ok) {
    return { status: "skipped" as const, error: guard.error || "Email not configured" };
  }
  const apiKey = process.env.RESEND_API_KEY ?? "";
  const from = process.env.RESEND_FROM ?? "";

  const siteUrl = await getSiteUrl();
  const listingUrl = `${siteUrl}/properties/${input.property.id}`;
  const subject = `New listing match: ${input.property.title}`;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #0f172a;">
      <h2 style="margin: 0 0 8px;">${input.property.title}</h2>
      <p style="margin: 0 0 12px;">We found a new listing matching your saved search "${input.searchName}".</p>
      <p style="margin: 0 0 12px;"><strong>${input.property.city}</strong> · ${input.property.currency} ${input.property.price.toLocaleString()}</p>
      <a href="${listingUrl}" style="display: inline-block; padding: 10px 16px; background: #0ea5e9; color: #fff; text-decoration: none; border-radius: 8px;">View listing</a>
    </div>
  `;

  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    return { status: "failed" as const, error: body || res.statusText };
  }

  return { status: "sent" as const, error: null };
}

export async function dispatchSavedSearchAlerts(
  propertyId: string
): Promise<AlertDispatchResult> {
  if (!hasServiceRoleEnv()) {
    return {
      ok: false,
      matched: 0,
      sent: 0,
      skipped: 0,
      status: 503,
      error: "Service role missing",
    };
  }

  const emailGuard = getEmailDispatchGuard();
  if (!emailGuard.ok) {
    return {
      ok: false,
      matched: 0,
      sent: 0,
      skipped: 0,
      status: emailGuard.status,
      error: emailGuard.error,
    };
  }

  const adminClient = createServiceRoleClient();
  const adminDb = adminClient as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => Promise<{ data: unknown; error: { message: string } | null }>;
      };
      insert: (values: Record<string, unknown>) => {
        select: (columns: string) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
      };
      update: (values: Record<string, unknown>) => {
        eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
      };
    };
  };

  const { data: propertyData, error: propertyError } = await adminDb
    .from("properties")
    .select(
      "id, title, city, price, currency, bedrooms, rental_type, furnished, amenities, is_active, is_approved"
    )
    .eq("id", propertyId);

  if (propertyError || !Array.isArray(propertyData) || !propertyData[0]) {
    return {
      ok: false,
      matched: 0,
      sent: 0,
      skipped: 0,
      error: propertyError?.message || "Property not found",
    };
  }

  const property = propertyData[0] as Property;
  if (!property.is_active || !property.is_approved) {
    return { ok: true, matched: 0, sent: 0, skipped: 0 };
  }

  const { data: savedSearchesRaw, error: searchesError } = await adminDb
    .from("saved_searches")
    .select("id, user_id, name, query_params");
  if (searchesError || !Array.isArray(savedSearchesRaw)) {
    return {
      ok: false,
      matched: 0,
      sent: 0,
      skipped: 0,
      error: searchesError?.message || "Unable to load saved searches",
    };
  }

  const savedSearches = savedSearchesRaw as SavedSearch[];
  if (!savedSearches.length) {
    return { ok: true, matched: 0, sent: 0, skipped: 0 };
  }

  const userIds = Array.from(new Set(savedSearches.map((search) => search.user_id)));
  const { data: planRows } = await adminClient
    .from("profile_plans")
    .select("profile_id, plan_tier, valid_until")
    .in("profile_id", userIds);
  const planMap = new Map<string, { plan_tier?: string | null; valid_until?: string | null }>();
  if (Array.isArray(planRows)) {
    planRows.forEach((row) => {
      const typed = row as { profile_id: string; plan_tier?: string | null; valid_until?: string | null };
      planMap.set(typed.profile_id, typed);
    });
  }

  const { data: userList } = await adminClient.auth.admin.listUsers({ perPage: 2000 });
  const emailMap = new Map<string, string>();
  userList?.users?.forEach((user) => {
    if (user.email) emailMap.set(user.id, user.email);
  });

  let matched = 0;
  let sent = 0;
  let skipped = 0;

  for (const search of savedSearches) {
    const filters = parseFiltersFromSavedSearch(search.query_params || {});
    if (!propertyMatchesFilters(property, filters)) continue;
    matched += 1;

    const planRow = planMap.get(search.user_id);
    const expired = isPlanExpired(planRow?.valid_until ?? null);
    const tenantPlan = getTenantPlanForTier(expired ? "free" : planRow?.plan_tier ?? "free");
    if (tenantPlan.tier !== "tenant_pro") {
      skipped += 1;
      continue;
    }

    const { data: alertRow, error: insertError } = await adminDb
      .from("saved_search_alerts")
      .insert({
        user_id: search.user_id,
        saved_search_id: search.id,
        property_id: property.id,
        channel: "email",
        status: "pending",
        created_at: new Date().toISOString(),
      })
      .select("id");

    if (insertError) {
      if (insertError.code === "23505") {
        skipped += 1;
        continue;
      }
      skipped += 1;
      continue;
    }

    const alertId = Array.isArray(alertRow) ? (alertRow[0] as { id?: string })?.id : null;
    const recipientEmail = emailMap.get(search.user_id);
    if (!recipientEmail || !alertId) {
      skipped += 1;
      if (alertId) {
        await adminDb
          .from("saved_search_alerts")
          .update({ status: "skipped", error: "Missing recipient email" })
          .eq("id", alertId);
      }
      continue;
    }

    const emailResult = await sendAlertEmail({
      to: recipientEmail,
      property,
      searchName: search.name,
    });

    if (emailResult.status === "sent") {
      sent += 1;
      await adminDb
        .from("saved_search_alerts")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", alertId);
      await adminDb
        .from("saved_searches")
        .update({ last_notified_at: new Date().toISOString() })
        .eq("id", search.id);
    } else {
      skipped += 1;
      await adminDb
        .from("saved_search_alerts")
        .update({ status: emailResult.status, error: emailResult.error })
        .eq("id", alertId);
    }
  }

  return { ok: true, matched, sent, skipped };
}
