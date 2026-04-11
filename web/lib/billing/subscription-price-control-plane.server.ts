import { formatCurrencyMinor } from "@/lib/money/multi-currency";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { getProviderModes } from "@/lib/billing/provider-settings";
import { getStripeClient, getStripeConfigForMode } from "@/lib/billing/stripe";
import {
  buildSubscriptionPriceBookKey,
  deriveSubscriptionPriceControlStatus,
  getSubscriptionRoleLabel,
  getSubscriptionTierForRole,
  type SubscriptionPriceBookAuditLogRow,
  type SubscriptionPriceBookProvider,
  type SubscriptionPriceBookRow,
  type SubscriptionPriceRowStatus,
  type SubscriptionPriceWorkflowState,
  normalizeSubscriptionPriceWorkflowState,
} from "@/lib/billing/subscription-price-book";
import {
  loadSubscriptionPriceBookAuditLog,
  loadSubscriptionPriceBookRows,
} from "@/lib/billing/subscription-price-book.repository";
import {
  loadAdminSubscriptionPriceMatrix,
  type AdminSubscriptionPriceMatrixFilters,
} from "@/lib/billing/subscription-price-book.server";

export type AdminSubscriptionPriceDraftView = {
  id: string;
  key: string;
  marketCountry: string;
  role: SubscriptionPriceBookRow["role"];
  roleLabel: string;
  tier: SubscriptionPriceBookRow["tier"];
  cadence: SubscriptionPriceBookRow["cadence"];
  provider: SubscriptionPriceBookProvider;
  currency: string;
  amountMinor: number;
  displayPrice: string;
  providerPriceRef: string | null;
  operatorNotes: string | null;
  status: SubscriptionPriceRowStatus;
  statusLabel: string;
  statusDetail: string | null;
  replacingRowId: string | null;
  replacingDisplayPrice: string | null;
  updatedAt: string;
  updatedBy: string | null;
};

export type AdminSubscriptionPriceAuditEntry = {
  id: string;
  eventType: SubscriptionPriceBookAuditLogRow["event_type"];
  marketCountry: string;
  roleLabel: string;
  cadence: SubscriptionPriceBookAuditLogRow["cadence"];
  provider: SubscriptionPriceBookProvider;
  actorLabel: string | null;
  createdAt: string;
  previousDisplayPrice: string | null;
  nextDisplayPrice: string | null;
};

const DISPLAY_LOCALE: Record<string, string> = {
  GB: "en-GB",
  CA: "en-CA",
  US: "en-US",
  NG: "en-NG",
};

const stripeSnapshotCache = new Map<string, Promise<{ currency: string; amountMinor: number } | null>>();

function resolveLocale(country: string) {
  return DISPLAY_LOCALE[country] || "en-GB";
}

function formatDisplayPrice(country: string, currency: string, amountMinor: number) {
  return formatCurrencyMinor(currency, amountMinor, { locale: resolveLocale(country) });
}

function getRoleDisplayOrder(role: SubscriptionPriceBookRow["role"]) {
  if (role === "tenant") return 10;
  if (role === "landlord") return 20;
  return 30;
}

function buildStatusLabel(status: SubscriptionPriceRowStatus) {
  if (status === "active") return "Active";
  if (status === "draft") return "Draft";
  if (status === "pending_publish") return "Pending publish";
  if (status === "missing_stripe_ref") return "Missing Stripe ref";
  if (status === "misaligned") return "Misaligned";
  if (status === "blocked") return "Blocked";
  return "Archived";
}

async function createControlPlaneClient() {
  if (hasServiceRoleEnv()) return createServiceRoleClient();
  if (hasServerSupabaseEnv()) return createServerSupabaseClient();
  return null;
}

async function loadActorLabelMap(rows: SubscriptionPriceBookRow[], auditRows: SubscriptionPriceBookAuditLogRow[]) {
  const client = await createControlPlaneClient();
  if (!client) return new Map<string, string>();
  const ids = Array.from(
    new Set(
      [
        ...rows.map((row) => row.updated_by).filter(Boolean),
        ...auditRows.map((row) => row.actor_id).filter(Boolean),
      ] as string[]
    )
  );
  if (!ids.length) return new Map<string, string>();

  const { data } = await client.from("profiles").select("id, full_name").in("id", ids);
  return new Map(
    ((data ?? []) as Array<{ id: string; full_name: string | null }>).map((row) => [
      row.id,
      row.full_name?.trim() || row.id,
    ])
  );
}

async function fetchStripeSnapshot(secretKey: string, priceId: string) {
  const cacheKey = `${secretKey}:${priceId}`;
  if (!stripeSnapshotCache.has(cacheKey)) {
    stripeSnapshotCache.set(
      cacheKey,
      (async () => {
        try {
          const stripe = getStripeClient(secretKey);
          const price = await stripe.prices.retrieve(priceId);
          if (!price.active) return null;
          const amountMinor =
            typeof price.unit_amount === "number"
              ? price.unit_amount
              : price.unit_amount_decimal
              ? Math.round(Number(price.unit_amount_decimal))
              : null;
          if (typeof amountMinor !== "number" || amountMinor < 0) return null;
          return {
            currency: String(price.currency || "").toUpperCase(),
            amountMinor,
          };
        } catch {
          return null;
        }
      })()
    );
  }
  return stripeSnapshotCache.get(cacheKey) ?? Promise.resolve(null);
}

export async function validateStripePriceDraft(row: {
  market_country: string;
  currency: string;
  amount_minor: number;
  provider: SubscriptionPriceBookProvider;
  provider_price_ref: string | null;
  workflow_state?: SubscriptionPriceWorkflowState | null;
}) {
  if (normalizeSubscriptionPriceWorkflowState({ workflow_state: row.workflow_state ?? "draft", active: false, ends_at: null }) === "archived") {
    return {
      status: "archived" as const,
      detail: "Archived rows are kept for price history only.",
    };
  }
  if (row.provider !== "stripe") {
    return {
      status: "blocked" as const,
      detail: "This MVP only publishes Stripe-backed subscription pricing from the admin control plane.",
    };
  }
  if (!row.provider_price_ref) {
    return {
      status: "missing_stripe_ref" as const,
      detail: "Attach a Stripe recurring price ref before publishing this draft.",
    };
  }

  const { stripeMode } = await getProviderModes();
  const stripeConfig = getStripeConfigForMode(stripeMode);
  if (!stripeConfig.secretKey) {
    return {
      status: "blocked" as const,
      detail: "Stripe is not configured in this environment, so publish safety cannot validate the linked recurring price.",
    };
  }

  const snapshot = await fetchStripeSnapshot(stripeConfig.secretKey, row.provider_price_ref);
  if (!snapshot) {
    return {
      status: "blocked" as const,
      detail: `Linked Stripe recurring price ${row.provider_price_ref} could not be loaded.`,
    };
  }
  if (snapshot.currency !== row.currency || snapshot.amountMinor !== row.amount_minor) {
    return {
      status: "misaligned" as const,
      detail: `Linked Stripe recurring price ${row.provider_price_ref} does not match ${formatDisplayPrice(
        row.market_country,
        row.currency,
        row.amount_minor
      )}.`,
    };
  }
  return {
    status: "pending_publish" as const,
    detail: "Draft is complete and safe to publish.",
  };
}

export async function loadAdminSubscriptionPricingControlPlane(filters: AdminSubscriptionPriceMatrixFilters) {
  const [{ entries, summary, providerModes }, rows, auditRows] = await Promise.all([
    loadAdminSubscriptionPriceMatrix(filters),
    loadSubscriptionPriceBookRows(),
    loadSubscriptionPriceBookAuditLog(30),
  ]);

  const actorLabels = await loadActorLabelMap(rows, auditRows);
  const activeRowsByKey = new Map<string, SubscriptionPriceBookRow>();
  for (const row of rows) {
    const workflowState = normalizeSubscriptionPriceWorkflowState(row);
    if (workflowState !== "active" || !row.active || row.ends_at) continue;
    activeRowsByKey.set(
      buildSubscriptionPriceBookKey({
        marketCountry: row.market_country,
        role: row.role,
        cadence: row.cadence,
      }),
      row
    );
  }

  const draftRows = rows
    .filter((row) => normalizeSubscriptionPriceWorkflowState(row) === "draft" && !row.ends_at)
    .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));

  const drafts = await Promise.all(
    draftRows.map(async (row) => {
      const key = buildSubscriptionPriceBookKey({
        marketCountry: row.market_country,
        role: row.role,
        cadence: row.cadence,
      });
      const replacingRow = activeRowsByKey.get(key) ?? null;
      const validation = await validateStripePriceDraft(row);
      const controlStatus = deriveSubscriptionPriceControlStatus({
        workflowState: "draft",
        marketGap: false,
        missingProviderRef: validation.status === "missing_stripe_ref",
        checkoutMatchesCanonical: false,
        runtimeUnavailable: validation.status === "blocked",
        diagnostics: validation.status === "misaligned" ? ["Checkout mismatch"] : [],
      });
      return {
        id: row.id,
        key,
        marketCountry: row.market_country,
        role: row.role,
        roleLabel: getSubscriptionRoleLabel(row.role),
        tier: row.tier,
        cadence: row.cadence,
        provider: row.provider,
        currency: row.currency,
        amountMinor: row.amount_minor,
        displayPrice: formatDisplayPrice(row.market_country, row.currency, row.amount_minor),
        providerPriceRef: row.provider_price_ref,
        operatorNotes: row.operator_notes,
        status: controlStatus,
        statusLabel: buildStatusLabel(controlStatus),
        statusDetail: validation.detail,
        replacingRowId: replacingRow?.id ?? row.replaces_price_book_id ?? null,
        replacingDisplayPrice: replacingRow
          ? formatDisplayPrice(replacingRow.market_country, replacingRow.currency, replacingRow.amount_minor)
          : null,
        updatedAt: row.updated_at,
        updatedBy: row.updated_by ? actorLabels.get(row.updated_by) ?? row.updated_by : null,
      } satisfies AdminSubscriptionPriceDraftView;
    })
  );

  const activity = auditRows.map((row) => {
    const previousSnapshot = row.previous_snapshot as
      | { currency?: string; amount_minor?: number; market_country?: string }
      | null;
    const nextSnapshot = row.next_snapshot as
      | { currency?: string; amount_minor?: number; market_country?: string }
      | null;

    const previousDisplayPrice =
      previousSnapshot?.currency && typeof previousSnapshot.amount_minor === "number"
        ? formatDisplayPrice(
            previousSnapshot.market_country || row.market_country,
            previousSnapshot.currency,
            previousSnapshot.amount_minor
          )
        : null;
    const nextDisplayPrice =
      nextSnapshot?.currency && typeof nextSnapshot.amount_minor === "number"
        ? formatDisplayPrice(
            nextSnapshot.market_country || row.market_country,
            nextSnapshot.currency,
            nextSnapshot.amount_minor
          )
        : null;

    return {
      id: row.id,
      eventType: row.event_type,
      marketCountry: row.market_country,
      roleLabel: getSubscriptionRoleLabel(row.role),
      cadence: row.cadence,
      provider: row.provider,
      actorLabel: row.actor_id ? actorLabels.get(row.actor_id) ?? row.actor_id : null,
      createdAt: row.created_at,
      previousDisplayPrice,
      nextDisplayPrice,
    } satisfies AdminSubscriptionPriceAuditEntry;
  });

  return {
    entries,
    summary: {
      ...summary,
      draftRows: drafts.length,
      publishReadyDrafts: drafts.filter((draft) => draft.status === "pending_publish").length,
    },
    providerModes,
    drafts,
    activity,
  };
}

export type UpsertSubscriptionPriceDraftInput = {
  marketCountry: string;
  role: SubscriptionPriceBookRow["role"];
  cadence: SubscriptionPriceBookRow["cadence"];
  currency: string;
  amountMinor: number;
  providerPriceRef: string | null;
  operatorNotes: string | null;
};

function normalizeMarketCountry(value: string) {
  return value.trim().toUpperCase();
}

function normalizeCurrency(value: string) {
  return value.trim().toUpperCase();
}

function serializeSnapshot(row: Record<string, unknown>) {
  return JSON.parse(JSON.stringify(row));
}

type SubscriptionPriceDraftSelectBuilder = {
  eq: (column: string, value: string | boolean) => SubscriptionPriceDraftSelectBuilder;
  maybeSingle: () => Promise<{ data: SubscriptionPriceBookRow | null; error?: { message: string } | null }>;
};

type SubscriptionPriceDraftAdminDb = {
  from: (table: string) => {
    select: (columns: string) => SubscriptionPriceDraftSelectBuilder;
    insert: (values: Record<string, unknown>) => Promise<{ data: SubscriptionPriceBookRow[] | null; error?: { message: string } | null }>;
    update: (values: Record<string, unknown>) => {
      eq: (column: string, value: string) => Promise<{ data?: SubscriptionPriceBookRow[] | null; error?: { message: string } | null }>;
    };
  };
};

type SubscriptionPriceAuditInsertDb = {
  from: (table: string) => {
    insert: (values: Record<string, unknown>) => Promise<{ error?: { message: string } | null }>;
  };
};

export async function upsertSubscriptionPriceDraft(input: UpsertSubscriptionPriceDraftInput, actorId: string) {
  const admin = createServiceRoleClient();
  const marketCountry = normalizeMarketCountry(input.marketCountry);
  const currency = normalizeCurrency(input.currency);
  const tier = getSubscriptionTierForRole(input.role);
  const now = new Date().toISOString();
  const adminDb = admin as unknown as SubscriptionPriceDraftAdminDb;

  const { data: existingDraft } = await adminDb
    .from("subscription_price_book")
    .select("id,product_area,role,tier,cadence,market_country,currency,amount_minor,provider,provider_price_ref,active,fallback_eligible,effective_at,ends_at,display_order,badge,operator_notes,created_at,updated_at,updated_by,workflow_state,replaces_price_book_id")
    .eq("market_country", marketCountry)
    .eq("role", input.role)
    .eq("cadence", input.cadence)
    .eq("workflow_state", "draft")
    .maybeSingle();

  const { data: activeRow } = await adminDb
    .from("subscription_price_book")
    .select("id,product_area,role,tier,cadence,market_country,currency,amount_minor,provider,provider_price_ref,active,fallback_eligible,effective_at,ends_at,display_order,badge,operator_notes,created_at,updated_at,updated_by,workflow_state,replaces_price_book_id")
    .eq("market_country", marketCountry)
    .eq("role", input.role)
    .eq("cadence", input.cadence)
    .eq("active", true)
    .maybeSingle();

  const nextValues = {
    product_area: "subscriptions",
    role: input.role,
    tier,
    cadence: input.cadence,
    market_country: marketCountry,
    currency,
    amount_minor: input.amountMinor,
    provider: "stripe",
    provider_price_ref: input.providerPriceRef,
    active: false,
    fallback_eligible: false,
    effective_at: now,
    ends_at: null,
    display_order: getRoleDisplayOrder(input.role),
    badge: "Draft",
    operator_notes: input.operatorNotes,
    updated_at: now,
    updated_by: actorId,
    workflow_state: "draft",
    replaces_price_book_id: activeRow?.id ?? existingDraft?.replaces_price_book_id ?? null,
  };

  let savedRow: SubscriptionPriceBookRow | null = null;
  let eventType: SubscriptionPriceBookAuditLogRow["event_type"] = "draft_created";
  let previousSnapshot: Record<string, unknown> | null = null;

  if (existingDraft) {
    eventType = "draft_updated";
    previousSnapshot = serializeSnapshot(existingDraft as unknown as Record<string, unknown>);
    const { error } = await adminDb.from("subscription_price_book").update(nextValues).eq("id", existingDraft.id);
    if (error) throw new Error(error.message || "Unable to update pricing draft.");
    savedRow = {
      ...existingDraft,
      ...nextValues,
      id: existingDraft.id,
      created_at: existingDraft.created_at,
    } as SubscriptionPriceBookRow;
  } else {
    const { data, error } = await adminDb.from("subscription_price_book").insert({
      id: crypto.randomUUID(),
      created_at: now,
      ...nextValues,
    });
    if (error) throw new Error(error.message || "Unable to create pricing draft.");
    savedRow = ((data ?? [])[0] as SubscriptionPriceBookRow | undefined) ?? ({
      id: crypto.randomUUID(),
      created_at: now,
      ...nextValues,
    } as SubscriptionPriceBookRow);
  }

  const auditDb = admin as unknown as SubscriptionPriceAuditInsertDb;
  await auditDb.from("subscription_price_book_audit_log").insert({
    price_book_id: savedRow.id,
    market_country: marketCountry,
    role: input.role,
    tier,
    cadence: input.cadence,
    provider: "stripe",
    event_type: eventType,
    actor_id: actorId,
    previous_snapshot: previousSnapshot,
    next_snapshot: serializeSnapshot(savedRow as unknown as Record<string, unknown>),
  });

  return savedRow;
}

export async function publishSubscriptionPriceDraft(draftId: string, actorId: string) {
  const admin = createServiceRoleClient();
  const adminDb = admin as unknown as SubscriptionPriceDraftAdminDb;
  const auditDb = admin as unknown as SubscriptionPriceAuditInsertDb;
  const { data: draft, error } = await admin
    .from("subscription_price_book")
    .select(
      "id,product_area,role,tier,cadence,market_country,currency,amount_minor,provider,provider_price_ref,active,fallback_eligible,effective_at,ends_at,display_order,badge,operator_notes,created_at,updated_at,updated_by,workflow_state,replaces_price_book_id"
    )
    .eq("id", draftId)
    .maybeSingle();

  const draftRow = draft as SubscriptionPriceBookRow | null;
  if (error || !draftRow) {
    throw new Error("Pricing draft not found.");
  }
  if (normalizeSubscriptionPriceWorkflowState(draftRow) !== "draft") {
    throw new Error("Only draft pricing rows can be published.");
  }

  const validation = await validateStripePriceDraft(draftRow);
  if (validation.status !== "pending_publish") {
    throw new Error(validation.detail);
  }

  const publishAt = new Date().toISOString();
  const activeQuery = await admin
    .from("subscription_price_book")
    .select(
      "id,product_area,role,tier,cadence,market_country,currency,amount_minor,provider,provider_price_ref,active,fallback_eligible,effective_at,ends_at,display_order,badge,operator_notes,created_at,updated_at,updated_by,workflow_state,replaces_price_book_id"
    )
    .eq("market_country", draftRow.market_country)
    .eq("role", draftRow.role)
    .eq("cadence", draftRow.cadence)
    .eq("active", true)
    .maybeSingle();
  const currentActive = (activeQuery.data as SubscriptionPriceBookRow | null) ?? null;

  if (currentActive) {
    const { error: archiveError } = await adminDb
      .from("subscription_price_book")
      .update({
        active: false,
        ends_at: publishAt,
        workflow_state: "archived",
        updated_at: publishAt,
        updated_by: actorId,
      })
      .eq("id", currentActive.id);
    if (archiveError) throw new Error(archiveError.message || "Unable to archive current active price.");
  }

  const { error: publishError } = await adminDb
    .from("subscription_price_book")
    .update({
      active: true,
      effective_at: publishAt,
      ends_at: null,
      badge: null,
      workflow_state: "active",
      updated_at: publishAt,
      updated_by: actorId,
    })
    .eq("id", draftRow.id);
  if (publishError) throw new Error(publishError.message || "Unable to publish pricing draft.");

  const publishedSnapshot = {
    ...draftRow,
    active: true,
    badge: null,
    workflow_state: "active",
    effective_at: publishAt,
    ends_at: null,
    updated_at: publishAt,
    updated_by: actorId,
  };

  await auditDb.from("subscription_price_book_audit_log").insert({
    price_book_id: draftRow.id,
    market_country: draftRow.market_country,
    role: draftRow.role,
    tier: draftRow.tier,
    cadence: draftRow.cadence,
    provider: draftRow.provider,
    event_type: "published",
    actor_id: actorId,
    previous_snapshot: currentActive ? serializeSnapshot(currentActive as unknown as Record<string, unknown>) : null,
    next_snapshot: serializeSnapshot(publishedSnapshot as unknown as Record<string, unknown>),
  });

  return publishedSnapshot;
}
