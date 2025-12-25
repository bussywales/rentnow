import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";

const routeLabel = "/api/admin/properties/[id]";

const bodySchema = z.object({
  action: z.enum(["approve", "reject"]),
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
  const { action } = bodySchema.parse(body);
  const isApproved = action === "approve";

  const { error } = await supabase
    .from("properties")
    .update({ is_approved: isApproved })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ id, is_approved: isApproved });
}
