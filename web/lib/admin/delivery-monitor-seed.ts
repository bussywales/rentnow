export type DeliveryMonitorStatus = "green" | "amber" | "red";
export type DeliveryMonitorTestingStatus = "not_started" | "in_progress" | "passed" | "failed";

export type DeliveryMonitorSeedItem = {
  key: string;
  title: string;
  workstream: string;
  status: DeliveryMonitorStatus;
  owner: string;
  nextAction: string;
  description: string;
  whyItMatters: string;
  delivered: string[];
  outstanding: string[];
  testingGuide: string[];
  repoUpdatedAt: string;
};

export const DELIVERY_MONITOR_SEED_ITEMS: DeliveryMonitorSeedItem[] = [
  {
    key: "listing_publish_renew_recovery",
    title: "Listing publish / renew / recovery path",
    workstream: "Listings monetisation and entitlement enforcement",
    status: "amber",
    owner: "Revenue + billing",
    nextAction: "Run live provider callback and recovery smoke against real billing lanes.",
    description:
      "Protect the host revenue path so legitimate publish and renew actions recover cleanly instead of falling into dead-end access states.",
    whyItMatters:
      "This is revenue-critical and trust-critical. If billing recovery is wrong, hosts cannot publish or renew when they should be able to.",
    delivered: [
      "Publish and renew routes return structured recovery contracts for payment-required, billing-required, and listing-limit states.",
      "Canonical host management routes replaced the legacy listing-management surfaces.",
      "Subscription lifecycle timing logic is time-safe in repo truth.",
    ],
    outstanding: [
      "Real payment-provider callback and recovery verification is still required before full closure.",
      "Continue watching for entitlement drift on live renew and publish paths.",
    ],
    testingGuide: [
      "Test successful renew with valid entitlement and confirm no /forbidden path appears.",
      "Test payment-required recovery and confirm the return destination resumes the host flow.",
      "Test billing-required recovery and confirm the host lands on the right billing surface.",
      "Confirm listing-limit recovery still behaves correctly for capped accounts.",
    ],
    repoUpdatedAt: "2026-05-02T00:00:00.000Z",
  },
  {
    key: "listing_media_playback_gallery_sync",
    title: "Listing media playback and gallery sync",
    workstream: "Listings media / featured listings",
    status: "amber",
    owner: "Listings media",
    nextAction:
      "Fix remaining gallery selected-index synchronisation and rerun production retest on featured listing 48161350-b69c-4b39-b7a6-3af29e4e6a44.",
    description:
      "Video visibility is fixed, but property-detail gallery thumbnail sync still fails in production on some listings.",
    whyItMatters:
      "Media trust breaks when the highlighted thumbnail does not match the visible image, especially on featured listings where the gallery is part of the sales surface.",
    delivered: [
      "Video visibility signal is fixed and production-proven.",
      "Public listing detail can expose has_video safely.",
      "Video tour renders on detail pages where video exists.",
    ],
    outstanding: [
      "Active thumbnail must match visible main gallery image.",
      "Featured listing detail gallery must remain in sync on first render.",
      "Thumbnail click, next, and previous navigation must stay in sync.",
    ],
    testingGuide: [
      "Open https://www.propatyhub.com/properties/48161350-b69c-4b39-b7a6-3af29e4e6a44?source=featured.",
      "Confirm first render active thumbnail matches the visible main image.",
      "Click thumbnail 2 and thumbnail 3 and confirm the visible image, active border, and badge all agree.",
      "Use next and previous navigation and confirm visible image, active thumbnail, and badge move together.",
      "Confirm video tour still appears on the page.",
      "Spot-check an image-only listing and confirm normal gallery behaviour still holds.",
    ],
    repoUpdatedAt: "2026-05-04T00:00:00.000Z",
  },
  {
    key: "market_pricing_control_plane",
    title: "Market pricing control plane",
    workstream: "Billing / market pricing / entitlements",
    status: "amber",
    owner: "Billing policy + admin ops",
    nextAction: "Validate the guarded Canada runtime adapter and disabled gate in submit/checkout paths before shipping any live Stripe checkout integration.",
    description:
      "Create the first admin-managed market pricing and entitlement control plane without changing current checkout or enforcement behavior.",
    whyItMatters:
      "Canada PAYG and stakeholder-managed market pricing need a governed control plane before runtime billing can safely become market-aware.",
    delivered: [
      "Schema foundation exists for market policy, one-off pricing, and listing entitlements.",
      "Admin can see and edit seeded market policy rows, entitlement rows, and one-off price rows.",
      "One-off price rows now support role/tier-aware control-plane pricing for Canada PAYG policy planning.",
      "A guarded Canada rental PAYG readiness resolver can now evaluate CA role/tier pricing rows without touching live checkout or listing enforcement.",
      "A disabled-by-default Canada runtime gate and adapter can now evaluate CA PAYG readiness inside submit/checkout contexts without enabling live payments.",
      "Every successful edit writes market pricing audit history.",
      "Runtime source diagnostics make it explicit that current billing still uses legacy settings and code constants.",
    ],
    outstanding: [
      "Runtime checkout and entitlement enforcement still need the explicit live integration batch that consumes the guarded Canada decision path.",
      "Canada PAYG checkout remains intentionally disabled until live Stripe integration ships on top of the guarded runtime wiring.",
      "Canada PAYG remains policy-gated until pricing, provider routing, tax posture, and launch scope are approved.",
      "Enterprise remains a planning-only control-plane tier until separate runtime support exists.",
      "Provider routing and tax/compliance posture still need stakeholder sign-off before live market activation.",
    ],
    testingGuide: [
      "Open /admin/settings/billing/market-pricing and confirm policy, one-off pricing, and entitlement rows render.",
      "Confirm one-off price rows show role and tier columns, including Canada planning rows.",
      "Run the Canada PAYG readiness resolver tests and confirm CA landlord free and agent pro scenarios resolve seeded CAD pricing while checkout stays disabled.",
      "Confirm the Canada runtime diagnostics show gate OFF, resolver available YES, checkout enabled NO, and runtime source legacy.",
      "Edit one policy row, one one-off price row, and one entitlement row, then confirm each change appears in the table and recent audit entries.",
      "Confirm the guarded Canada runtime adapter tests cover gate-off checkout blocking and submit non-regression.",
      "Confirm the runtime diagnostics explicitly say legacy checkout and listing-cap enforcement are still in effect.",
      "Confirm Canada remains draft or disabled and does not imply live PAYG availability.",
      "Confirm Enterprise rows are labeled planning-only rather than runtime-ready.",
      "Verify no current billing or listing-monetisation smoke flow changes behavior after this foundation ships.",
    ],
    repoUpdatedAt: "2026-05-04T00:00:00.000Z",
  },
  {
    key: "property_request_title_integrity",
    title: "Property request title / rendering / data integrity",
    workstream: "Property requests marketplace",
    status: "green",
    owner: "Marketplace demand",
    nextAction: "Monitor legacy untitled records only; no new build work is required right now.",
    description:
      "Keep property requests structurally truthful by using a real title field and preventing structured location fields from being abused as pseudo-headlines.",
    whyItMatters:
      "Unreadable or misleading request headings corrupt search, notifications, and admin moderation.",
    delivered: [
      "Property requests have a real title/headline field in active flows.",
      "List, detail, admin, and alert surfaces use request title before any structured-location fallback.",
      "Legacy fallback stays non-destructive for older untitled rows.",
    ],
    outstanding: [
      "Only legacy untitled records remain on fallback rendering by design.",
    ],
    testingGuide: [
      "Create and edit a request with a custom title and confirm the title renders on list, detail, and admin surfaces.",
      "Verify city and area remain clean structured location fields.",
      "Spot-check legacy rows and confirm fallback remains readable rather than destructive.",
    ],
    repoUpdatedAt: "2026-05-02T00:00:00.000Z",
  },
  {
    key: "property_request_taxonomy_non_room_logic",
    title: "Property request taxonomy / land / non-room logic",
    workstream: "Property requests marketplace",
    status: "green",
    owner: "Marketplace demand",
    nextAction: "Watch real usage before widening taxonomy further.",
    description:
      "Keep request creation and matching type-aware so land and other non-room requests do not inherit residential bedroom/bathroom assumptions.",
    whyItMatters:
      "Demand capture breaks if non-room requests are forced through residential-only modelling.",
    delivered: [
      "Land, office, and shop request types are supported in repo truth.",
      "Bedroom and bathroom logic is suppressed for non-room request types.",
      "Browse, detail, admin, and alert matching flows respect the type-aware rules.",
    ],
    outstanding: [
      "No immediate repo-truth gap remains for the current taxonomy scope.",
    ],
    testingGuide: [
      "Create land and office requests and confirm room counts are not forced.",
      "Create residential requests and confirm bedroom logic still works.",
      "Check responder/discovery surfaces for readable type labels.",
    ],
    repoUpdatedAt: "2026-05-02T00:00:00.000Z",
  },
  {
    key: "property_request_submission_trust",
    title: "Property request submission trust / duplicate protection",
    workstream: "Property requests marketplace",
    status: "green",
    owner: "Marketplace demand",
    nextAction: "Keep regression coverage in place; no further workflow expansion is needed in this lane.",
    description:
      "Make property request submission feel trustworthy by preventing duplicate taps, confirming success clearly, and preserving entered state on failure.",
    whyItMatters:
      "Weak submission feedback creates duplicate demand and erodes user trust.",
    delivered: [
      "Client-side in-flight submission guard is present.",
      "Success states are explicit rather than silent.",
      "Failure preserves form input instead of clearing user work.",
    ],
    outstanding: [
      "No repo-truth defect remains for the current submission hardening scope.",
    ],
    testingGuide: [
      "Submit a valid request and confirm clear success feedback.",
      "Attempt repeated taps while submitting and confirm duplicate create is blocked.",
      "Force a failure and confirm form state is preserved.",
    ],
    repoUpdatedAt: "2026-05-02T00:00:00.000Z",
  },
  {
    key: "property_request_subscriber_alerts",
    title: "Property request subscriber alerts / lead activation",
    workstream: "Property request subscriber alerts",
    status: "amber",
    owner: "Marketplace supply activation",
    nextAction: "Observe real send volume, adoption, and lead quality before widening the feature.",
    description:
      "Turn property requests into a living opt-in lead surface for matching supply-side users without leaking private requester data.",
    whyItMatters:
      "Structurally correct requests still fail commercially if no relevant supply-side users are activated.",
    delivered: [
      "Criteria-based alert subscriptions exist with create/list/delete flows.",
      "Eligibility is limited to supported supply-side roles.",
      "Duplicate delivery suppression and privacy-safe content are in place.",
      "Admin usage readout is present on the property request admin surface.",
    ],
    outstanding: [
      "Live adoption and real delivery proof are still needed before calling this fully closed.",
      "Matching quality should be tuned using real usage rather than guesswork.",
    ],
    testingGuide: [
      "Create a subscription and confirm it appears in the subscriber list.",
      "Publish a matching request and confirm a single safe alert is emitted.",
      "Confirm non-matching and duplicate publish cases do not resend incorrectly.",
      "Verify no requester phone or email appears in alert content.",
    ],
    repoUpdatedAt: "2026-05-02T00:00:00.000Z",
  },
  {
    key: "role_account_state_hardening",
    title: "Role / account-state hardening",
    workstream: "Trust / verification / profile state",
    status: "green",
    owner: "Trust + auth",
    nextAction: "Keep this in regression coverage and operator playbooks; do not widen into role switching.",
    description:
      "Prevent unsupported agent and tenant role ambiguity so users are not offered self-service transitions the product does not support.",
    whyItMatters:
      "Ambiguous role handling is a trust problem and can lead to wrong-surface routing or unsafe permission assumptions.",
    delivered: [
      "Onboarding role picker is restricted to valid first-time contexts.",
      "Cross-role onboarding branches are gated.",
      "Self-service role mutation is blocked at the persistence layer.",
    ],
    outstanding: [
      "No current repo-truth gap remains for the stated no-transition policy.",
    ],
    testingGuide: [
      "Login as an existing agent and confirm no tenant-switch prompt appears.",
      "Confirm unsupported cross-role onboarding pages reject access.",
      "Verify admin/operator flows still work after the hardening.",
    ],
    repoUpdatedAt: "2026-05-02T00:00:00.000Z",
  },
  {
    key: "property_prep_model_b_foundation",
    title: "Property Prep / Move & Ready Model B foundation",
    workstream: "Property Prep / Move & Ready curated supplier routing",
    status: "green",
    owner: "Services ops",
    nextAction: "Keep the pilot narrow; only build on top of the curated routing model.",
    description:
      "Maintain the curated supplier network foundation so supplier intake, approval, privacy, and route-readiness work as a coherent controlled model.",
    whyItMatters:
      "Without a governed supplier model, Property Prep risks turning into open-chaos lead leakage instead of a controlled operations lane.",
    delivered: [
      "Supplier application intake exists.",
      "Approve / reject / suspend lifecycle exists.",
      "Route-readiness and privacy-safe supplier lead summaries exist.",
      "Admin provider and request ops surfaces are in place.",
    ],
    outstanding: [
      "Broader quote-routing, award economics, and supplier reveal policy remain intentionally out of scope.",
    ],
    testingGuide: [
      "Submit a supplier application and confirm it lands in admin review.",
      "Approve and suspend providers and confirm coverage status updates.",
      "Verify supplier-facing lead summaries do not expose requester contact details.",
    ],
    repoUpdatedAt: "2026-05-02T00:00:00.000Z",
  },
  {
    key: "property_prep_dispatch_follow_through",
    title: "Property Prep routed dispatch / operator follow-through",
    workstream: "Property Prep / Move & Ready curated supplier routing",
    status: "green",
    owner: "Services ops",
    nextAction: "Use real pilot traffic to tune operator cadence before considering broader service-marketplace features.",
    description:
      "Move route-ready prep requests into explicit dispatch, supplier response, and operator outcome handling so requests no longer stall after intake.",
    whyItMatters:
      "This is the workflow layer that turns captured prep demand into something operationally moving instead of dead admin furniture.",
    delivered: [
      "Explicit dispatch progress states exist.",
      "Providers can respond in a narrow PropatyHub-controlled flow.",
      "Operators can award or close no-match from admin request detail.",
      "Host/requester privacy remains intact and PropatyHub stays the intermediary.",
    ],
    outstanding: [
      "Live operator cadence and volume tuning still matter, but the current Model B scope is now structurally complete.",
    ],
    testingGuide: [
      "Dispatch a route-ready request and confirm providers appear in the request workflow.",
      "Submit provider responses for interested, declined, and need-more-information cases.",
      "Award a provider and close a no-match request from admin detail.",
    ],
    repoUpdatedAt: "2026-05-02T00:00:00.000Z",
  },
  {
    key: "canada_market_segmentation",
    title: "Canada market segmentation policy + implementation",
    workstream: "Canada market segmentation policy + implementation",
    status: "red",
    owner: "Markets + billing policy",
    nextAction:
      "Define the Canada policy decision pack before coding; see docs/product/canada-market-segmentation-policy.md.",
    description:
      "Canada remains policy-gated. Shared multi-market plumbing exists, but pricing, tax, provider-routing, entitlement, moderation, and launch-scope decisions are not defined yet.",
    whyItMatters:
      "International market support is easy to overclaim. Canada must not be treated as rollout-ready until stakeholders define the commercial, tax, and compliance policy.",
    delivered: [
      "Shared multi-market plumbing already includes CA and CAD support.",
      "Discovery and location handling already recognize Canada as a market.",
      "Partial subscription-pricing infrastructure and tests already anticipate Canada scenarios.",
    ],
    outstanding: [
      "Stakeholders still need to define Canada pricing in CAD across subscriptions, PAYG listings, and featured lanes.",
      "Stakeholders still need to define tax handling (GST/HST/PST), receipts posture, provider routing, entitlements, moderation, and launch scope.",
      "No implementation should proceed until the Canada policy document is resolved.",
    ],
    testingGuide: [
      "Treat existing Canada pricing tests as plumbing proof only, not as approval of real CAD pricing.",
      "Verify no admin or delivery copy implies Canada is rollout-ready before the policy decisions are made.",
      "Use the policy document to check that any future coding batch stays within the approved Canada launch scope.",
    ],
    repoUpdatedAt: "2026-05-03T00:00:00.000Z",
  },
  {
    key: "bootcamp_launch_system",
    title: "Bootcamp launch system",
    workstream: "Bootcamp / growth surface",
    status: "amber",
    owner: "Growth + support handoff",
    nextAction: "Use live traffic and support handoff feedback to validate the launch surface before changing scope.",
    description:
      "Keep the bootcamp launch surface truthful, measurable, and support-connected without turning it into a generic growth experiment board.",
    whyItMatters:
      "Growth surfaces are easy to let drift away from real delivery and operational support readiness.",
    delivered: [
      "The /bootcamp launch surface exists with route-specific content and metadata.",
      "CTA truth and support handoff remain wired.",
      "Bootcamp analytics and outcome-learning rails are in place.",
    ],
    outstanding: [
      "Real traffic and conversion learning are still required for full closure.",
    ],
    testingGuide: [
      "Open /bootcamp and confirm hero, CTA, and support paths render correctly.",
      "Verify support prefill or handoff context still reaches the support surface.",
      "Confirm metadata/share basics remain present.",
    ],
    repoUpdatedAt: "2026-05-02T00:00:00.000Z",
  },
  {
    key: "monitoring_sentry_deep_health",
    title: "Monitoring / Sentry / deep health / operator clarity",
    workstream: "Monitoring, Sentry, deep health, schema readiness",
    status: "amber",
    owner: "Platform ops",
    nextAction: "Keep tuning live operator use and alert-noise quality rather than widening the surface area.",
    description:
      "Maintain trustworthy operator diagnostics so health, config readiness, and error visibility stay actionable without exposing internal state publicly.",
    whyItMatters:
      "If operators cannot trust diagnostics, release safety and incident response degrade quickly.",
    delivered: [
      "Public health and admin-only deep diagnostics are separated.",
      "Sentry wiring and config-status surfaces remain in place.",
      "Release-safety and monitoring docs are present.",
    ],
    outstanding: [
      "Real operational tuning and alert-noise control remain live-work concerns.",
    ],
    testingGuide: [
      "Verify /api/health stays minimal and safe.",
      "Verify /api/health/deep and /api/admin/config-status remain meaningful for admins.",
      "Confirm release and smoke docs still point to the current diagnostics surfaces.",
    ],
    repoUpdatedAt: "2026-05-02T00:00:00.000Z",
  },
  {
    key: "repo_operating_docs",
    title: "Repo operating docs",
    workstream: "Release and migration discipline",
    status: "green",
    owner: "Engineering ops",
    nextAction: "Keep the ledger and operating manual updated as workstream truth changes.",
    description:
      "Make the repo itself carry the engineering operating system so delivery truth does not live only in prompts, chat memory, or individual humans.",
    whyItMatters:
      "Execution quality degrades when scope rules, migration discipline, and workstream truth are not durable in repo state.",
    delivered: [
      "Engineering operating manual exists.",
      "Reusable Codex batch template exists.",
      "Workstream status ledger exists and is seeded with repo-truth workstreams.",
    ],
    outstanding: [
      "The docs only stay valuable if future batches update them honestly.",
    ],
    testingGuide: [
      "Confirm docs are present and path-correct.",
      "Verify migration discipline and output format rules remain aligned with actual repo workflow.",
      "Update the ledger whenever a workstream meaningfully changes state.",
    ],
    repoUpdatedAt: "2026-05-02T00:00:00.000Z",
  },
];

export const DELIVERY_MONITOR_ITEM_KEYS = new Set(
  DELIVERY_MONITOR_SEED_ITEMS.map((item) => item.key)
);

export function getDeliveryMonitorSeedItem(key: string) {
  return DELIVERY_MONITOR_SEED_ITEMS.find((item) => item.key === key) ?? null;
}
