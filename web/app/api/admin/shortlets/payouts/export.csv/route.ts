import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { listAdminShortletPayouts } from "@/lib/shortlet/shortlet.server";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";

const routeLabel = "/api/admin/shortlets/payouts/export.csv";

function csvEscape(value: unknown): string {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  const statusParam = request.nextUrl.searchParams.get("status");
  const status = statusParam === "paid" ? "paid" : statusParam === "all" ? "all" : "eligible";
  const queueParam = request.nextUrl.searchParams.get("queue");
  const queue = queueParam === "all" ? "all" : "requested";

  const db = hasServiceRoleEnv()
    ? (createServiceRoleClient() as unknown as UntypedAdminClient)
    : ((await createServerSupabaseClient()) as unknown as UntypedAdminClient);

  const rows = await listAdminShortletPayouts({
    client: db as unknown as SupabaseClient,
    status,
    queue,
    limit: 1000,
  });

  const header = [
    "payout_id",
    "booking_id",
    "host_user_id",
    "property_id",
    "property_title",
    "currency",
    "amount_minor",
    "status",
    "booking_status",
    "booking_check_in",
    "booking_check_out",
    "paid_at",
    "paid_method",
    "paid_reference",
    "paid_by",
    "note",
    "request_status",
    "requested_at",
    "requested_by",
    "requested_method",
    "requested_note",
  ];

  const lines = [
    header.join(","),
    ...rows.map((row) =>
      [
        row.id,
        row.booking_id,
        row.host_user_id,
        row.property_id,
        row.property_title,
        row.currency,
        row.amount_minor,
        row.status,
        row.booking_status,
        row.booking_check_in,
        row.booking_check_out,
        row.paid_at,
        row.paid_method,
        row.paid_reference,
        row.paid_by,
        row.note,
        row.request_status,
        row.requested_at,
        row.requested_by,
        row.requested_method,
        row.requested_note,
      ]
        .map(csvEscape)
        .join(",")
    ),
  ];

  return new NextResponse(lines.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"shortlet-payouts-${status}-${queue}.csv\"`,
      "Cache-Control": "no-store",
    },
  });
}
