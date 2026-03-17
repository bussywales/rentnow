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
    adminLinks.find((link) => link.href === "/admin/analytics"),
    "admin should see Analytics link"
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
    userLinks.find((link) => link.href === "/host/listings"),
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
    !userLinks.find((link) => link.href === "/admin/analytics"),
    "non-admin should not see Analytics link"
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
    tenantLinks.find((link) => link.href === "/requests/new"),
    "tenant should see Make a Request link"
  );
  assert.ok(
    tenantLinks.find((link) => link.href === "/requests/my"),
    "tenant should see My Requests link"
  );
  assert.ok(
    tenantLinks.find((link) => link.href === "/tenant/saved"),
    "tenant should see Saved link"
  );
  assert.equal(
    buildMobileNavLinks(MAIN_NAV_LINKS, { isAuthed: true, role: "landlord" }).some(
      (link) => link.href === "/requests/new" || link.href === "/requests/my"
    ),
    false,
    "non-tenant roles should not inherit tenant request menu links"
  );
});

void test("mobile drawer groups include Help & Support, Company, and Legal sections", () => {
  const groups = buildMobileNavLinkGroups(MAIN_NAV_LINKS, { isAuthed: true, role: "tenant" });
  const titles = groups.map((group) => group.title);

  assert.ok(titles.includes("Main"));
  assert.ok(titles.includes("Help & Support"));
  assert.ok(titles.includes("Company"));
  assert.ok(titles.includes("Legal"));

  const mainGroup = groups.find((group) => group.title === "Main");
  assert.ok(mainGroup?.links.find((link) => link.href === "/agents"));
  assert.equal(
    mainGroup?.links.find((link) => link.href === "/agents")?.label,
    "Agents"
  );
  assert.ok(mainGroup?.links.find((link) => link.href === "/requests/new"));
  assert.ok(mainGroup?.links.find((link) => link.href === "/requests/my"));

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

void test("tenant-only agents link is excluded from non-tenant main groups", () => {
  const landlordGroups = buildMobileNavLinkGroups(MAIN_NAV_LINKS, {
    isAuthed: true,
    role: "landlord",
  });
  const landlordMain = landlordGroups.find((group) => group.title === "Main");
  assert.equal(
    landlordMain?.links.some((link) => link.href === "/agents"),
    false
  );

  const adminGroups = buildMobileNavLinkGroups(MAIN_NAV_LINKS, {
    isAuthed: true,
    role: "admin",
  });
  const adminMain = adminGroups.find((group) => group.title === "Main");
  assert.equal(
    adminMain?.links.some((link) => link.href === "/agents"),
    false
  );
});

void test("mobile drawer hides connect group when no socials are configured", () => {
  const groups = buildMobileNavLinkGroups(MAIN_NAV_LINKS, {
    isAuthed: true,
    role: "tenant",
    socialLinks: [],
  });
  assert.equal(
    groups.some((group) => group.title === "Connect with us"),
    false
  );
});

void test("mobile drawer shows connect group when socials are configured", () => {
  const groups = buildMobileNavLinkGroups(MAIN_NAV_LINKS, {
    isAuthed: true,
    role: "tenant",
    socialLinks: [
      {
        platform: "instagram",
        label: "Instagram",
        href: "https://instagram.com/propatyhub",
      },
      {
        platform: "whatsapp",
        label: "WhatsApp",
        href: "https://wa.me/2348000000000",
      },
    ],
  });
  const connectGroup = groups.find((group) => group.title === "Connect with us");
  assert.ok(connectGroup, "expected connect group");
  assert.ok(connectGroup.links.find((link) => link.href === "https://instagram.com/propatyhub"));
  assert.ok(connectGroup.links.find((link) => link.href === "https://wa.me/2348000000000"));
  assert.equal(connectGroup.links[0]?.platform, "instagram");
  assert.equal(connectGroup.links[1]?.platform, "whatsapp");
  assert.equal(connectGroup.links.every((link) => link.external), true);
  assert.deepEqual(
    connectGroup.links.map((link) => link.label),
    ["Instagram", "WhatsApp"]
  );
});
