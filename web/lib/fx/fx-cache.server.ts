import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";
import { createFxSnapshot, type FxSnapshot } from "@/lib/fx/fx";

type FxDailyRateRow = {
  date?: string | null;
  base_currency?: string | null;
  rates?: unknown;
  source?: string | null;
  fetched_at?: string | null;
};

function normalizeDateKey(input: string | null | undefined) {
  const value = String(input || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
}

function resolveClient(client?: UntypedAdminClient | null) {
  if (client) return client;
  if (!hasServiceRoleEnv()) return null;
  return createServiceRoleClient() as unknown as UntypedAdminClient;
}

function parseSnapshotRow(row: FxDailyRateRow | null | undefined): FxSnapshot | null {
  if (!row) return null;
  const date = normalizeDateKey(row.date);
  if (!date) return null;
  const rates = row.rates && typeof row.rates === "object" ? (row.rates as Record<string, unknown>) : {};
  return createFxSnapshot({
    date,
    baseCurrency: row.base_currency ?? "",
    rates,
    source: row.source ?? "",
    fetchedAt: row.fetched_at ?? null,
  });
}

export async function getLatestFxSnapshot(input?: {
  client?: UntypedAdminClient | null;
  preferredDate?: string | null;
}): Promise<FxSnapshot | null> {
  const client = resolveClient(input?.client);
  if (!client) return null;

  const preferredDate = normalizeDateKey(input?.preferredDate);
  if (preferredDate) {
    const { data, error } = await client
      .from("fx_daily_rates")
      .select("date,base_currency,rates,source,fetched_at")
      .eq("date", preferredDate)
      .maybeSingle();
    if (!error && data) {
      const snapshot = parseSnapshotRow(data as FxDailyRateRow);
      if (snapshot) return snapshot;
    }
  }

  const { data, error } = await client
    .from("fx_daily_rates")
    .select("date,base_currency,rates,source,fetched_at")
    .order("date", { ascending: false })
    .range(0, 0);
  if (error) return null;
  const rows = (data as FxDailyRateRow[] | null) ?? [];
  return parseSnapshotRow(rows[0] ?? null);
}

export async function upsertFxSnapshot(input: {
  snapshot: FxSnapshot;
  client?: UntypedAdminClient | null;
}) {
  const client = resolveClient(input.client);
  if (!client) throw new Error("Service role client unavailable");

  const date = normalizeDateKey(input.snapshot.date);
  if (!date) throw new Error("Invalid FX snapshot date");

  const baseCurrency = String(input.snapshot.baseCurrency || "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(baseCurrency)) throw new Error("Invalid FX snapshot base currency");

  const payload = {
    date,
    base_currency: baseCurrency,
    rates: input.snapshot.rates,
    source: String(input.snapshot.source || "").trim() || "unknown",
    fetched_at: input.snapshot.fetchedAt ?? new Date().toISOString(),
  };

  const { error } = await client
    .from("fx_daily_rates")
    .upsert(payload, { onConflict: "date" });
  if (error) {
    throw new Error(String(error.message || "Unable to upsert fx snapshot"));
  }
}
