import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { hasActiveDelegation } from "@/lib/agent-delegations";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { canHostManageShortletBooking } from "@/lib/shortlet/access";
import { mapLegacyListingIntent } from "@/lib/shortlet/shortlet.server";

const routeLabel = "/api/shortlet/blocks";

const createBlockSchema = z.object({
  property_id: z.string().uuid(),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().trim().max(280).optional(),
});

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  if (!hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Service role not configured" }, { status: 503 });
  }

  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["landlord", "agent", "admin"],
  });
  if (!auth.ok) return auth.response;

  const parsed = createBlockSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 422 });
  }

  if (parsed.data.date_to <= parsed.data.date_from) {
    return NextResponse.json({ error: "date_to must be after date_from" }, { status: 422 });
  }

  const supabase = await createServerSupabaseClient();
  const { data: propertyRow, error: propertyError } = await supabase
    .from("properties")
    .select("id,owner_id,listing_intent")
    .eq("id", parsed.data.property_id)
    .maybeSingle();

  if (propertyError || !propertyRow) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  const listingIntent = mapLegacyListingIntent(propertyRow.listing_intent);
  if (listingIntent !== "shortlet") {
    return NextResponse.json(
      { error: "Only shortlet listings can be blocked." },
      { status: 409 }
    );
  }

  let canManage = canHostManageShortletBooking({
    actorRole: auth.role,
    actorUserId: auth.user.id,
    hostUserId: String(propertyRow.owner_id || ""),
    hasDelegation: false,
  });

  if (!canManage && auth.role === "agent") {
    const hasDelegation = await hasActiveDelegation(
      supabase,
      auth.user.id,
      String(propertyRow.owner_id || "")
    );
    canManage = canHostManageShortletBooking({
      actorRole: auth.role,
      actorUserId: auth.user.id,
      hostUserId: String(propertyRow.owner_id || ""),
      hasDelegation,
    });
  }

  if (!canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createServiceRoleClient() as unknown as {
    from: (table: string) => {
      insert: (values: Record<string, unknown>) => {
        select: (columns: string) => {
          maybeSingle: () => Promise<{
            data: Record<string, unknown> | null;
            error: { message?: string } | null;
          }>;
        };
      };
    };
  };
  const { data: inserted, error: insertError } = await admin
    .from("shortlet_blocks")
    .insert({
      property_id: parsed.data.property_id,
      date_from: parsed.data.date_from,
      date_to: parsed.data.date_to,
      reason: parsed.data.reason?.trim() || null,
    })
    .select("id,property_id,date_from,date_to,reason")
    .maybeSingle();

  if (insertError || !inserted) {
    const message = insertError?.message || "Unable to create block";
    return NextResponse.json({ error: message }, { status: 409 });
  }

  return NextResponse.json({
    ok: true,
    block: {
      id: String(inserted.id || ""),
      property_id: String(inserted.property_id || ""),
      date_from: String(inserted.date_from || ""),
      date_to: String(inserted.date_to || ""),
      reason: typeof inserted.reason === "string" ? inserted.reason : null,
    },
  });
}
