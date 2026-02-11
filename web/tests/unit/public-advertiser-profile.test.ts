import test from "node:test";
import assert from "node:assert/strict";
import {
  derivePublicAdvertiserName,
  resolvePublicAdvertiserHref,
  toPublicAdvertiserProfile,
} from "@/lib/advertisers/public-profile";

void test("tenant profiles are not public advertiser profiles", () => {
  const profile = toPublicAdvertiserProfile({
    id: "user-1",
    role: "tenant",
    display_name: "Tenant One",
    phone: "+234",
  });
  assert.equal(profile, null);
});

void test("public advertiser profile contains only safe public fields", () => {
  const profile = toPublicAdvertiserProfile({
    id: "user-2",
    role: "agent",
    display_name: "Agent Prime",
    full_name: "Agent Prime Full",
    phone: "+234000",
    email: "agent@example.com",
    avatar_url: "https://example.com/avatar.jpg",
    city: "Lagos",
    country: "Nigeria",
    created_at: "2026-02-10T00:00:00.000Z",
  } as unknown as Parameters<typeof toPublicAdvertiserProfile>[0]);

  assert.ok(profile, "expected public advertiser profile");
  assert.deepEqual(Object.keys(profile || {}).sort(), [
    "avatarUrl",
    "city",
    "country",
    "createdAt",
    "id",
    "name",
    "publicSlug",
    "role",
  ]);
  assert.equal((profile as { phone?: string }).phone, undefined);
  assert.equal((profile as { email?: string }).email, undefined);
});

void test("display name fallback order is stable", () => {
  assert.equal(
    derivePublicAdvertiserName({
      display_name: "Display",
      business_name: "Business",
      full_name: "Full",
    }),
    "Display"
  );
  assert.equal(
    derivePublicAdvertiserName({
      display_name: "",
      business_name: "Business",
      full_name: "Full",
    }),
    "Business"
  );
  assert.equal(
    derivePublicAdvertiserName({
      display_name: "",
      business_name: "",
      full_name: "Full",
    }),
    "Full"
  );
});

void test("public advertiser href prefers slug then falls back to /u id", () => {
  assert.equal(
    resolvePublicAdvertiserHref({
      advertiserId: "user-1",
      publicSlug: "xthetic-studio-limited",
    }),
    "/agents/xthetic-studio-limited"
  );
  assert.equal(
    resolvePublicAdvertiserHref({
      advertiserId: "user-2",
      publicSlug: null,
    }),
    "/u/user-2"
  );
});
