import test from "node:test";
import assert from "node:assert/strict";
import {
  chooseUniqueSlug,
  ensureUniqueSlug,
  getOrCreatePublicSlug,
  slugifyName,
  type SlugLookupClient,
} from "@/lib/advertisers/slug";

void test("slugifyName normalizes punctuation and spacing", () => {
  assert.equal(slugifyName("Xthetic Studio Limited"), "xthetic-studio-limited");
  assert.equal(slugifyName("  D'Adewale Homes  "), "dadewale-homes");
});

void test("chooseUniqueSlug appends numeric suffix when base is used", () => {
  const slug = chooseUniqueSlug("xthetic-studio", [
    "xthetic-studio",
    "xthetic-studio-2",
  ]);
  assert.equal(slug, "xthetic-studio-3");
});

void test("ensureUniqueSlug excludes current profile id", async () => {
  const lookupClient: SlugLookupClient = {
    from() {
      return {
        select() {
          return {
            async ilike() {
              return {
                data: [
                  { id: "me", public_slug: "xthetic-studio" },
                  { id: "other", public_slug: "xthetic-studio-2" },
                ],
                error: null,
              };
            },
          };
        },
      };
    },
  };

  const slug = await ensureUniqueSlug({
    base: "xthetic-studio",
    supabase: lookupClient,
    excludeProfileId: "me",
  });
  assert.equal(slug, "xthetic-studio");
});

void test("getOrCreatePublicSlug does not create slugs for tenants", async () => {
  const slug = await getOrCreatePublicSlug({
    profile: {
      id: "tenant-1",
      role: "tenant",
      display_name: "Tenant User",
    },
    lookupClient: {
      from() {
        throw new Error("should not lookup for tenant");
      },
    } as unknown as SlugLookupClient,
    canPersist: true,
  });
  assert.equal(slug, null);
});
