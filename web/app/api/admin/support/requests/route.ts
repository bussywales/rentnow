import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";

const routeLabel = "/api/admin/support/requests";

export const dynamic = "force-dynamic";

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

type SupportRequestItem = {
  id: string;
  createdAt: string | null;
  category: string;
  email: string | null;
  name: string | null;
  status: string;
  role: string | null;
  message: string;
  excerpt: string;
  escalated: boolean;
  metadata: Record<string, unknown>;
  transcript: Array<{ role: "user" | "assistant"; content: string }>;
  claimedBy: string | null;
  claimedAt: string | null;
  resolvedAt: string | null;
  ageMinutes: number;
  slaMinutes: number | null;
  isOverdue: boolean;
};

type AdminSupportStatusFilter = "open" | "all" | "new" | "in_progress" | "resolved" | "closed";
type AdminSupportAssignedFilter = "all" | "me" | "unassigned";

function parseIntParam(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function isEscalatedRequest(row: SupportRequestRow) {
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  const escalationReason = (metadata as Record<string, unknown>).escalationReason;
  const transcript = (metadata as Record<string, unknown>).aiTranscript;
  if (typeof escalationReason === "string" && escalationReason.trim().length > 0) return true;
  if (Array.isArray(transcript) && transcript.length > 0) return true;
  return typeof row.message === "string" && row.message.includes("Context:");
}

function toTranscript(metadata: Record<string, unknown>) {
  const raw = metadata.aiTranscript;
  if (!Array.isArray(raw)) return [] as Array<{ role: "user" | "assistant"; content: string }>;
  return raw
    .filter((item): item is { role: "user" | "assistant"; content: string } => {
      if (!item || typeof item !== "object") return false;
      const role = (item as Record<string, unknown>).role;
      const content = (item as Record<string, unknown>).content;
      return (role === "user" || role === "assistant") && typeof content === "string";
    })
    .slice(0, 80);
}

export function computeSupportSlaState(input: {
  status: string | null | undefined;
  createdAt: string | null | undefined;
  nowMs?: number;
}) {
  const status = String(input.status || "new")
    .trim()
    .toLowerCase();
  const createdMs = Date.parse(String(input.createdAt || ""));
  const safeNowMs = Number.isFinite(input.nowMs) ? Number(input.nowMs) : Date.now();
  const ageMinutes = Number.isFinite(createdMs)
    ? Math.max(0, Math.floor((safeNowMs - createdMs) / (60 * 1000)))
    : 0;

  if (status === "resolved" || status === "closed") {
    return {
      ageMinutes,
      slaMinutes: null as number | null,
      isOverdue: false,
    };
  }

  const slaMinutes = status === "in_progress" ? 48 * 60 : 24 * 60;
  return {
    ageMinutes,
    slaMinutes,
    isOverdue: ageMinutes >= slaMinutes,
  };
}

function toItem(row: SupportRequestRow, nowMs: number): SupportRequestItem {
  const metadata =
    row.metadata && typeof row.metadata === "object"
      ? (row.metadata as Record<string, unknown>)
      : {};
  const role = typeof metadata.role === "string" ? metadata.role : null;
  const message = typeof row.message === "string" ? row.message : "";
  const excerpt = message.replace(/\s+/g, " ").trim().slice(0, 140);
  const slaState = computeSupportSlaState({
    status: row.status,
    createdAt: row.created_at,
    nowMs,
  });
  return {
    id: row.id,
    createdAt: row.created_at ?? null,
    category: row.category || "general",
    email: row.email ?? null,
    name: row.name ?? null,
    status: row.status || "new",
    role,
    message,
    excerpt,
    escalated: isEscalatedRequest(row),
    metadata,
    transcript: toTranscript(metadata),
    claimedBy: typeof row.claimed_by === "string" ? row.claimed_by : null,
    claimedAt: typeof row.claimed_at === "string" ? row.claimed_at : null,
    resolvedAt: typeof row.resolved_at === "string" ? row.resolved_at : null,
    ageMinutes: slaState.ageMinutes,
    slaMinutes: slaState.slaMinutes,
    isOverdue: slaState.isOverdue,
  };
}

function resolveStatusFilter(value: string | null): AdminSupportStatusFilter {
  if (value === "all") return "all";
  if (value === "new") return "new";
  if (value === "in_progress") return "in_progress";
  if (value === "resolved") return "resolved";
  if (value === "closed") return "closed";
  return "open";
}

function resolveAssignedFilter(value: string | null): AdminSupportAssignedFilter {
  if (value === "me") return "me";
  if (value === "unassigned") return "unassigned";
  return "all";
}

export type AdminSupportRequestsDeps = {
  requireRole: typeof requireRole;
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  createServiceRoleClient: typeof createServiceRoleClient;
  loadRows: (client: UntypedAdminClient, fetchLimit: number) => Promise<SupportRequestRow[]>;
};

const defaultDeps: AdminSupportRequestsDeps = {
  requireRole,
  hasServiceRoleEnv,
  createServiceRoleClient,
  async loadRows(client, fetchLimit) {
    const { data, error } = await client
      .from("support_requests")
      .select("id,created_at,category,email,name,message,status,metadata,claimed_by,claimed_at,resolved_at")
      .order("created_at", { ascending: false })
      .range(0, Math.max(0, fetchLimit - 1));
    if (error) {
      throw new Error(error.message || "Unable to load support requests.");
    }
    return ((data as SupportRequestRow[] | null) ?? []).map((row) => ({
      ...row,
      metadata:
        row && typeof row.metadata === "object"
          ? (row.metadata as Record<string, unknown>)
          : {},
    }));
  },
};

export async function getAdminSupportRequestsResponse(
  request: NextRequest,
  deps: AdminSupportRequestsDeps = defaultDeps
) {
  const startTime = Date.now();
  const auth = await deps.requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const status = resolveStatusFilter(searchParams.get("status"));
  const assigned = resolveAssignedFilter(searchParams.get("assigned"));
  const escalatedOnly = searchParams.get("escalated") === "1";
  const limit = parseIntParam(searchParams.get("limit"), 20, 1, 100);
  const offset = parseIntParam(searchParams.get("offset"), 0, 0, 5000);

  const fetchLimit = Math.min(Math.max(200, offset + limit * 4), 1000);
  const client = deps.hasServiceRoleEnv()
    ? (deps.createServiceRoleClient() as unknown as UntypedAdminClient)
    : (auth.supabase as unknown as UntypedAdminClient);
  const nowMs = Date.now();

  try {
    const rows = await deps.loadRows(client, fetchLimit);
    const mapped = rows.map((row) => toItem(row, nowMs));
    const filtered = mapped.filter((row) => {
      const normalizedStatus = row.status.toLowerCase();
      if (status === "open" && (normalizedStatus === "resolved" || normalizedStatus === "closed")) return false;
      if (status !== "open" && status !== "all" && normalizedStatus !== status) return false;
      if (escalatedOnly && !row.escalated) return false;
      if (assigned === "me" && row.claimedBy !== auth.user.id) return false;
      if (assigned === "unassigned" && !!row.claimedBy) return false;
      return true;
    });

    const paginated = filtered.slice(offset, offset + limit);
    return NextResponse.json({
      ok: true,
      filters: {
        status,
        assigned,
        escalated: escalatedOnly,
        limit,
        offset,
      },
      pagination: {
        total: filtered.length,
        hasMore: offset + paginated.length < filtered.length,
      },
      items: paginated,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load support requests.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return getAdminSupportRequestsResponse(request, defaultDeps);
}
