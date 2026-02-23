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
};

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

function toItem(row: SupportRequestRow): SupportRequestItem {
  const metadata =
    row.metadata && typeof row.metadata === "object"
      ? (row.metadata as Record<string, unknown>)
      : {};
  const role = typeof metadata.role === "string" ? metadata.role : null;
  const message = typeof row.message === "string" ? row.message : "";
  const excerpt = message.replace(/\s+/g, " ").trim().slice(0, 140);
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
  };
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
      .select("id,created_at,category,email,name,message,status,metadata")
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
  const status = searchParams.get("status") === "all" ? "all" : "open";
  const escalatedOnly = searchParams.get("escalated") === "1";
  const limit = parseIntParam(searchParams.get("limit"), 20, 1, 100);
  const offset = parseIntParam(searchParams.get("offset"), 0, 0, 5000);

  const fetchLimit = Math.min(Math.max(200, offset + limit * 4), 1000);
  const client = deps.hasServiceRoleEnv()
    ? (deps.createServiceRoleClient() as unknown as UntypedAdminClient)
    : (auth.supabase as unknown as UntypedAdminClient);

  try {
    const rows = await deps.loadRows(client, fetchLimit);
    const mapped = rows.map(toItem);
    const filtered = mapped.filter((row) => {
      if (status === "open" && row.status.toLowerCase() === "resolved") return false;
      if (escalatedOnly && !row.escalated) return false;
      return true;
    });

    const paginated = filtered.slice(offset, offset + limit);
    return NextResponse.json({
      ok: true,
      filters: {
        status,
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
