import { createFxSnapshot, type FxSnapshot } from "@/lib/fx/fx";

const DEFAULT_PROVIDER_URL = "https://open.er-api.com/v6/latest/USD";
const DEFAULT_SOURCE = "open.er-api";

type ProviderPayload = {
  base_code?: unknown;
  base?: unknown;
  rates?: unknown;
  time_last_update_utc?: unknown;
  time_last_update_unix?: unknown;
};

function resolveDateKey(now: Date) {
  return now.toISOString().slice(0, 10);
}

function normalizeRates(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") return {};
  const rates: Record<string, number> = {};
  for (const [currency, amount] of Object.entries(value as Record<string, unknown>)) {
    const code = String(currency || "").trim().toUpperCase();
    const numeric = Number(amount);
    if (!/^[A-Z]{3}$/.test(code)) continue;
    if (!Number.isFinite(numeric) || numeric <= 0) continue;
    rates[code] = numeric;
  }
  return rates;
}

function resolveFetchedAt(payload: ProviderPayload, fallback: Date) {
  const unix = Number(payload.time_last_update_unix);
  if (Number.isFinite(unix) && unix > 0) {
    return new Date(unix * 1000).toISOString();
  }
  const utc = String(payload.time_last_update_utc || "").trim();
  const parsed = Date.parse(utc);
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  return fallback.toISOString();
}

export async function fetchDailyFxSnapshot(input?: {
  providerUrl?: string;
  source?: string;
  now?: Date;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<FxSnapshot> {
  const now = input?.now ?? new Date();
  const providerUrl = String(input?.providerUrl || process.env.FX_PROVIDER_URL || DEFAULT_PROVIDER_URL).trim();
  const source = String(input?.source || process.env.FX_PROVIDER_SOURCE || DEFAULT_SOURCE).trim() || DEFAULT_SOURCE;
  const timeoutMs = Math.max(1_000, Math.trunc(Number(input?.timeoutMs ?? 12_000)));
  const fetchImpl = input?.fetchImpl ?? fetch;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("fx provider timeout"), timeoutMs);
  try {
    const response = await fetchImpl(providerUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`FX provider request failed (${response.status})`);
    }

    const payload = (await response.json()) as ProviderPayload;
    const baseCurrency = String(payload.base_code ?? payload.base ?? "").trim().toUpperCase();
    const rates = normalizeRates(payload.rates);
    const snapshot = createFxSnapshot({
      date: resolveDateKey(now),
      baseCurrency,
      rates,
      source,
      fetchedAt: resolveFetchedAt(payload, now),
    });
    if (!snapshot) {
      throw new Error("FX provider payload missing required fields");
    }
    return snapshot;
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error("Unable to fetch FX rates");
  } finally {
    clearTimeout(timeout);
  }
}
