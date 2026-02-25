import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";

const routeLabel = "/api/admin/support/requests/export.csv";

export const dynamic = "force-dynamic";

type AdminSupportStatusFilter = "open" | "all" | "new" | "in_progress" | "resolved" | "closed";

type SupportRequestRow = {
  id: string;
  created_at: string | null;
  category: string | null;
  email: string | null;
  name: string | null;
  message: string | null;
  status: string | null;
  metadata?: Record<string, unknown> | null;
  claimed_by?: string | null;
  claimed_at?: string | null;
  resolved_at?: string | null;
};

export type AdminSupportRequestsCsvDeps = {
  requireRole: typeof requireRole;
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  createServiceRoleClient: typeof createServiceRoleClient;
  loadRows: (
    client: UntypedAdminClient,
    opts: { fromIso: string | null; toIso: string | null; limit: number }
  ) => Promise<SupportRequestRow[]>;
};

function resolveStatusFilter(value: string | null): AdminSupportStatusFilter {
  if (value === "all") return "all";
  if (value === "new") return "new";
  if (value === "in_progress") return "in_progress";
  if (value === "resolved") return "resolved";
  if (value === "closed") return "closed";
  return "open";
}

function toIsoBoundary(value: string | null, endOfDay: boolean) {
  const raw = (value || "").trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return `${raw}${endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z"}`;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function isEscalatedRequest(row: SupportRequestRow) {
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  const escalationReason = (metadata as Record<string, unknown>).escalationReason;
  const transcript = (metadata as Record<string, unknown>).aiTranscript;
  if (typeof escalationReason === "string" && escalationReason.trim().length > 0) return true;
  if (Array.isArray(transcript) && transcript.length > 0) return true;
  return typeof row.message === "string" && row.message.includes("Context:");
}

function createdAtInRange(row: SupportRequestRow, fromIso: string | null, toIso: string | null) {
  if (!fromIso && !toIso) return true;
  const createdMs = Date.parse(String(row.created_at || ""));
  if (!Number.isFinite(createdMs)) return false;
  if (fromIso) {
    const fromMs = Date.parse(fromIso);
    if (Number.isFinite(fromMs) && createdMs < fromMs) return false;
  }
  if (toIso) {
    const toMs = Date.parse(toIso);
    if (Number.isFinite(toMs) && createdMs > toMs) return false;
  }
  return true;
}

function statusMatches(row: SupportRequestRow, statusFilter: AdminSupportStatusFilter) {
  const status = String(row.status || "new")
    .trim()
    .toLowerCase();
  if (statusFilter === "all") return true;
  if (statusFilter === "open") return status !== "resolved" && status !== "closed";
  return status === statusFilter;
}

function excerptFromMessage(message: string | null) {
  return String(message || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}

const defaultDeps: AdminSupportRequestsCsvDeps = {
  requireRole,
  hasServiceRoleEnv,
  createServiceRoleClient,
  async loadRows(client, opts) {
    let query = client
      .from("support_requests")
      .select("id,created_at,category,email,name,message,status,metadata,claimed_by,claimed_at,resolved_at")
      .order("created_at", { ascending: false })
      .range(0, Math.max(0, opts.limit - 1));

    if (opts.fromIso) {
      query = query.gte("created_at", opts.fromIso);
    }
    if (opts.toIso) {
      query = query.lte("created_at", opts.toIso);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message || "Unable to load support requests.");
    return ((data as SupportRequestRow[] | null) ?? []).map((row) => ({
      ...row,
      metadata:
        row && typeof row.metadata === "object"
          ? (row.metadata as Record<string, unknown>)
          : {},
    }));
  },
};

export async function getAdminSupportRequestsCsvResponse(
  request: NextRequest,
  deps: AdminSupportRequestsCsvDeps = defaultDeps
) {
  const startTime = Date.now();
  const auth = await deps.requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  const params = request.nextUrl.searchParams;
  const statusFilter = resolveStatusFilter(params.get("status"));
  const escalatedOnly = params.get("escalated") === "1";
  const fromIso = toIsoBoundary(params.get("date_from") ?? params.get("from"), false);
  const toIso = toIsoBoundary(params.get("date_to") ?? params.get("to"), true);

  const client = deps.hasServiceRoleEnv()
    ? (deps.createServiceRoleClient() as unknown as UntypedAdminClient)
    : (auth.supabase as unknown as UntypedAdminClient);

  try {
    const rows = await deps.loadRows(client, {
      fromIso,
      toIso,
      limit: 5000,
    });
    const filtered = rows.filter((row) => {
      if (!createdAtInRange(row, fromIso, toIso)) return false;
      if (!statusMatches(row, statusFilter)) return false;
      if (escalatedOnly && !isEscalatedRequest(row)) return false;
      return true;
    });

    const header = [
      "id",
      "created_at",
      "status",
      "category",
      "email",
      "name",
      "role",
      "escalated",
      "claimed_by",
      "claimed_at",
      "resolved_at",
      "message",
      "excerpt",
      "metadata",
    ];

    const lines = [
      header.join(","),
      ...filtered.map((row) => {
        const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
        const role = typeof (metadata as Record<string, unknown>).role === "string"
          ? String((metadata as Record<string, unknown>).role)
          : "";
        const values = [
          row.id,
          row.created_at,
          row.status || "new",
          row.category || "general",
          row.email,
          row.name,
          role,
          isEscalatedRequest(row) ? "yes" : "no",
          row.claimed_by,
          row.claimed_at,
          row.resolved_at,
          row.message || "",
          excerptFromMessage(row.message),
          JSON.stringify(metadata),
        ];
        return values.map(csvEscape).join(",");
      }),
    ];

    return new NextResponse(lines.join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="support-requests-${new Date()
          .toISOString()
          .slice(0, 10)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to export support requests.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return getAdminSupportRequestsCsvResponse(request, defaultDeps);
}
