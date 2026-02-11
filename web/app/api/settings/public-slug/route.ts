import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import {
  enforcePublicSlugCooldown,
  validatePublicSlugInput,
} from "@/lib/advertisers/public-slug-policy";

export const dynamic = "force-dynamic";

const routeLabel = "/api/settings/public-slug";

const patchBodySchema = z.object({
  slug: z.string(),
});

type AnyClient = Pick<SupabaseClient, "from">;

type ProfileSlugRow = {
  id?: string | null;
  role?: string | null;
  public_slug?: string | null;
};

type HistoryRow = {
  profile_id?: string | null;
  old_slug?: string | null;
  changed_at?: string | null;
};

export type PublicSlugRouteDeps = {
  requireRole: typeof requireRole;
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  createServiceRoleClient: typeof createServiceRoleClient;
};

const defaultDeps: PublicSlugRouteDeps = {
  requireRole,
  hasServiceRoleEnv,
  createServiceRoleClient,
};

function normalizeSlug(value?: string | null) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

async function loadProfile(client: AnyClient, userId: string) {
  const { data, error } = await client
    .from("profiles")
    .select("id, role, public_slug")
    .eq("id", userId)
    .maybeSingle();
  return { row: (data as ProfileSlugRow | null) ?? null, error };
}

async function findProfileBySlug(client: AnyClient, slug: string) {
  const { data, error } = await client
    .from("profiles")
    .select("id")
    .ilike("public_slug", slug)
    .limit(1)
    .maybeSingle();
  return { row: (data as { id?: string | null } | null) ?? null, error };
}

async function findHistoryByOldSlug(client: AnyClient, slug: string) {
  const { data, error } = await client
    .from("profile_slug_history")
    .select("profile_id, old_slug")
    .ilike("old_slug", slug)
    .limit(1)
    .maybeSingle();
  return { row: (data as HistoryRow | null) ?? null, error };
}

async function loadLatestSlugChange(client: AnyClient, profileId: string) {
  const { data, error } = await client
    .from("profile_slug_history")
    .select("changed_at")
    .eq("profile_id", profileId)
    .order("changed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return { row: (data as Pick<HistoryRow, "changed_at"> | null) ?? null, error };
}

export async function getPublicSlugAvailabilityResponse(
  request: Request,
  deps: PublicSlugRouteDeps = defaultDeps
) {
  const startTime = Date.now();
  const auth = await deps.requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["agent", "landlord"],
  });
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const candidate = url.searchParams.get("slug");
  const validation = validatePublicSlugInput(candidate);
  if (!validation.ok) {
    return NextResponse.json({
      ok: true,
      available: false,
      status: "invalid",
      message: validation.message,
    });
  }

  const client = (deps.hasServiceRoleEnv()
    ? deps.createServiceRoleClient()
    : auth.supabase) as unknown as AnyClient;
  const profileRes = await loadProfile(client, auth.user.id);
  if (profileRes.error || !profileRes.row?.id) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }
  const currentSlug = normalizeSlug(profileRes.row.public_slug);
  if (currentSlug === validation.slug) {
    return NextResponse.json({
      ok: true,
      available: true,
      status: "current",
      message: "This is your current public link.",
      slug: validation.slug,
    });
  }

  const [profileSlugMatch, historySlugMatch] = await Promise.all([
    findProfileBySlug(client, validation.slug),
    findHistoryByOldSlug(client, validation.slug),
  ]);
  if (profileSlugMatch.error || historySlugMatch.error) {
    return NextResponse.json({ error: "Unable to check slug availability." }, { status: 500 });
  }

  const takenByProfile =
    !!profileSlugMatch.row?.id && profileSlugMatch.row.id !== profileRes.row.id;
  const takenByHistory =
    !!historySlugMatch.row?.old_slug &&
    normalizeSlug(historySlugMatch.row.old_slug) === validation.slug;
  if (takenByProfile || takenByHistory) {
    return NextResponse.json({
      ok: true,
      available: false,
      status: "taken",
      message: "This link is already taken.",
      slug: validation.slug,
    });
  }

  return NextResponse.json({
    ok: true,
    available: true,
    status: "available",
    message: "Available",
    slug: validation.slug,
  });
}

export async function patchPublicSlugResponse(
  request: Request,
  deps: PublicSlugRouteDeps = defaultDeps
) {
  const startTime = Date.now();
  const auth = await deps.requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["agent", "landlord"],
  });
  if (!auth.ok) return auth.response;

  const parsed = patchBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 422 });
  }

  const validation = validatePublicSlugInput(parsed.data.slug);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.message }, { status: 422 });
  }

  const client = (deps.hasServiceRoleEnv()
    ? deps.createServiceRoleClient()
    : auth.supabase) as unknown as AnyClient;
  const profileRes = await loadProfile(client, auth.user.id);
  if (profileRes.error || !profileRes.row?.id) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  const currentSlug = normalizeSlug(profileRes.row.public_slug);
  if (currentSlug === validation.slug) {
    return NextResponse.json({
      ok: true,
      slug: validation.slug,
      changed: false,
    });
  }

  const latestChange = await loadLatestSlugChange(client, profileRes.row.id);
  if (latestChange.error) {
    return NextResponse.json({ error: "Unable to verify slug cooldown." }, { status: 500 });
  }
  const cooldown = enforcePublicSlugCooldown({
    lastChangedAt: latestChange.row?.changed_at ?? null,
  });
  if (!cooldown.ok) {
    return NextResponse.json(
      {
        error: cooldown.message,
        nextAllowedAt: cooldown.nextAllowedAt,
      },
      { status: 429 }
    );
  }

  const [profileSlugMatch, historySlugMatch] = await Promise.all([
    findProfileBySlug(client, validation.slug),
    findHistoryByOldSlug(client, validation.slug),
  ]);
  if (profileSlugMatch.error || historySlugMatch.error) {
    return NextResponse.json({ error: "Unable to validate slug uniqueness." }, { status: 500 });
  }

  const takenByProfile =
    !!profileSlugMatch.row?.id && profileSlugMatch.row.id !== profileRes.row.id;
  const takenByHistory =
    !!historySlugMatch.row?.old_slug &&
    normalizeSlug(historySlugMatch.row.old_slug) === validation.slug;

  if (takenByProfile || takenByHistory) {
    return NextResponse.json({ error: "That public link is already taken." }, { status: 409 });
  }

  let insertedHistory = false;
  if (currentSlug) {
    const { error: historyInsertError } = await client.from("profile_slug_history").insert({
      profile_id: profileRes.row.id,
      old_slug: currentSlug,
      new_slug: validation.slug,
    });
    if (historyInsertError) {
      if (historyInsertError.code === "23505") {
        return NextResponse.json({ error: "That public link is already taken." }, { status: 409 });
      }
      return NextResponse.json({ error: "Unable to store slug history." }, { status: 500 });
    }
    insertedHistory = true;
  }

  const { error: updateError } = await client
    .from("profiles")
    .update({ public_slug: validation.slug })
    .eq("id", profileRes.row.id);

  if (updateError) {
    if (insertedHistory) {
      await client
        .from("profile_slug_history")
        .delete()
        .eq("profile_id", profileRes.row.id)
        .eq("old_slug", currentSlug)
        .eq("new_slug", validation.slug);
    }
    if (updateError.code === "23505") {
      return NextResponse.json({ error: "That public link is already taken." }, { status: 409 });
    }
    return NextResponse.json({ error: "Unable to update public link." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    changed: true,
    slug: validation.slug,
  });
}

export async function GET(request: Request) {
  return getPublicSlugAvailabilityResponse(request);
}

export async function PATCH(request: Request) {
  return patchPublicSlugResponse(request);
}
