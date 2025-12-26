import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { logApprovalAction } from "@/lib/observability";

const routeLabel = "/api/admin/properties/[id]";

const bodySchema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z.string().optional().nullable(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const { id } = await context.params;
  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;
  const supabase = auth.supabase;

  const body = await request.json();
  const { action, reason } = bodySchema.parse(body);
  const isApproved = action === "approve";
  const now = new Date().toISOString();
  const trimmedReason = typeof reason === "string" ? reason.trim() : "";

  if (!isApproved && !trimmedReason) {
    return NextResponse.json({ error: "Rejection reason is required." }, { status: 400 });
  }

  const { error } = await supabase
    .from("properties")
    .update(
      isApproved
        ? {
            status: "live",
            is_approved: true,
            is_active: true,
            approved_at: now,
            rejection_reason: null,
            rejected_at: null,
          }
        : {
            status: "rejected",
            is_approved: false,
            is_active: false,
            rejected_at: now,
            rejection_reason: trimmedReason,
          }
    )
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  logApprovalAction({
    request,
    route: routeLabel,
    actorId: auth.user.id,
    propertyId: id,
    action,
    reasonProvided: !isApproved,
  });

  return NextResponse.json({ id, is_approved: isApproved });
}
