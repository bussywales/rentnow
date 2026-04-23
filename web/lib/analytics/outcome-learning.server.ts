import type { SupabaseClient } from "@supabase/supabase-js";

type OutcomeLearningRow = {
  event_name: string;
  created_at: string;
  property_type: string | null;
  properties: Record<string, unknown> | null;
};

export type OutcomeLearningSnapshot = {
  windowDays: number;
  windowStart: string;
  commercialDiscovery: {
    commercialFilterUses: number;
    commercialResultClicks: number;
  };
  listingLimitRecovery: {
    recoveryViews: number;
    plansClicks: number;
    manageListingsClicks: number;
  };
  localLiving: {
    localLivingFilterUses: number;
    localLivingSectionViews: number;
  };
};

function readBoolean(properties: Record<string, unknown> | null | undefined, key: string): boolean {
  return properties?.[key] === true;
}

function readString(properties: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = properties?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function buildOutcomeLearningSnapshot(
  rows: OutcomeLearningRow[],
  options: { windowDays?: number; now?: Date } = {}
): OutcomeLearningSnapshot {
  const windowDays = options.windowDays ?? 14;
  const now = options.now ?? new Date();
  const windowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000).toISOString();

  let commercialFilterUses = 0;
  let commercialResultClicks = 0;
  let recoveryViews = 0;
  let plansClicks = 0;
  let manageListingsClicks = 0;
  let localLivingFilterUses = 0;
  let localLivingSectionViews = 0;

  for (const row of rows) {
    const properties = row.properties ?? null;
    if (row.event_name === "filter_applied" && readBoolean(properties, "commercialFilterUsed")) {
      commercialFilterUses += 1;
    }

    if (
      row.event_name === "result_clicked" &&
      (row.property_type === "office" || row.property_type === "shop" || readBoolean(properties, "commercialFilterUsed"))
    ) {
      commercialResultClicks += 1;
    }

    if (row.event_name === "listing_limit_recovery_viewed") {
      recoveryViews += 1;
    }

    if (row.event_name === "listing_limit_recovery_cta_clicked") {
      const action = readString(properties, "action");
      if (action === "view_plans") {
        plansClicks += 1;
      } else if (action === "manage_listings") {
        manageListingsClicks += 1;
      }
    }

    if (row.event_name === "filter_applied" && readBoolean(properties, "localLivingFilterUsed")) {
      localLivingFilterUses += 1;
    }

    if (
      row.event_name === "listing_detail_section_viewed" &&
      readString(properties, "category") === "local_living"
    ) {
      localLivingSectionViews += 1;
    }
  }

  return {
    windowDays,
    windowStart,
    commercialDiscovery: {
      commercialFilterUses,
      commercialResultClicks,
    },
    listingLimitRecovery: {
      recoveryViews,
      plansClicks,
      manageListingsClicks,
    },
    localLiving: {
      localLivingFilterUses,
      localLivingSectionViews,
    },
  };
}

export async function loadOutcomeLearningSnapshot(input: {
  supabase: SupabaseClient;
  windowDays?: number;
  now?: Date;
}): Promise<OutcomeLearningSnapshot> {
  const windowDays = input.windowDays ?? 14;
  const now = input.now ?? new Date();
  const windowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await input.supabase
    .from("product_analytics_events")
    .select("event_name, created_at, property_type, properties")
    .gte("created_at", windowStart);

  return buildOutcomeLearningSnapshot((data ?? []) as OutcomeLearningRow[], {
    windowDays,
    now,
  });
}
