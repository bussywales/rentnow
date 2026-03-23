import test from "node:test";
import assert from "node:assert/strict";
import { resolveAdminOwnerIdentityDisplay } from "@/lib/admin/admin-owner-identity";

test("owner identity prefers full name and keeps email secondary", () => {
  const result = resolveAdminOwnerIdentityDisplay({
    ownerName: "Ada Host",
    ownerEmail: "ada@example.com",
    ownerId: "owner-1",
    hostName: "Host",
  });

  assert.equal(result.primaryKind, "name");
  assert.equal(result.primaryLabel, "Ada Host");
  assert.equal(result.secondaryLabel, "ada@example.com");
});

test("owner identity falls back to email when profile name is absent", () => {
  const result = resolveAdminOwnerIdentityDisplay({
    ownerName: " ",
    ownerEmail: "owner@example.com",
    ownerId: "owner-1",
    hostName: "Host",
  });

  assert.equal(result.primaryKind, "email");
  assert.equal(result.primaryLabel, "owner@example.com");
  assert.equal(result.secondaryLabel, null);
});

test("owner identity falls back to owner uuid before generic host label", () => {
  const result = resolveAdminOwnerIdentityDisplay({
    ownerName: null,
    ownerEmail: null,
    ownerId: "3b228727-f80a-4abc-b4d3-4de9916b1c34",
    hostName: "Host",
  });

  assert.equal(result.primaryKind, "ownerId");
  assert.equal(result.primaryLabel, "3b228727-f80a-4abc-b4d3-4de9916b1c34");
});
