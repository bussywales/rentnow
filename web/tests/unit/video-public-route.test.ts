import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import {
  handlePublicVideoSignedUrl,
  type PublicVideoRouteDeps,
} from "@/app/api/properties/[id]/video/public/route";

const makeRequest = () =>
  new NextRequest("http://localhost/api/properties/test/video/public");

function createDeps(input?: {
  propertyRow?: Record<string, unknown> | null;
  includeDemoListings?: boolean;
  isPubliclyVisible?: boolean;
  canShowExpired?: boolean;
  signedUrl?: string;
}) {
  const propertyRow =
    input?.propertyRow ??
    ({
      id: "prop1",
      owner_id: "owner1",
      is_demo: false,
      is_approved: true,
      is_active: true,
      status: "live",
      expires_at: null,
      expired_at: null,
    } satisfies Record<string, unknown>);

  const deps: PublicVideoRouteDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => true,
    createServerSupabaseClient: async () =>
      ({
        auth: {
          getUser: async () => ({ data: { user: null } }),
        },
      }) as Awaited<ReturnType<PublicVideoRouteDeps["createServerSupabaseClient"]>>,
    createServiceRoleClient: () =>
      ({
        from: (table: string) => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => {
                if (table === "properties") {
                  return { data: propertyRow, error: null };
                }
                return { data: { storage_path: "prop1/video.mp4" }, error: null };
              },
            }),
          }),
        }),
        storage: {
          from: () => ({
            createSignedUrl: async () => ({
              data: { signedUrl: input?.signedUrl ?? "https://signed.test/video.mp4" },
              error: null,
            }),
          }),
        },
      }) as ReturnType<PublicVideoRouteDeps["createServiceRoleClient"]>,
    getUserRole: async () => "tenant",
    includeDemoListingsForViewerFromSettings: async () =>
      input?.includeDemoListings ?? true,
    getAppSettingBool: async () => false,
    isListingPubliclyVisible: () => input?.isPubliclyVisible ?? true,
    canShowExpiredListingPublic: () => input?.canShowExpired ?? false,
    now: () => new Date("2026-03-05T12:00:00.000Z"),
  };

  return deps;
}

void test("public video route returns signed URL for publicly visible listing", async () => {
  const response = await handlePublicVideoSignedUrl(
    makeRequest(),
    "prop1",
    createDeps()
  );
  assert.equal(response.status, 200);
  const json = (await response.json()) as { url?: string; expiresIn?: number };
  assert.equal(json.url, "https://signed.test/video.mp4");
  assert.equal(json.expiresIn, 600);
});

void test("public video route denies non-public listings", async () => {
  const response = await handlePublicVideoSignedUrl(
    makeRequest(),
    "prop1",
    createDeps({ isPubliclyVisible: false, canShowExpired: false })
  );
  assert.equal(response.status, 404);
  const json = (await response.json()) as { code?: string };
  assert.equal(json.code, "video_not_available");
});

void test("public video route respects demo visibility policy", async () => {
  const response = await handlePublicVideoSignedUrl(
    makeRequest(),
    "prop1",
    createDeps({
      propertyRow: {
        id: "prop1",
        owner_id: "owner1",
        is_demo: true,
        is_approved: true,
        is_active: true,
        status: "live",
        expires_at: null,
        expired_at: null,
      },
      includeDemoListings: false,
      isPubliclyVisible: true,
    })
  );
  assert.equal(response.status, 404);
  const json = (await response.json()) as { code?: string };
  assert.equal(json.code, "video_not_available");
});
