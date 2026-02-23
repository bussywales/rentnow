import type { UntypedAdminClient } from "@/lib/supabase/untyped";

const REMINDERS_JOB_NAME = "shortlet_reminders";

type JsonRecord = Record<string, unknown>;

export type ShortletsOpsReminderRun = {
  runKey: string;
  startedAt: string | null;
  finishedAt: string | null;
  status: "started" | "succeeded" | "failed";
  meta: JsonRecord;
  error: string | null;
};

export type ShortletsOpsPayoutRequest = {
  payoutId: string;
  bookingId: string;
  requestedAt: string;
  status: "eligible" | "paid";
};

export type ShortletsOpsPaymentMismatch = {
  bookingId: string;
  paymentId: string;
  paymentUpdatedAt: string | null;
  bookingCreatedAt: string | null;
};

export type ShortletsOpsSlaRiskItem = {
  bookingId: string;
  respondBy: string;
  createdAt: string | null;
  listingId: string | null;
};

export type ShortletsOpsSnapshot = {
  reminders: {
    lastRun: ShortletsOpsReminderRun | null;
    lastSuccess: ShortletsOpsReminderRun | null;
    lastFailure: ShortletsOpsReminderRun | null;
    recentRuns: ShortletsOpsReminderRun[];
  };
  payouts: {
    requestedCount: number;
    oldestRequestedAt: string | null;
    lastPaidAt: string | null;
    recentRequested: ShortletsOpsPayoutRequest[];
  };
  mismatches: {
    stuckSucceededPaymentCount: number;
    sample: ShortletsOpsPaymentMismatch[];
  };
  sla: {
    dueSoonCount: number;
    overdueCount: number;
    sample: ShortletsOpsSlaRiskItem[];
  };
};

function isMissingSchemaError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("does not exist") ||
    normalized.includes("could not find") ||
    normalized.includes("relation") ||
    normalized.includes("column")
  );
}

function toIsoString(value: unknown): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

function toReminderRun(row: Record<string, unknown>): ShortletsOpsReminderRun | null {
  const runKey = String(row.run_key || "").trim();
  const statusRaw = String(row.status || "").trim().toLowerCase();
  if (!runKey || (statusRaw !== "started" && statusRaw !== "succeeded" && statusRaw !== "failed")) {
    return null;
  }
  return {
    runKey,
    startedAt: toIsoString(row.started_at),
    finishedAt: toIsoString(row.finished_at),
    status: statusRaw,
    meta:
      typeof row.meta === "object" && row.meta && !Array.isArray(row.meta)
        ? (row.meta as JsonRecord)
        : {},
    error: typeof row.error === "string" ? row.error : null,
  };
}

async function loadReminderRuns(client: UntypedAdminClient) {
  const result = await client
    .from("shortlet_job_runs")
    .select("job_name,run_key,started_at,finished_at,status,meta,error")
    .eq("job_name", REMINDERS_JOB_NAME)
    .order("started_at", { ascending: false })
    .range(0, 49);

  if (result.error) {
    if (isMissingSchemaError(String(result.error.message || ""))) {
      return [] as ShortletsOpsReminderRun[];
    }
    throw new Error(result.error.message || "Unable to load shortlet reminder runs");
  }

  return (((result.data as Array<Record<string, unknown>> | null) ?? [])
    .map((row) => toReminderRun(row))
    .filter((row): row is ShortletsOpsReminderRun => !!row));
}

type PayoutRequestAuditRow = {
  payout_id: string;
  booking_id: string;
  created_at: string;
};

type PayoutStatusRow = {
  id: string;
  status: "eligible" | "paid";
  paid_at: string | null;
  updated_at: string | null;
  created_at: string | null;
};

async function loadPayoutSignals(client: UntypedAdminClient) {
  const auditResult = await client
    .from("shortlet_payout_audit")
    .select("payout_id,booking_id,created_at")
    .eq("action", "request_payout")
    .order("created_at", { ascending: false })
    .range(0, 499);

  if (auditResult.error) {
    throw new Error(auditResult.error.message || "Unable to load payout request audit rows");
  }

  let payoutResult = await client
    .from("shortlet_payouts")
    .select("id,status,paid_at,updated_at,created_at")
    .order("updated_at", { ascending: false })
    .range(0, 499);
  if (
    payoutResult.error &&
    String(payoutResult.error.message || "").toLowerCase().includes("updated_at")
  ) {
    payoutResult = await client
      .from("shortlet_payouts")
      .select("id,status,paid_at,created_at")
      .order("created_at", { ascending: false })
      .range(0, 499);
  }
  if (payoutResult.error) {
    throw new Error(payoutResult.error.message || "Unable to load payout statuses");
  }

  const payoutRows = (((payoutResult.data as Array<Record<string, unknown>> | null) ?? [])
    .map((row) => {
      const id = String(row.id || "").trim();
      if (!id) return null;
      return {
        id,
        status: row.status === "paid" ? "paid" : "eligible",
        paid_at: toIsoString(row.paid_at),
        updated_at: toIsoString(row.updated_at),
        created_at: toIsoString(row.created_at),
      } as PayoutStatusRow;
    })
    .filter((row): row is PayoutStatusRow => !!row));

  const statusByPayoutId = new Map(payoutRows.map((row) => [row.id, row]));
  const auditRows = (((auditResult.data as Array<Record<string, unknown>> | null) ?? [])
    .map((row) => {
      const payoutId = String(row.payout_id || "").trim();
      const bookingId = String(row.booking_id || "").trim();
      const createdAt = toIsoString(row.created_at);
      if (!payoutId || !bookingId || !createdAt) return null;
      return {
        payout_id: payoutId,
        booking_id: bookingId,
        created_at: createdAt,
      } as PayoutRequestAuditRow;
    })
    .filter((row): row is PayoutRequestAuditRow => !!row));

  const latestRequestByPayoutId = new Map<string, PayoutRequestAuditRow>();
  for (const row of auditRows) {
    if (latestRequestByPayoutId.has(row.payout_id)) continue;
    latestRequestByPayoutId.set(row.payout_id, row);
  }

  const requestedQueueRows: Array<PayoutRequestAuditRow & { status: "eligible" | "paid" }> = [];
  const recentRequested: ShortletsOpsPayoutRequest[] = [];
  for (const row of latestRequestByPayoutId.values()) {
    const payout = statusByPayoutId.get(row.payout_id);
    const status = payout?.status === "paid" ? "paid" : "eligible";
    if (status !== "paid") {
      requestedQueueRows.push({ ...row, status });
    }
    recentRequested.push({
      payoutId: row.payout_id,
      bookingId: row.booking_id,
      requestedAt: row.created_at,
      status,
    });
  }

  recentRequested.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  requestedQueueRows.sort((a, b) => a.created_at.localeCompare(b.created_at));

  const oldestRequestedAt = requestedQueueRows[0]?.created_at ?? null;
  const lastPaidAt = payoutRows
    .map((row) => row.paid_at || row.updated_at || row.created_at)
    .filter(Boolean)
    .sort((a, b) => String(b).localeCompare(String(a)))
    .find((value, index) => payoutRows[index]?.status === "paid") || null;
  const paidAtSorted = payoutRows
    .filter((row) => row.status === "paid")
    .map((row) => row.paid_at || row.updated_at || row.created_at)
    .filter(Boolean)
    .sort((a, b) => String(b).localeCompare(String(a)));

  return {
    requestedCount: requestedQueueRows.length,
    oldestRequestedAt,
    lastPaidAt: paidAtSorted[0] ?? lastPaidAt,
    recentRequested: recentRequested.slice(0, 10),
  };
}

async function loadPaymentMismatches(input: {
  client: UntypedAdminClient;
  now: Date;
  staleMinutes: number;
}) {
  const cutoff = new Date(input.now.getTime() - input.staleMinutes * 60_000).toISOString();
  let paymentResult = await input.client
    .from("shortlet_payments")
    .select("id,booking_id,status,updated_at,created_at")
    .eq("status", "succeeded")
    .lt("updated_at", cutoff)
    .order("updated_at", { ascending: true })
    .range(0, 399);
  if (
    paymentResult.error &&
    String(paymentResult.error.message || "").toLowerCase().includes("updated_at")
  ) {
    paymentResult = await input.client
      .from("shortlet_payments")
      .select("id,booking_id,status,created_at")
      .eq("status", "succeeded")
      .lt("created_at", cutoff)
      .order("created_at", { ascending: true })
      .range(0, 399);
  }
  if (paymentResult.error) {
    throw new Error(paymentResult.error.message || "Unable to load shortlet payments");
  }

  const payments = (((paymentResult.data as Array<Record<string, unknown>> | null) ?? [])
    .map((row) => {
      const paymentId = String(row.id || "").trim();
      const bookingId = String(row.booking_id || "").trim();
      if (!paymentId || !bookingId) return null;
      return {
        paymentId,
        bookingId,
        paymentUpdatedAt: toIsoString(row.updated_at) || toIsoString(row.created_at),
      };
    })
    .filter((row): row is { paymentId: string; bookingId: string; paymentUpdatedAt: string | null } => !!row));

  if (!payments.length) {
    return { stuckSucceededPaymentCount: 0, sample: [] as ShortletsOpsPaymentMismatch[] };
  }

  const bookingIds = Array.from(new Set(payments.map((row) => row.bookingId)));
  const bookingsResult = await input.client
    .from("shortlet_bookings")
    .select("id,status,created_at,property_id")
    .in("id", bookingIds)
    .range(0, bookingIds.length - 1);

  if (bookingsResult.error) {
    throw new Error(bookingsResult.error.message || "Unable to load shortlet bookings");
  }

  const bookingById = new Map(
    (((bookingsResult.data as Array<Record<string, unknown>> | null) ?? [])
      .map((row) => [String(row.id || ""), row] as const)
      .filter(([id]) => !!id))
  );

  const sample = payments
    .map((row) => {
      const booking = bookingById.get(row.bookingId);
      const bookingStatus = String(booking?.status || "").trim().toLowerCase();
      if (bookingStatus !== "pending_payment") return null;
      return {
        bookingId: row.bookingId,
        paymentId: row.paymentId,
        paymentUpdatedAt: row.paymentUpdatedAt,
        bookingCreatedAt: toIsoString(booking?.created_at),
      } satisfies ShortletsOpsPaymentMismatch;
    })
    .filter((row): row is ShortletsOpsPaymentMismatch => !!row);

  sample.sort((a, b) => String(a.paymentUpdatedAt || "").localeCompare(String(b.paymentUpdatedAt || "")));
  return {
    stuckSucceededPaymentCount: sample.length,
    sample: sample.slice(0, 10),
  };
}

async function loadSlaRisk(input: {
  client: UntypedAdminClient;
  now: Date;
  dueSoonHours: number;
}) {
  const result = await input.client
    .from("shortlet_bookings")
    .select("id,property_id,status,respond_by,created_at")
    .eq("status", "pending")
    .not("respond_by", "is", null)
    .order("respond_by", { ascending: true })
    .range(0, 499);

  if (result.error) {
    if (String(result.error.message || "").toLowerCase().includes("respond_by")) {
      return {
        dueSoonCount: 0,
        overdueCount: 0,
        sample: [] as ShortletsOpsSlaRiskItem[],
      };
    }
    throw new Error(result.error.message || "Unable to load pending shortlet approvals");
  }

  const nowMs = input.now.getTime();
  const dueSoonMaxMs = nowMs + input.dueSoonHours * 60 * 60 * 1000;
  const dueSoon: ShortletsOpsSlaRiskItem[] = [];
  const overdue: ShortletsOpsSlaRiskItem[] = [];

  for (const row of ((result.data as Array<Record<string, unknown>> | null) ?? [])) {
    const bookingId = String(row.id || "").trim();
    const respondBy = toIsoString(row.respond_by);
    if (!bookingId || !respondBy) continue;
    const respondByMs = Date.parse(respondBy);
    if (!Number.isFinite(respondByMs)) continue;
    const item: ShortletsOpsSlaRiskItem = {
      bookingId,
      respondBy,
      createdAt: toIsoString(row.created_at),
      listingId: String(row.property_id || "").trim() || null,
    };
    if (respondByMs < nowMs) {
      overdue.push(item);
      continue;
    }
    if (respondByMs <= dueSoonMaxMs) {
      dueSoon.push(item);
    }
  }

  overdue.sort((a, b) => a.respondBy.localeCompare(b.respondBy));
  dueSoon.sort((a, b) => a.respondBy.localeCompare(b.respondBy));

  return {
    dueSoonCount: dueSoon.length,
    overdueCount: overdue.length,
    sample: [...overdue, ...dueSoon].slice(0, 10),
  };
}

export async function getShortletsOpsSnapshot(input: {
  client: UntypedAdminClient;
  now: Date;
  mismatchThresholdMinutes?: number;
  slaDueSoonHours?: number;
}): Promise<ShortletsOpsSnapshot> {
  const reminderRuns = await loadReminderRuns(input.client);
  const payouts = await loadPayoutSignals(input.client);
  const mismatches = await loadPaymentMismatches({
    client: input.client,
    now: input.now,
    staleMinutes: input.mismatchThresholdMinutes ?? 5,
  });
  const sla = await loadSlaRisk({
    client: input.client,
    now: input.now,
    dueSoonHours: input.slaDueSoonHours ?? 2,
  });

  const recentRuns = reminderRuns.slice(0, 10);
  const lastRun = recentRuns[0] ?? null;
  const lastSuccess = recentRuns.find((row) => row.status === "succeeded") ?? null;
  const lastFailure = recentRuns.find((row) => row.status === "failed") ?? null;

  return {
    reminders: {
      lastRun,
      lastSuccess,
      lastFailure,
      recentRuns,
    },
    payouts,
    mismatches,
    sla,
  };
}
