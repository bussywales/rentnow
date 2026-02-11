import test from "node:test";
import assert from "node:assert/strict";
import type { User } from "@supabase/supabase-js";
import {
  postAdvertiserShareResponse,
  type PostAdvertiserShareDeps,
} from "@/app/api/advertisers/[id]/share/route";

type ProfileRow = {
  id: string;
  role: string;
  public_slug: string | null;
};

function buildDeps(input: {
  profile: ProfileRow | null;
  user?: User | null;
  actorRole?: "agent" | "landlord" | "tenant" | "admin" | null;
  onAudit?: (entry: { event: string; meta?: Record<string, unknown> }) => void;
}): PostAdvertiserShareDeps {
  const supabase = {
    from: (table: string) => {
      assert.equal(table, "profiles");
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: input.profile, error: null }),
          }),
        }),
      };
    },
    auth: {
      getUser: async () => ({ data: { user: input.user ?? null }, error: null }),
    },
  };

  return {
    hasServerSupabaseEnv: () => true,
    createServerSupabaseClient: async () =>
      (supabase as unknown as Awaited<
        ReturnType<PostAdvertiserShareDeps["createServerSupabaseClient"]>
      >),
    fetchUserRole: async () => input.actorRole ?? null,
    resolveEventSessionKey: () => "sess_123",
    logAuditEvent: (event, ctx) => {
      input.onAudit?.({ event, meta: ctx.meta as Record<string, unknown> | undefined });
    },
  };
}

void test("advertiser share route rejects non-advertiser roles", async () => {
  const deps = buildDeps({
    profile: { id: "f2e308f8-ed6e-4f7e-a9dd-77ca840fdb39", role: "tenant", public_slug: null },
  });
  const req = new Request("http://localhost/api/advertisers/id/share", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ channel: "copy", surface: "agent_profile" }),
  });

  const res = await postAdvertiserShareResponse(
    req,
    "f2e308f8-ed6e-4f7e-a9dd-77ca840fdb39",
    deps
  );
  assert.equal(res.status, 404);
});

void test("advertiser share route logs audit event for valid advertiser", async () => {
  let loggedEvent: { event: string; meta?: Record<string, unknown> } | null = null;
  const deps = buildDeps({
    profile: {
      id: "f2e308f8-ed6e-4f7e-a9dd-77ca840fdb39",
      role: "agent",
      public_slug: "xthetic-studio-limited",
    },
    user: { id: "e1306037-6e72-4be5-a5f1-fdb98ea44395" } as User,
    actorRole: "agent",
    onAudit: (entry) => {
      loggedEvent = entry;
    },
  });
  const req = new Request("http://localhost/api/advertisers/id/share", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ channel: "whatsapp", surface: "agent_profile" }),
  });

  const res = await postAdvertiserShareResponse(
    req,
    "f2e308f8-ed6e-4f7e-a9dd-77ca840fdb39",
    deps
  );
  assert.equal(res.status, 200);
  assert.equal(loggedEvent?.event, "advertisers.profile_share_click");
  assert.equal(loggedEvent?.meta?.source, "profile_share");
  assert.equal(loggedEvent?.meta?.channel, "whatsapp");
  assert.equal(loggedEvent?.meta?.surface, "agent_profile");
  assert.equal(loggedEvent?.meta?.advertiser_slug, "xthetic-studio-limited");
});
