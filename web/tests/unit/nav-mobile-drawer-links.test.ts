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
    tenantLinks.find((link) => link.href === "/tenant/billing"),
    "tenant should see tenant billing link"
  );
  assert.equal(
    tenantLinks.some((link) => link.href === "/dashboard/billing"),
    false,
    "tenant should not see host billing route"
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
  assert.ok(
    userLinks.find((link) => link.href === "/dashboard/billing"),
    "landlord should see dashboard billing link"
  );
  assert.equal(
    userLinks.some((link) => link.href === "/tenant/billing"),
    false,
    "landlord should not see tenant billing route"
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
  assert.ok(mainGroup?.links.find((link) => link.href === "/tenant/billing"));
  assert.ok(mainGroup?.links.find((link) => link.href === "/requests/new"));
  assert.ok(mainGroup?.links.find((link) => link.href === "/requests/my"));

  const helpGroup = groups.find((group) => group.title === "Help & Support");
  assert.ok(helpGroup?.links.find((link) => link.href === "/help/tenant"));
  assert.ok(helpGroup?.links.find((link) => link.href === "/support"));
  assert.deepEqual(
    helpGroup?.links.find((link) => link.href === "https://www.youtube.com/@PropatyHub"),
    {
      href: "https://www.youtube.com/@PropatyHub",
      label: "Watch Video Tutorials",
      external: true,
      testId: "mobile-drawer-video-tutorials",
    }
  );

  const companyGroup = groups.find((group) => group.title === "Company");
  assert.ok(companyGroup?.links.find((link) => link.href === "/about"));
  assert.ok(companyGroup?.links.find((link) => link.href === "/help/referrals"));

  const legalGroup = groups.find((group) => group.title === "Legal");
  assert.ok(legalGroup?.links.find((link) => link.href === "/legal"));
  assert.ok(legalGroup?.links.find((link) => link.href === "/legal/disclaimer"));
});

void test("mobile drawer includes video tutorials for logged-out users and every role group", () => {
  const expectedHref = "https://www.youtube.com/@PropatyHub";
  const scenarios = [
    { isAuthed: false, role: null as const, label: "logged out" },
    { isAuthed: true, role: "tenant" as const, label: "tenant" },
    { isAuthed: true, role: "landlord" as const, label: "landlord" },
    { isAuthed: true, role: "agent" as const, label: "agent" },
    { isAuthed: true, role: "admin" as const, label: "admin" },
  ];

  for (const scenario of scenarios) {
    const groups = buildMobileNavLinkGroups(MAIN_NAV_LINKS, {
      isAuthed: scenario.isAuthed,
      role: scenario.role,
    });
    const helpGroup = groups.find((group) => group.title === "Help & Support");
    const tutorialsLink = helpGroup?.links.find((link) => link.href === expectedHref);

    assert.ok(tutorialsLink, `expected video tutorials link for ${scenario.label}`);
    assert.equal(tutorialsLink?.label, "Watch Video Tutorials");
    assert.equal(tutorialsLink?.external, true);
    assert.equal(tutorialsLink?.testId, "mobile-drawer-video-tutorials");
  }
});

void test("admin mobile drawer retains admin support and legal access via grouped sections", () => {
  const groups = buildMobileNavLinkGroups(MAIN_NAV_LINKS, { isAuthed: true, role: "admin" });
  const mainGroup = groups.find((group) => group.title === "Main");
  const helpGroup = groups.find((group) => group.title === "Help & Support");
  const legalGroup = groups.find((group) => group.title === "Legal");

  assert.ok(mainGroup?.links.find((link) => link.href === "/admin"));
  assert.equal(mainGroup?.links.some((link) => link.href === "/admin/help/tutorials"), false);
  assert.ok(helpGroup?.links.find((link) => link.href === "/admin/help/tutorials"));
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
  assert.ok(landlordMain?.links.find((link) => link.href === "/dashboard/billing"));
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
    adminMain?.links.some((link) => link.href === "/tenant/billing" || link.href === "/dashboard/billing"),
    false
  );
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
