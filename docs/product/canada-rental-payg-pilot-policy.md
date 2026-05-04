# Canada Rental PAYG Pilot Policy v1

## Purpose

This document defines the first policy-approved shape for a Canada rental PAYG pilot.

It is a policy and implementation-planning document only.

It does not make Canada live.
It does not change checkout, listing caps, or entitlement runtime.
It does not approve shortlets or a broad Canada sales rollout.

This policy is written against current repo truth as of 2026-05-04:

- market pricing control-plane foundation and admin edit controls exist
- runtime billing and entitlement enforcement still use legacy settings and code constants
- Canada control-plane rows remain draft/policy-gated
- Canada runtime activation is still blocked

## Policy status

- Canada rental PAYG pilot: `defined for implementation planning`
- Canada runtime activation: `not approved in this batch`
- Canada PAYG go-live status: `blocked until implementation prerequisites and remaining compliance decisions are satisfied`

## Repo-truth constraints this policy respects

Current repo truth still matters more than stakeholder preference.

What exists now:

- market pricing policy, entitlement, and one-off price tables exist in the market pricing control plane
- admins can view and edit seeded Canada rows in `/admin/settings/billing/market-pricing`
- current listing caps still resolve from [web/lib/plans.ts](/Users/olubusayoadewale/rentnow/web/lib/plans.ts)
- current PAYG listing price still resolves from [web/lib/billing/payg.ts](/Users/olubusayoadewale/rentnow/web/lib/billing/payg.ts)
- current listing checkout route still routes one-off listing payments through Paystack in [web/app/api/billing/checkout/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/billing/checkout/route.ts)
- current publish entitlement logic still consumes listing credits before falling back to `PAYMENT_REQUIRED` in [web/lib/billing/listing-publish-entitlement.server.ts](/Users/olubusayoadewale/rentnow/web/lib/billing/listing-publish-entitlement.server.ts)
- current active listing caps still block before any beyond-cap PAYG behavior in [web/lib/plan-enforcement.ts](/Users/olubusayoadewale/rentnow/web/lib/plan-enforcement.ts)

What does not exist yet:

- no Canada runtime checkout path
- no rental-only Canada guard in runtime listing checkout
- no Canada Stripe one-off checkout lane for listing PAYG
- no role/tier-aware one-off price model in the market price book
- no Enterprise runtime tier in [web/lib/plans.ts](/Users/olubusayoadewale/rentnow/web/lib/plans.ts)
- no tax/GST/HST/PST implementation or receipt policy in runtime

This means the pilot policy can define the target behavior now, but runtime implementation still requires a controlled follow-up batch.

## Launch scope decision

### Approved scope for the first Canada PAYG pilot

The Canada pilot is approved as:

- rental listings only
- landlord and agent supply-side participation only
- Stripe-owned one-off listing payments
- CAD-denominated pricing only
- market-pricing-control-plane managed, but not live until runtime integration ships

### Explicitly excluded from the first Canada PAYG pilot

The following are out of scope for first live activation unless later approved in a separate batch:

- shortlets
- broad Canada sales marketplace rollout
- anything that implies MLS replacement or unrestricted sales-market dominance
- Flutterwave or Paystack as Canada one-off providers
- tax automation claims beyond manual finance review

### Sales posture

Sales in Canada are `deferred / cautious`.

This policy does not approve a Canada-wide sale or off-plan monetisation rollout. If Canada sales are later introduced, they must be documented as a separate policy decision with their own moderation, provider, and commercial posture.

## User role policy

### Tenant

- Tenant remains demand-side only.
- Tenant has no Canada supply-side listing entitlement in this pilot.
- Tenant is not a Canada PAYG listing customer in this pilot.

### Landlord Free

Pilot target:

- recurring price: `CAD 0`
- active rental listing allowance: `3`
- PAYG extra rental listing rate: `CAD 4`
- featured listing one-off fee: `CAD 10`
- featured credits: `0`
- curated client pages: `0`

### Agent Free

Pilot target:

- recurring price: `CAD 0`
- active rental listing allowance: `5`
- PAYG extra rental listing rate: `CAD 4`
- featured listing one-off fee: `CAD 10`
- featured credits: `0`
- curated client pages: `1`

### Agent Pro

Pilot target:

- recurring price: `CAD 10/month` or `CAD 100/year`
- active rental listing allowance: `10`
- PAYG extra rental listing rate: `CAD 2`
- featured listing one-off fee: `CAD 10`
- featured credits: `1`
- curated client pages: `5`

Implementation note:

- `Agent Pro` is policy-compatible with the current repo's `pro` tier naming.
- Runtime implementation may map Canada `Agent Pro` to the existing `pro` tier if no separate label layer is required.

### Enterprise

Pilot policy target:

- recurring price: `CAD 25/month` or `CAD 250/year`
- active rental listing allowance: `50`
- PAYG extra rental listing rate: `CAD 1`
- featured listing one-off fee: `CAD 5`
- featured credits: `5`
- curated client pages: `20`

Implementation constraint:

- `Enterprise` does not exist as a runtime plan tier in current repo truth.
- Enterprise is therefore approved as a `policy target`, not as an immediately activatable runtime tier.
- Canada runtime activation must not claim Enterprise support until a later batch adds an explicit Enterprise tier or records an approved alternative mapping.

## Listing limit policy

The pilot adopts these market-specific rental caps as target entitlements:

| Role / tier | Canada pilot active rental listings |
| --- | --- |
| Tenant | 0 |
| Landlord Free | 3 |
| Agent Free | 5 |
| Agent Pro | 10 |
| Enterprise | 50 |

Policy meaning:

- these are Canada target entitlements
- they do not change current runtime yet
- they must be represented in market entitlement rows before any Canada activation

## PAYG behavior policy

### Beyond-cap behavior

Policy decision:

- Canada rental PAYG is allowed to publish rental listings beyond the included active listing cap
- this is approved for the Canada pilot only
- it is not automatically approved for Nigeria, UK, or other markets

### Paid extra slot model

Policy decision:

- a Canada PAYG listing purchase creates a paid extra rental listing slot bound to one listing
- this is not a reusable wallet balance
- this is not an unlimited cap bypass

Recommended lifecycle meaning for implementation:

- the paid slot attaches to the specific listing that triggered the PAYG purchase
- the paid slot remains valid while that listing remains an active rental listing in good standing
- if the listing expires, is archived, is paused, is transferred, or otherwise stops counting as an active listing, the slot is treated as consumed for that listing lifecycle
- if the same account later needs another beyond-cap rental listing, another entitlement or fresh PAYG purchase is required unless a higher plan or credit covers it

### Renewal behavior

Policy decision:

- renewal and reactivation of a Canada beyond-cap paid listing may require a fresh PAYG charge if the account is still beyond its included cap and no subscription or listing credit covers the listing lifecycle event
- implementation should keep this consistent with the existing repo's lifecycle-specific entitlement model rather than inventing a separate Canada-only renewal rule

### Rental-only restriction

Policy decision:

- Canada PAYG beyond-cap behavior applies only to rental listings in this pilot
- it must not be valid for shortlets
- it must not silently widen to Canada sales/off-plan listings

## Pricing policy

### Adoption stance

The stakeholder-proposed Canada prices are adopted as `pilot default commercial targets`, with two explicit cautions:

- they are `provisional until final operator sign-off before activation`
- the low Canada PAYG prices are `intentional penetration-pricing choices`, not proven long-term margins

### Promotional posture

Canada PAYG pricing should be treated as promotional launch pricing.

Required review posture:

- review after the first meaningful pilot cohort or first 30 to 60 days of real volume
- assess conversion, abuse risk, listing quality, support load, and unit economics before long-term normalization

### One-off pricing complication in current control plane

Current control-plane v1 cannot encode one-off prices by role or tier.

Current schema supports one-off prices by:

- market
- product code
- provider

It does not yet support:

- landlord free vs agent free vs pro vs enterprise PAYG prices in separate rows
- tier-specific featured one-off fees in separate rows

That means the following pilot target prices are `policy-approved but not yet representable in control-plane v1`:

- PAYG listing `CAD 2` for Agent Pro
- PAYG listing `CAD 1` for Enterprise
- featured listing `CAD 5` for Enterprise

Therefore, Canada runtime activation requires one of these implementation choices before go-live:

1. extend market one-off pricing to support role/tier-aware one-off prices, or
2. explicitly standardize a single Canada-wide one-off price for the first runtime pilot and record that as a launch concession

This document recommends option `1` if the stakeholder pricing differentiation must be honored at launch.

### Featured listing pricing policy

Pilot default:

- featured listing one-off fee: `CAD 10`
- Enterprise target featured listing one-off fee: `CAD 5`
- Agent Pro featured credits: `1`
- Enterprise featured credits: `5`

Product recommendation for first implementation:

- enable a Canada `featured_listing_7d` one-off lane first
- keep `featured_listing_30d` disabled until separately priced and approved

This avoids inventing a 30-day Canada featured price that stakeholders have not approved.

## Provider and currency policy

Canada pilot provider/currency decisions are:

- provider: `Stripe`
- currency: `CAD`
- Paystack: `not approved for Canada PAYG listing charges`
- Flutterwave: `not approved for Canada PAYG listing charges`

This is consistent with the repo's broader payment routing recommendation that non-`NGN` international card billing should be treated as Stripe territory unless there is an explicit approved exception.

## Tax and receipt posture

### Current decision

Canada tax automation is `deferred`.

### What this means

This pilot policy does not approve automated GST, HST, or PST handling in this batch.

Before runtime activation, the team must explicitly decide:

- whether Canada prices are tax-inclusive or tax-exclusive
- what receipts/invoices must display
- whether province-level tax differences matter for this pilot
- whether manual finance review is required for the first live Canada charges

### Safe pilot posture

Until the tax decision is implemented:

- finance and ops must treat Canada PAYG as requiring manual tax/compliance review before activation
- product and support copy must not overclaim tax treatment
- admin UI and operator notes must keep Canada marked policy-gated

## Admin control-plane requirements before any Canada activation

Before Canada can move from draft to implementation-ready, admins must have the following rows defined in the Market Pricing Control Plane.

### Required market policy row

For `market_country = CA`:

- `currency = CAD`
- `policy_state = approved` before implementation testing, then `live` only when runtime integration ships and activation is explicitly approved
- `rental_enabled = true`
- `sale_enabled = false` for the first pilot
- `shortlet_enabled = false`
- `payg_listing_enabled = true` only when runtime integration is ready
- `featured_listing_enabled = true` only if the featured lane is included in the pilot activation
- `subscription_checkout_enabled = true` only if Canada recurring subscription pricing is ready for the approved tiers
- `listing_payg_provider = stripe`
- `featured_listing_provider = stripe` if featured one-off pricing is enabled
- `operator_notes` must reference Canada pilot approval and launch constraints

### Required entitlement rows

At minimum, control-plane rows must exist for:

- `CA / tenant / free`
- `CA / landlord / free`
- `CA / agent / free`
- `CA / agent / pro`

Optional until explicit model extension:

- `CA / agent / enterprise` or equivalent future tier representation

Policy note:

- if Enterprise is not representable in runtime, the row may exist as a planning artifact, but it must not be marketed as live until the tier model supports it

### Required one-off price rows

At minimum, control-plane rows must exist for:

- `CA / listing_submission / stripe / CAD`
- `CA / featured_listing_7d / stripe / CAD`
- `CA / featured_listing_30d / stripe / CAD` set inactive or disabled until separately approved

## Runtime guardrails required before Canada goes live

Canada must not be activated unless all of the following are true:

1. Canada market policy row is `approved` for implementation and only moved to `live` as part of an explicit runtime-launch batch.
2. Stripe provider configuration for the Canada lane is present and verified.
3. CAD pricing rows are present for every enabled Canada one-off lane.
4. Rental-only behavior is enforced in runtime for Canada PAYG listing checkout.
5. Shortlets remain excluded from the Canada PAYG lane.
6. Sales/off-plan remain excluded unless a separate Canada sales decision is implemented.
7. Canada listing-cap enforcement and beyond-cap PAYG logic are integrated deliberately, not by bypassing current caps accidentally.
8. Support, billing, and finance operators have a runbook for Canada pilot charges and rollback.
9. Tax/receipt posture is explicitly signed off, even if the first pilot uses manual review.
10. If tier-specific one-off pricing is required at launch, control-plane and runtime support for role/tier-aware one-off prices must exist before activation.

## Rollback policy

Canada PAYG must be disableable quickly and safely.

Rollback expectation:

- set the Canada market policy away from `live`
- disable Canada one-off price rows
- disable Canada PAYG lane in runtime routing
- keep Canada draft rows for later reactivation instead of deleting them
- retain audit history and operator notes for the rollback event

Canada rollback must not require editing Nigeria or UK pricing behavior.

## Relationship to other markets

### Nigeria

Nigeria may later reuse the same commercial structure pattern:

- free landlord vs free agent distinction
- market-specific caps
- market-specific one-off listing fees
- featured credits
- client page limits

But Nigeria must not inherit Canada prices.

Policy decision:

- reuse the structure later if desired
- do not reuse Canada numbers automatically

### United Kingdom

UK pricing remains explicitly undecided in this batch.

Policy decision:

- do not infer UK PAYG or entitlement policy from Canada pilot pricing
- UK commercial posture requires its own pricing decision

## Remaining policy and implementation blockers

This document resolves the pilot commercial direction, but the following still block Canada runtime go-live:

- tax and receipt posture sign-off
- runtime support for role/tier-aware one-off pricing, or an approved simplified launch price
- explicit Enterprise runtime-tier decision if Enterprise is part of launch scope
- runtime integration for Canada Stripe listing PAYG
- runtime integration for Canada rental-only beyond-cap entitlement behavior
- operator runbooks for Canada billing/recovery/refund posture

## Summary decision set

The Canada rental PAYG pilot is defined as:

- rental listings only
- tenant demand-side only
- landlord free and agent free included
- Agent Pro included as a commercial target
- Enterprise approved as a policy target but not a launch blocker until runtime tier support exists
- Stripe-only, CAD-only
- shortlets excluded
- sales/off-plan deferred
- beyond-cap rental PAYG approved in principle
- stakeholder prices adopted as provisional promotional pilot defaults
- tax handling deferred to explicit sign-off before live activation

## Source files reviewed for this policy

- [docs/product/canada-market-segmentation-policy.md](/Users/olubusayoadewale/rentnow/docs/product/canada-market-segmentation-policy.md)
- [web/lib/plans.ts](/Users/olubusayoadewale/rentnow/web/lib/plans.ts)
- [web/lib/billing/payg.ts](/Users/olubusayoadewale/rentnow/web/lib/billing/payg.ts)
- [web/lib/billing/market-pricing.ts](/Users/olubusayoadewale/rentnow/web/lib/billing/market-pricing.ts)
- [web/lib/billing/market-pricing-control-plane.server.ts](/Users/olubusayoadewale/rentnow/web/lib/billing/market-pricing-control-plane.server.ts)
- [web/app/admin/settings/billing/market-pricing/page.tsx](/Users/olubusayoadewale/rentnow/web/app/admin/settings/billing/market-pricing/page.tsx)
- [web/app/api/billing/checkout/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/billing/checkout/route.ts)
- [web/lib/plan-enforcement.ts](/Users/olubusayoadewale/rentnow/web/lib/plan-enforcement.ts)
- [web/lib/billing/listing-publish-entitlement.server.ts](/Users/olubusayoadewale/rentnow/web/lib/billing/listing-publish-entitlement.server.ts)
- [docs/product/PAYMENT_PROVIDER_ROUTING_DECISION_2026-03-20.md](/Users/olubusayoadewale/rentnow/docs/product/PAYMENT_PROVIDER_ROUTING_DECISION_2026-03-20.md)
