import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import {
  isUuidLike,
  normalizeReferralInviteInput,
} from "@/lib/referrals/share-tracking.server";

const routeLabel = "/api/referrals/invites";

export async function GET(request: Request) {
  const startTime = Date.now();
  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["agent", "landlord", "admin"],
  });
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.supabase
    .from("referral_invites")
    .select(
      "id, owner_id, campaign_id, invitee_name, invitee_contact, status, reminder_at, notes, created_at"
    )
    .eq("owner_id", auth.user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, invites: data ?? [] });
}

export async function POST(request: Request) {
  const startTime = Date.now();
  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["agent", "landlord", "admin"],
  });
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const payload = (body || {}) as Record<string, unknown>;
  const parsed = normalizeReferralInviteInput({
    invitee_name: String(payload.invitee_name || ""),
    invitee_contact: typeof payload.invitee_contact === "string" ? payload.invitee_contact : null,
    campaign_id: typeof payload.campaign_id === "string" ? payload.campaign_id : null,
    status: typeof payload.status === "string" ? payload.status : undefined,
    reminder_at: typeof payload.reminder_at === "string" ? payload.reminder_at : null,
    notes: typeof payload.notes === "string" ? payload.notes : null,
  });
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 422 });
  }

  if (parsed.value.campaign_id && !isUuidLike(parsed.value.campaign_id)) {
    return NextResponse.json({ error: "Invalid campaign id." }, { status: 422 });
  }

  if (parsed.value.campaign_id) {
    const { data: campaign } = await auth.supabase
      .from("referral_share_campaigns")
      .select("id")
      .eq("owner_id", auth.user.id)
      .eq("id", parsed.value.campaign_id)
      .maybeSingle();

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    }
  }

  const { data, error } = await auth.supabase
    .from("referral_invites")
    .insert({
      owner_id: auth.user.id,
      campaign_id: parsed.value.campaign_id,
      invitee_name: parsed.value.invitee_name,
      invitee_contact: parsed.value.invitee_contact,
      status: parsed.value.status,
      reminder_at: parsed.value.reminder_at,
      notes: parsed.value.notes,
      created_at: new Date().toISOString(),
    })
    .select(
      "id, owner_id, campaign_id, invitee_name, invitee_contact, status, reminder_at, notes, created_at"
    )
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "Unable to create invite." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, invite: data });
}
