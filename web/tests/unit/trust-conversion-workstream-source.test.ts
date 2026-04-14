import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

void test("trust workstream wires public review summaries into the key public surfaces", () => {
  const propertyPage = read("app/properties/[id]/page.tsx");
  const advertiserPage = read("components/advertisers/PublicAdvertiserProfilePage.tsx");
  const agentStorefrontPage = read("app/agents/[slug]/page.tsx");
  const tripPage = read("app/trips/[id]/page.tsx");
  const tripsPanel = read("components/tenant/TenantTripsPanel.tsx");
  const hostBookingsPanel = read("components/host/HostShortletBookingsPanel.tsx");
  const hostBookingsPage = read("app/host/bookings/page.tsx");
  const adminReviewsPage = read("app/admin/reviews/page.tsx");

  assert.ok(
    propertyPage.includes("PublicHostReviewSummary"),
    "expected property detail page to render the public host review summary"
  );
  assert.ok(
    advertiserPage.includes("PublicHostReviewSummary"),
    "expected advertiser profile page to render the public host review summary"
  );
  assert.ok(
    agentStorefrontPage.includes("PublicHostReviewSummary"),
    "expected agent storefront page to render the public host review summary"
  );
  assert.ok(
    tripPage.includes("TripReviewCard"),
    "expected completed trip page to render the completed-stay review card"
  );
  assert.ok(
    tripsPanel.includes('row.status === "completed"'),
    "expected completed trips to keep a route back to the review surface"
  );
  assert.ok(
    hostBookingsPanel.includes("Completed-stay review"),
    "expected host booking drawer to expose the completed-stay review panel"
  );
  assert.ok(
    hostBookingsPage.includes("host-bookings-review-summary"),
    "expected host bookings page to surface compact review summary cards"
  );
  assert.ok(
    adminReviewsPage.includes("Stay reviews"),
    "expected admin reviews page to expose the lightweight review visibility surface"
  );
});

void test("conversion workstream adds new property event types and progression capture to existing routes", () => {
  const propertyEvents = read("lib/analytics/property-events.ts");
  const leadsRoute = read("app/api/leads/route.ts");
  const messagesRoute = read("app/api/messages/route.ts");
  const threadRoute = read("app/api/messages/thread/[id]/route.ts");
  const viewingRequestRoute = read("app/api/viewings/request/route.ts");
  const viewingRespondRoute = read("app/api/viewings/respond/route.ts");
  const leadInboxClient = read("components/leads/LeadInboxClient.tsx");

  assert.ok(propertyEvents.includes('"enquiry_replied"'), "expected enquiry_replied property event");
  assert.ok(propertyEvents.includes('"viewing_confirmed"'), "expected viewing_confirmed property event");
  assert.ok(
    propertyEvents.includes('"contact_exchange_attempted"'),
    "expected contact_exchange_attempted property event"
  );

  assert.ok(
    leadsRoute.includes("off_platform_handoff_at"),
    "expected lead API selections to include off-platform handoff timestamps"
  );
  assert.ok(
    leadsRoute.includes('eventType: "contact_exchange_attempted"'),
    "expected lead route to log contact exchange attempts"
  );
  assert.ok(
    messagesRoute.includes('event: "enquiry_replied"'),
    "expected message send route to touch enquiry reply progression"
  );
  assert.ok(
    threadRoute.includes('event: "enquiry_replied"'),
    "expected message thread reply route to touch enquiry reply progression"
  );
  assert.ok(
    viewingRequestRoute.includes('event: "viewing_requested"'),
    "expected viewing request route to touch viewing requested progression"
  );
  assert.ok(
    viewingRespondRoute.includes('event: "viewing_confirmed"'),
    "expected viewing response route to touch viewing confirmed progression"
  );
  assert.ok(
    leadInboxClient.includes("Contact exchange attempted"),
    "expected lead inbox UI to expose off-platform handoff visibility"
  );
  assert.ok(
    leadInboxClient.includes("lead-progression-summary"),
    "expected lead inbox to surface top-level progression summary consumption"
  );
  assert.ok(
    leadInboxClient.includes("Viewing confirmed"),
    "expected lead inbox to surface viewing confirmation progress clearly"
  );
});
