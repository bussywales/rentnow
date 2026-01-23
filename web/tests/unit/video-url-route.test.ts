import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { handleVideoSignedUrl, type VideoUrlDeps } from "@/app/api/properties/[id]/video/url/route";

const makeRequest = () => new NextRequest("http://localhost/api/properties/test/video/url");

void test("signed URL route returns URL for authorized owner", async () => {
  const deps: VideoUrlDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => true,
    createServerSupabaseClient: async () => ({
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () =>
              table === "properties"
                ? { data: { id: "prop1", owner_id: "owner" } }
                : { data: { storage_path: "prop1/video.mp4" } },
          }),
        }),
      }),
    }),
    createServiceRoleClient: () => ({
      storage: {
        from: () => ({
          createSignedUrl: async () => ({ data: { signedUrl: "https://signed.test/video.mp4" } }),
        }),
      },
    }),
    requireUser: async () => ({ ok: true, user: { id: "owner" } }),
    getUserRole: async () => "landlord",
    getListingAccessResult: () => ({ ok: true, status: 200, code: "ok", message: "" }),
    readActingAsFromRequest: () => null,
    hasActiveDelegation: async () => false,
  };

  const res = await handleVideoSignedUrl(makeRequest(), "prop1", deps);
  assert.equal(res.status, 200);
  const json = (await res.json()) as { url?: string; expiresIn?: number };
  assert.equal(json.url, "https://signed.test/video.mp4");
  assert.equal(json.expiresIn, 600);
});

void test("signed URL route rejects unauthorized user", async () => {
  const deps: VideoUrlDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => true,
    createServerSupabaseClient: async () => ({
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () =>
              table === "properties"
                ? { data: { id: "prop1", owner_id: "owner" } }
                : { data: { storage_path: "prop1/video.mp4" } },
          }),
        }),
      }),
    }),
    createServiceRoleClient: () => ({
      storage: {
        from: () => ({
          createSignedUrl: async () => ({ data: { signedUrl: "https://signed.test/video.mp4" } }),
        }),
      },
    }),
    requireUser: async () => ({ ok: true, user: { id: "someone-else" } }),
    getUserRole: async () => "landlord",
    getListingAccessResult: () => ({ ok: true, status: 200, code: "ok", message: "" }),
    readActingAsFromRequest: () => null,
    hasActiveDelegation: async () => false,
  };

  const res = await handleVideoSignedUrl(makeRequest(), "prop1", deps);
  assert.equal(res.status, 403);
  const json = (await res.json()) as { code?: string };
  assert.equal(json.code, "VIDEO_NOT_ALLOWED");
});
