import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { isUuidLike } from "@/lib/referrals/share-tracking.server";

const routeLabel = "/api/referrals/invites/[id]";

const patchSchema = z
  .object({
    invitee_name: z.string().trim().min(1).max(120).optional(),
    invitee_contact: z.string().trim().max(180).nullable().optional(),
    campaign_id: z.string().uuid().nullable().optional(),
    status: z.enum(["draft", "sent", "reminded", "converted", "closed"]).optional(),
    reminder_at: z.string().datetime().nullable().optional(),
    notes: z.string().trim().max(500).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["agent", "landlord", "admin"],
  });
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  if (!id || !isUuidLike(id)) {
    return NextResponse.json({ error: "Invalid invite id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 422 });
  }

  if (parsed.data.campaign_id) {
    const { data: campaign } = await auth.supabase
      .from("referral_share_campaigns")
      .select("id")
      .eq("owner_id", auth.user.id)
      .eq("id", parsed.data.campaign_id)
      .maybeSingle();
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    }
  }

  const payload: Record<string, unknown> = {};
  if (parsed.data.invitee_name !== undefined) payload.invitee_name = parsed.data.invitee_name;
  if (parsed.data.invitee_contact !== undefined) {
    payload.invitee_contact = parsed.data.invitee_contact?.trim() ? parsed.data.invitee_contact : null;
  }
  if (parsed.data.campaign_id !== undefined) payload.campaign_id = parsed.data.campaign_id;
  if (parsed.data.status !== undefined) payload.status = parsed.data.status;
  if (parsed.data.reminder_at !== undefined) payload.reminder_at = parsed.data.reminder_at;
  if (parsed.data.notes !== undefined) payload.notes = parsed.data.notes?.trim() ? parsed.data.notes : null;

  const { data, error } = await auth.supabase
    .from("referral_invites")
    .update(payload)
    .eq("owner_id", auth.user.id)
    .eq("id", id)
    .select(
      "id, owner_id, campaign_id, invitee_name, invitee_contact, status, reminder_at, notes, created_at"
    )
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Invite not found" }, { status: 404 });

  return NextResponse.json({ ok: true, invite: data });
}
