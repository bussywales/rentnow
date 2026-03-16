# Property Requests MVP

Last updated: 2026-03-16
Owner: Product + Engineering
Status: Ready for implementation planning

## Purpose

Define a practical MVP for a new demand-side marketplace surface where seekers post structured property requirements and hosts/agents respond through the platform with matching listings.

This document is the build contract for a later implementation batch. It is intentionally scoped to an MVP that can launch safely without creating a second unmoderated marketplace or a full chat/forum product.

## Step-0 Audit Summary

### Existing pieces that can be reused

- Role and permission model already supports the core actors needed here: `tenant`, `landlord`, `agent`, `admin`.
- Existing authz helpers already enforce signed-in access, role gating, and owner/delegation checks.
- Listing ownership and agent-delegation patterns already exist and can be reused to decide which listings an agent/host is allowed to send in response.
- Admin review and queue patterns already exist for listings and can be adapted for request moderation and request operations.
- Property sharing and messaging flows already provide examples of platform-mediated, permission-aware response patterns without exposing direct off-platform contact by default.
- Existing analytics/event infrastructure already supports low-volume product telemetry and internal reporting.
- Existing product docs, help, roadmap, and update-note patterns provide the right durable documentation structure.

### Missing pieces that must be built from scratch

- A separate `property_requests` domain model distinct from listings.
- Request creation, editing, publishing, and lifecycle management surfaces for seekers.
- A supply-side browse/filter surface where landlords and agents can discover open requests.
- A structured request-response model linking a request to one or more host-managed listings.
- A seeker-facing inbox/history view for request responses.
- Admin controls specific to request visibility, expiry, moderation, and response eligibility.
- Request-specific analytics/reporting focused on demand creation, response speed, and match outcomes.

### Main risk areas

- Privacy: demand-side requirements are more sensitive than public listings and can leak location, budget, or vulnerable timing details if overexposed.
- Spam: low-friction request creation can create junk demand, duplicates, and solicitation noise.
- Moderation: free text can become abusive, illegal, or a vehicle for off-platform contact exchange.
- Empty marketplace risk: if open requests receive no useful responses, the feature will feel dead quickly.
- Off-platform leakage: both seekers and responders will try to bypass the platform unless the response model is structured and constrained.

## A. Product framing

### Problem this solves

The marketplace currently depends heavily on supply-first discovery. When seekers cannot find the right listing quickly, the platform loses high-intent demand and hosts/agents do not see what the market is actively asking for.

Property Requests creates a demand-side surface where seekers can state what they need in a structured way and eligible hosts/agents can respond with matching listings already on the platform.

### Why it helps the chicken-and-egg marketplace problem

- It captures unmet demand instead of losing it.
- It shows hosts/agents what seekers are actively looking for in each market.
- It gives existing supply-side users another path to convert inventory without requiring a perfect browse/search match.
- It creates measurable demand signals that can later inform listing acquisition, merchandising, and supply strategy.

### Why it is separate from listings

Requests are not supply objects. They are time-bound demand intents.

They differ from listings in important ways:

- The creator is a seeker, not a host.
- The object describes a need, not an available property.
- The privacy and moderation risk is different.
- The response model is platform-mediated matching, not listing publication.

This must remain a distinct product surface and data model.

## B. Naming

### Recommended product name

`Property Requests`

This is clear, literal, and implementation-safe. It maps cleanly across rent, buy, and shortlet intent without sounding like a social feed or forum.

### URL/path recommendation

- Seeker create/manage surface: `/requests`
- Seeker create flow: `/requests/new`
- Seeker request detail/manage page: `/requests/[id]`
- Host/agent browse surface: `/requests/discover`
- Admin ops surface: `/admin/requests`

### User-facing labels

- Main object: `Property request`
- Seeker CTA: `Post request`
- Supply-side browse CTA: `Browse requests`
- Response CTA: `Send matching listings`
- Inbox label for seeker: `Responses`

Avoid labels like `demand board`, `wanted ads`, or `forum` in user-facing UI.

## C. Audiences

### Seekers

Primary MVP creator audience:

- signed-in tenants using the platform to find rent, buy, or shortlet options

This role maps best to current seeker behavior and keeps the MVP operationally simple.

### Agents / landlords / hosts

Primary MVP responder audience:

- signed-in landlords
- signed-in agents with eligible managed listings

These users can discover open requests and respond by sending matching listings they own or are delegated to manage.

### Admins

Admins can:

- control visibility rules
- review and moderate requests
- remove abusive or low-quality requests
- control who can respond
- monitor demand/response health

## D. Permissions / visibility model

### Who can create requests

MVP default:

- authenticated `tenant` users only

Reason:

- simplest mapping to current seeker role model
- lowers spam from supply-side users posting pseudo-requests
- avoids ambiguity about whether an agent is acting as seeker or responder

Deferred possibility:

- admin-enabled `agent` request creation on behalf of client

Not in MVP.

### Who can view requests

MVP default:

- request owner can view their own requests
- admins can view all requests
- eligible responders (`landlord`, `agent`) can view open requests in the supply-side discovery surface
- other seekers cannot view other seekers’ requests by default

### Whether seekers can see other seekers’ requests

Default: `No`

Admin-controlled future option:

- explicit app setting to allow seeker-to-seeker visibility

MVP recommendation:

- keep this `OFF` and do not expose it in UI yet unless the business intentionally wants a more public demand board

### Admin visibility toggle(s)

MVP should include admin settings for:

- `property_requests_seeker_visibility_enabled`
  - default `false`
  - controls whether seekers can browse requests created by other seekers
- `property_requests_response_roles`
  - default `agent,landlord`
  - controls who is allowed to respond
- `property_requests_auto_expiry_days`
  - default `30`

### Who can respond

MVP default:

- authenticated `agent` and `landlord` users only
- admins do not respond as marketplace participants
- responder can only send listings they own or are actively delegated to manage

## E. MVP workflows

### 1. Seeker creates request

Flow:

1. Seeker opens `/requests/new`
2. Chooses intent: rent, buy, or shortlet
3. Fills structured requirements
4. Saves draft or publishes request
5. On publish, request becomes `open`

Rules:

- creator must be signed in
- required fields enforced before publish
- contact details are not entered into free text
- request is time-bound and gets an expiry date

### 2. Seeker manages request

Flow:

- view own requests at `/requests`
- edit draft or open request
- close request manually when satisfied
- reopen if still searching and not expired/removed
- review incoming listing responses on the request detail page

### 3. Host/agent browses and filters requests

Flow:

- eligible responder opens `/requests/discover`
- filters by market, intent, location, property type, budget, bedrooms, move timeline, recency
- opens a request detail view with structured criteria and limited seeker context

Visibility rules:

- no seeker contact info exposed
- no responder sees removed/closed requests
- expired requests excluded from default results

### 4. Host/agent sends matching listing(s)

Flow:

1. responder opens an `open` request
2. clicks `Send matching listings`
3. selects from eligible owned/managed listings
4. can attach optional short note from a constrained text field
5. submits response

Rules:

- allow multiple listings in one response, capped at 3 for MVP
- only listings that are currently active/eligible can be sent
- duplicate spam should be prevented: do not allow the same responder to resend the same listing repeatedly to the same request without material change

### 5. Seeker receives in-platform response

Flow:

- seeker sees response on the request detail page and in a request responses list
- response renders listing cards with key metadata and responder identity label
- seeker can open listing, save listing, or mark request resolved

MVP response model is platform-mediated, not a full two-way chat.

### 6. Admin moderates/manages requests

Admins can:

- search all requests
- filter by status, market, intent, creator, flagged, expired
- remove abusive or spam requests
- reopen or close requests operationally if needed
- review response activity counts
- tune visibility and expiry settings

## F. Request data model

MVP request fields:

### Core fields

- `id`
- `created_by`
- `intent`
  - `rent` | `buy` | `shortlet`
- `market`
  - country/market selector aligned with existing marketplace market model
- `location_text`
- `location_place_id` (optional but preferred if existing location picker is reused)
- `budget_min_minor` (optional)
- `budget_max_minor` (required for publish unless admin chooses softer rule)
- `currency_code`
- `property_type`
- `bedrooms_min`
- `bedrooms_max` (optional)
- `move_timeline`
  - e.g. `asap`, `within_30_days`, `1_to_3_months`, `flexible`
- `furnishing_preference` (optional)
- `amenities` (optional structured list)
- `free_text`

### Optional fields

- preferred neighborhoods
- minimum bathrooms
- stay duration for shortlet
- financing/cash readiness for buy intent
- pet/family/work-friendly notes where relevant

### System fields

- `status`
- `published_at`
- `expires_at`
- `closed_at`
- `matched_at`
- `removed_at`
- `removed_reason`
- `last_response_at`
- `response_count`

## G. Lifecycle / statuses

Recommended MVP states:

- `draft`
  - seeker can edit privately
- `open`
  - live and available to eligible responders
- `matched`
  - seeker has indicated one of the responses solved the need or the request has clearly converted
- `closed`
  - manually closed by seeker/admin without a confirmed match
- `expired`
  - timed out without manual close
- `removed`
  - hidden by admin/moderation

Notes:

- Do not require a mandatory `pending_review` state in MVP. It adds friction and empty-marketplace risk.
- Admin moderation should be post-publish for most requests, with removal/reporting and rate limits providing the safety net.

## H. Moderation / anti-spam rules

### Required fields before publish

- intent
- market
- location
- price range or meaningful budget ceiling
- property type
- at least one bedroom signal where applicable
- move timeline
- meaningful free text minimum quality threshold

### Privacy rules

- do not expose seeker email, phone number, or exact personal address in request views
- free text should be sanitized and contact-sharing attempts blocked where practical
- seeker-to-seeker visibility stays off by default
- request detail for responders should show only what is needed to assess fit

### Expiry

- default expiry: 30 days after publish
- seeker can close earlier
- admin can extend/reopen operationally if needed

### Reporting

- responders and admins can report abusive/spam requests
- seeker can report abusive responses later, but full responder abuse tooling can remain lightweight in MVP

### Rate limits

MVP should include:

- per-user request creation cap per day/week
- per-request response cap per responder within a cooldown window
- duplicate detection for near-identical open requests by same seeker

### Moderation approach

- automated lightweight validation at publish
- admin removal and ops queue for flagged items
- no heavy pre-approval queue by default

## I. Host response model

### Response structure

Each response should contain:

- `request_id`
- `responder_user_id`
- `responder_role`
- `listing_ids[]` (1 to 3)
- optional short note
- timestamps and status metadata

### Response rules

- responder can only attach listings they own or actively manage
- listings must still be eligible/publicly visible
- same listing should not be repeatedly spammed into the same request
- seeker sees listing cards, not direct responder contact details by default

### Platform-mediated model

The response itself is the first-class action.

The platform should not require free-form chat to make MVP useful. The seeker can act on the listing cards directly:

- open listing
- save listing
- use existing listing enquiry/contact paths if desired

### Intentionally deferred in MVP

- full request-specific chat thread
- negotiation thread
- offer workflow
- responder ranking/reputation system
- AI auto-match generation

## J. Analytics / success metrics

MVP telemetry should measure:

### Demand creation

- requests_started
- requests_published
- publish completion rate
- requests_by_intent
- requests_by_market

### Supply response

- responders_viewing_requests
- responses_sent
- first_response_time
- average responses per open request
- response coverage by market/intent

### Outcome quality

- open_to_first_response rate
- matched rate
- close-without-match rate
- expired rate
- seeker response engagement (open listing, save listing, mark resolved)

### Operational health

- flagged request rate
- removed request rate
- duplicate request rate
- off-platform/contact-block trigger rate

### Longer-term marketplace learning

- does request demand in a market correlate with future listing uploads or featured supply work

That is not an MVP report requirement, but the event model should not block later analysis.

## K. Admin controls

MVP admin controls should include:

- seeker-to-seeker visibility toggle
- allowed responder roles setting
- request expiry days setting
- request moderation list with status filters
- remove / restore / close actions
- flag visibility
- basic response metrics per request

Admin should also be able to see:

- requests with zero responses
- high-response requests
- frequently flagged creators/responders

## L. MVP boundaries / explicitly not now

Not in MVP:

- public contact sharing in request cards
- full chat or forum behavior
- comments or public discussion threads on requests
- AI matching or recommendation ranking
- paid boosts for requests
- public seeker profiles
- request bidding or auction behavior
- agent posting requests on behalf of clients
- mandatory pre-moderation review for every request

## M. Rollout recommendation

### Recommended phased rollout

#### Phase 0: internal schema and admin readiness

- create request and request-response data model
- add admin ops surface and settings
- instrument analytics
- keep seeker-to-seeker visibility off

#### Phase 1: seeker creation + host response MVP

- enable request creation for signed-in tenants
- enable request discovery for agents/landlords
- enable structured listing responses
- keep response model simple and platform-mediated

#### Phase 2: operational tightening

- review response quality and spam patterns
- tune expiry, rate limits, and moderation thresholds
- add lightweight internal reporting for request health

### Suggested MVP build order

1. schema + permissions + settings
2. seeker create/manage flow
3. responder discovery/filtering surface
4. structured send-listings response flow
5. seeker response inbox/history
6. admin moderation controls
7. analytics/reporting pass
8. help/update-note/operator docs pass

## Recommended technical shape for implementation

This section is intentionally concrete enough to guide the implementation batch.

### Suggested core entities

- `property_requests`
- `property_request_responses`
- optional `property_request_reports` if lightweight abuse reporting is included in first pass

### Suggested initial permission contract

- create/manage own request: `tenant`
- browse/respond to open requests: `landlord`, `agent`
- all ops/moderation/settings: `admin`

### Suggested default product settings

- seeker-to-seeker visibility: off
- responder roles: landlord + agent
- auto-expiry: 30 days
- max listings per response: 3
- max open requests per seeker: conservative initial cap

## Trade-offs and rationale

### Why tenant-only creation in MVP

This is the cleanest mapping to current roles and avoids the ambiguity of supply-side users acting as both the creator and responder class in the same launch.

### Why no mandatory review queue

A full review gate creates friction at the exact moment the feature needs liquidity. Lightweight automated checks plus admin removal is the better MVP compromise.

### Why structured responses instead of chat

The key marketplace action is sending relevant listings, not building another inbox product. Structured responses reduce moderation load and off-platform leakage while making analytics much cleaner.

### Why seeker-to-seeker visibility stays off

This is the highest-risk privacy choice in the feature. It should be a deliberate admin-controlled policy decision, not an accidental default.

## Open implementation questions

These should be answered in the build batch, not by widening MVP scope:

- Should request browse results be sorted by recency, fit, market priority, or response scarcity by default?
- Should shortlet requests require stay dates in MVP or just a timeline bucket?
- Should admin removal support canned reasons from day one?
- Should seeker responses support a simple `Helpful / Not relevant` reaction in MVP or later?
- Should zero-response open requests trigger ops visibility or email nudges later?

## Definition of done for the implementation batch

A later build batch should not consider this feature complete unless it includes:

- request creation and management for seekers
- request discovery for eligible responders
- structured listing responses
- admin visibility and moderation controls
- analytics instrumentation
- help/update-note coverage
- double-green go-live validation
- remote Supabase migration push for schema-backed changes
