import test from "node:test";
import assert from "node:assert/strict";
import { MAIN_NAV_LINKS } from "@/components/layout/MainNav";
import { buildMobileNavLinks } from "@/components/layout/NavMobileDrawerClient";

void test("mobile drawer links are role-aware", () => {
  const adminLinks = buildMobileNavLinks(MAIN_NAV_LINKS, { isAuthed: true, role: "admin" });
  assert.ok(adminLinks.find((link) => link.href === "/admin"), "admin should see Admin link");
  assert.ok(
    adminLinks.find((link) => link.href === "/admin/insights"),
    "admin should see Insights link"
  );
  assert.ok(!adminLinks.find((link) => link.href === "/dashboard"), "admin should not see Dashboard link");
  assert.ok(adminLinks.find((link) => link.href === "/dashboard/messages"), "admin should see Messages link");

  const userLinks = buildMobileNavLinks(MAIN_NAV_LINKS, { isAuthed: true, role: "landlord" });
  assert.ok(userLinks.find((link) => link.href === "/home"), "non-admin should see Home link");
  assert.ok(userLinks.find((link) => link.href === "/dashboard"), "non-admin should see Dashboard link");
  assert.ok(!userLinks.find((link) => link.href === "/admin"), "non-admin should not see Admin link");
  assert.ok(
    !userLinks.find((link) => link.href === "/admin/insights"),
    "non-admin should not see Insights link"
  );
  assert.ok(userLinks.find((link) => link.href === "/dashboard/messages"), "non-admin should see Messages link");
});
