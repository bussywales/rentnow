import test from "node:test";
import assert from "node:assert/strict";
import { MAIN_NAV_LINKS } from "@/components/layout/MainNav";
import {
  buildMobileNavLinkGroups,
  buildMobileNavLinks,
} from "@/components/layout/NavMobileDrawerClient";

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
  assert.ok(
    userLinks.find((link) => link.href === "/dashboard/analytics"),
    "non-admin should see Dashboard link"
  );
  assert.ok(
    userLinks.find((link) => link.href === "/saved-searches"),
    "non-admin should see Saved searches link"
  );
  assert.ok(
    userLinks.find((link) => link.href === "/host/earnings"),
    "non-admin host role should see Earnings link"
  );
  assert.ok(
    userLinks.find((link) => link.href === "/host/calendar"),
    "non-admin host role should see Calendar link"
  );
  assert.ok(
    userLinks.find((link) => link.href === "/host/properties"),
    "non-admin host role should see Listings link"
  );
  assert.ok(
    !userLinks.find((link) => link.href === "/dashboard/leads"),
    "mobile drawer should not include legacy dashboard leads href"
  );
  assert.ok(
    userLinks.find((link) => link.href === "/help/landlord"),
    "landlord should see landlord help link"
  );
  assert.ok(!userLinks.find((link) => link.href === "/admin"), "non-admin should not see Admin link");
  assert.ok(
    !userLinks.find((link) => link.href === "/admin/insights"),
    "non-admin should not see Insights link"
  );
  assert.ok(userLinks.find((link) => link.href === "/dashboard/messages"), "non-admin should see Messages link");

  const tenantLinks = buildMobileNavLinks(MAIN_NAV_LINKS, { isAuthed: true, role: "tenant" });
  assert.ok(
    tenantLinks.find((link) => link.href === "/help/tenant"),
    "tenant should see tenant help link"
  );
  assert.ok(
    tenantLinks.find((link) => link.href === "/trips"),
    "tenant should see Trips link"
  );
  assert.ok(
    tenantLinks.find((link) => link.href === "/tenant/saved"),
    "tenant should see Saved link"
  );
});

void test("mobile drawer groups include Help & Support, Company, and Legal sections", () => {
  const groups = buildMobileNavLinkGroups(MAIN_NAV_LINKS, { isAuthed: true, role: "tenant" });
  const titles = groups.map((group) => group.title);

  assert.ok(titles.includes("Main"));
  assert.ok(titles.includes("Help & Support"));
  assert.ok(titles.includes("Company"));
  assert.ok(titles.includes("Legal"));

  const helpGroup = groups.find((group) => group.title === "Help & Support");
  assert.ok(helpGroup?.links.find((link) => link.href === "/help/tenant"));
  assert.ok(helpGroup?.links.find((link) => link.href === "/support"));

  const companyGroup = groups.find((group) => group.title === "Company");
  assert.ok(companyGroup?.links.find((link) => link.href === "/about"));
  assert.ok(companyGroup?.links.find((link) => link.href === "/help/referrals"));

  const legalGroup = groups.find((group) => group.title === "Legal");
  assert.ok(legalGroup?.links.find((link) => link.href === "/legal"));
  assert.ok(legalGroup?.links.find((link) => link.href === "/legal/disclaimer"));
});

void test("admin mobile drawer retains admin support and legal access via grouped sections", () => {
  const groups = buildMobileNavLinkGroups(MAIN_NAV_LINKS, { isAuthed: true, role: "admin" });
  const mainGroup = groups.find((group) => group.title === "Main");
  const helpGroup = groups.find((group) => group.title === "Help & Support");
  const legalGroup = groups.find((group) => group.title === "Legal");

  assert.ok(mainGroup?.links.find((link) => link.href === "/admin"));
  assert.ok(helpGroup?.links.find((link) => link.href === "/admin/support"));
  assert.ok(legalGroup?.links.find((link) => link.href === "/admin/legal"));
  assert.ok(legalGroup?.links.find((link) => link.href === "/legal/disclaimer"));
});
