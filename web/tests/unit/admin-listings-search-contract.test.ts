import test from "node:test";
import assert from "node:assert/strict";
import { buildAdminListingsSearchFilter } from "@/lib/admin/admin-listings";

void test("buildAdminListingsSearchFilter includes title and location text in unified search", () => {
  const filter = buildAdminListingsSearchFilter({
    q: "Lekki",
    qMode: "all",
  });

  assert.equal(typeof filter, "string");
  assert.match(filter ?? "", /title\.ilike\./);
  assert.match(filter ?? "", /location_label\.ilike\./);
  assert.match(filter ?? "", /city\.ilike\./);
  assert.doesNotMatch(filter ?? "", /id\.eq\./);
});

void test("buildAdminListingsSearchFilter adds listing and owner id exact matches for uuid search", () => {
  const uuid = "dad2bb26-fe36-4096-b81a-f86d230f9b3d";
  const filter = buildAdminListingsSearchFilter({
    q: uuid,
    qMode: "all",
  });

  assert.match(filter ?? "", new RegExp(`id\\.eq\\.${uuid}`));
  assert.match(filter ?? "", new RegExp(`owner_id\\.eq\\.${uuid}`));
});

void test("buildAdminListingsSearchFilter uses owner search ids for owner-name search", () => {
  const filter = buildAdminListingsSearchFilter({
    q: "Ada",
    qMode: "all",
    ownerSearchIds: ["owner-1", "owner-2"],
  });

  assert.match(filter ?? "", /owner_id\.in\.\(owner-1,owner-2\)/);
});

void test("buildAdminListingsSearchFilter returns no-owner-match sentinel for owner mode with no safe match", () => {
  const filter = buildAdminListingsSearchFilter({
    q: "No match",
    qMode: "owner",
    ownerSearchIds: [],
  });

  assert.equal(filter, "__no_owner_match__");
});
