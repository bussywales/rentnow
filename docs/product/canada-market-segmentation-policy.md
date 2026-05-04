# Canada Market Segmentation Policy

## Purpose

This document records the Step-0 audit findings for Canada market segmentation and lists the policy decisions that must be made before any Canada-specific implementation work begins.

This is a policy and readiness document only.

No Canada segmentation code should proceed until the decisions in this document are made.

Companion policy:

- The first Canada rental PAYG commercial default set is now documented in [canada-rental-payg-pilot-policy.md](/Users/olubusayoadewale/rentnow/docs/product/canada-rental-payg-pilot-policy.md).
- That companion document defines the intended pilot posture, but it does not make Canada runtime-ready or live.

## Current repo-truth baseline

Canada is partially present in the repo through shared multi-market plumbing, but Canada does not yet have a complete product, pricing, tax, or compliance policy.

What already exists:

- Canada is a selectable market with `CA` / `CAD` support in [web/lib/market/market.ts](/Users/olubusayoadewale/rentnow/web/lib/market/market.ts).
- Market defaults and selector toggles exist in [web/lib/market/market.server.ts](/Users/olubusayoadewale/rentnow/web/lib/market/market.server.ts) and [web/lib/settings/app-settings-keys.ts](/Users/olubusayoadewale/rentnow/web/lib/settings/app-settings-keys.ts).
- Discovery and browse rails already include Canada in:
  - [web/lib/discovery/market-taxonomy.ts](/Users/olubusayoadewale/rentnow/web/lib/discovery/market-taxonomy.ts)
  - [web/lib/discovery/discovery-catalogue.ts](/Users/olubusayoadewale/rentnow/web/lib/discovery/discovery-catalogue.ts)
  - [web/lib/explore/explore-feed.server.ts](/Users/olubusayoadewale/rentnow/web/lib/explore/explore-feed.server.ts)
- Canada location handling already exists in:
  - [web/lib/geocode/normalize-location.ts](/Users/olubusayoadewale/rentnow/web/lib/geocode/normalize-location.ts)
  - [web/lib/location/search-hints.ts](/Users/olubusayoadewale/rentnow/web/lib/location/search-hints.ts)
  - [web/components/properties/PropertyStepper.tsx](/Users/olubusayoadewale/rentnow/web/components/properties/PropertyStepper.tsx)
- Subscription pricing infrastructure already anticipates Canada in:
  - [web/lib/billing/subscription-price-book.ts](/Users/olubusayoadewale/rentnow/web/lib/billing/subscription-price-book.ts)
  - [web/lib/billing/subscription-pricing.ts](/Users/olubusayoadewale/rentnow/web/lib/billing/subscription-pricing.ts)
  - [web/lib/billing/stripe-plans.ts](/Users/olubusayoadewale/rentnow/web/lib/billing/stripe-plans.ts)
- Market pricing control-plane foundation and admin edit controls now exist in:
  - [web/lib/billing/market-pricing.ts](/Users/olubusayoadewale/rentnow/web/lib/billing/market-pricing.ts)
  - [web/lib/billing/market-pricing-control-plane.server.ts](/Users/olubusayoadewale/rentnow/web/lib/billing/market-pricing-control-plane.server.ts)
  - [web/app/admin/settings/billing/market-pricing/page.tsx](/Users/olubusayoadewale/rentnow/web/app/admin/settings/billing/market-pricing/page.tsx)
- Canada pricing test coverage exists in:
  - [web/tests/unit/subscription-pricing.test.ts](/Users/olubusayoadewale/rentnow/web/tests/unit/subscription-pricing.test.ts)
  - [web/tests/unit/billing-market-pricing-contract.test.ts](/Users/olubusayoadewale/rentnow/web/tests/unit/billing-market-pricing-contract.test.ts)
  - [web/tests/unit/ca-us-stripe-migration-contract.test.ts](/Users/olubusayoadewale/rentnow/web/tests/unit/ca-us-stripe-migration-contract.test.ts)

What does not exist yet:

- no Canada-specific plan pricing policy
- no Canada-specific PAYG listing fee policy
- no Canada-specific featured listing or featured request fee policy
- no Canada-specific payment-provider routing policy for all payment lanes
- no Canada-specific tax policy
- no Canada-specific moderation, approval, or compliance policy
- no Canada-specific entitlement or listing-limit policy
- no Canada-specific phased launch policy

## Audit summary

### 1. Shared market support exists, but not a Canada policy layer

The repo supports Canada as a market and currency context, but that is not the same as having a Canada-ready commercial or regulatory policy.

The market layer is currently generic and shared. It does not encode Canada-specific rules for pricing, tax, eligibility, or compliance.

Primary sources:

- [web/lib/market/market.ts](/Users/olubusayoadewale/rentnow/web/lib/market/market.ts)
- [web/lib/market/market.server.ts](/Users/olubusayoadewale/rentnow/web/lib/market/market.server.ts)
- [web/lib/settings/app-settings-keys.ts](/Users/olubusayoadewale/rentnow/web/lib/settings/app-settings-keys.ts)

### 2. Entitlements and listing limits are global today

Current plan entitlements and listing limits are shared across markets.

Primary source:

- [web/lib/plans.ts](/Users/olubusayoadewale/rentnow/web/lib/plans.ts)

Current repo truth does not define whether Canada should:

- use the same plan tiers as other markets
- use the same listing limits as other markets
- use the same tenant unlocks and saved-search limits as other markets
- have any Canada-only eligibility restrictions

### 3. Subscription pricing is the most Canada-ready lane, but real Canada prices are not settled

The recurring subscription pricing infrastructure already treats Canada as a Stripe market and supports Canada-aware resolution behavior.

Primary sources:

- [web/lib/billing/subscription-price-book.ts](/Users/olubusayoadewale/rentnow/web/lib/billing/subscription-price-book.ts)
- [web/lib/billing/subscription-pricing.ts](/Users/olubusayoadewale/rentnow/web/lib/billing/subscription-pricing.ts)
- [web/lib/billing/stripe-plans.ts](/Users/olubusayoadewale/rentnow/web/lib/billing/stripe-plans.ts)

Important constraint:

- repo test coverage exists for Canada pricing behavior, but that does not mean real Canada business pricing is set and approved
- Canada pricing should not be treated as launch-ready until stakeholders define the actual CAD price book and the corresponding provider configuration is confirmed

### 4. PAYG listing and featured fees are not Canada-ready

One-off listing and featured-payment flows still reflect older global assumptions and remain shaped around `NGN` and Paystack-oriented rails.

Primary sources:

- [web/lib/billing/payg.ts](/Users/olubusayoadewale/rentnow/web/lib/billing/payg.ts)
- [web/lib/billing/featured.ts](/Users/olubusayoadewale/rentnow/web/lib/billing/featured.ts)
- [web/app/api/billing/checkout/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/billing/checkout/route.ts)
- [web/app/api/payments/featured/initialize/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/payments/featured/initialize/route.ts)

Current repo truth does not answer:

- whether Canada has PAYG listing fees at launch
- whether Canada has featured listing fees at launch
- whether Canada has featured request payments at launch
- which provider and currency should own those lanes

### 5. Provider routing policy is still incomplete for Canada

Current routing is not consistently centralized across all payment flows.

Primary sources:

- [web/lib/billing/provider-payments.ts](/Users/olubusayoadewale/rentnow/web/lib/billing/provider-payments.ts)
- [web/lib/shortlet/payments.server.ts](/Users/olubusayoadewale/rentnow/web/lib/shortlet/payments.server.ts)
- [docs/product/PAYMENT_PROVIDER_ROUTING_DECISION_2026-03-20.md](/Users/olubusayoadewale/rentnow/docs/product/PAYMENT_PROVIDER_ROUTING_DECISION_2026-03-20.md)

Repo truth suggests `Stripe` is the likely Canada provider for international and non-`NGN` lanes, but that policy is not fully settled across:

- subscriptions
- PAYG listing fees
- featured listing fees
- featured request payments
- shortlets
- Move & Ready / service-related future charges

### 6. No Canada tax policy exists in repo truth

No repo-truth policy was found for Canada-specific sales-tax handling.

The repo does not currently settle:

- whether Canada pricing is tax-inclusive or tax-exclusive
- how GST, HST, and PST should be treated
- what receipts or invoice records must show
- whether tax behavior differs by product surface

This is a policy blocker for Canada monetisation work.

### 7. No Canada-specific moderation, approval, or compliance rules exist

Current listing approval, visibility, and quality gates are shared and not Canada-specific.

Repo truth does not yet define:

- Canada-specific listing approval requirements
- any Canada-specific property or account caps
- moderation rules that differ by country
- compliance or disclosure requirements for suppliers, hosts, or agents in Canada

## Required policy decisions before coding

The following questions must be answered before any Canada segmentation implementation begins.

### A. Launch scope

Stakeholders must decide which product surfaces actually launch in Canada:

- subscriptions
- PAYG listings
- featured listings
- featured requests
- shortlets
- Move & Ready / Property Prep

### B. Payment-provider ownership by lane

Stakeholders must define which provider owns each payment lane in Canada:

- recurring subscriptions
- PAYG listing submission
- featured listing purchase
- featured request purchase
- shortlet booking payments
- any future service-side charges

This decision must be explicit by flow. Canada cannot safely rely on implied defaults.

### C. Canada CAD plan pricing

Stakeholders must define the Canada price book in CAD:

- plan tiers available in Canada
- monthly and yearly prices by role
- whether Canada uses the same plan structure as other markets
- whether any plans are unavailable in Canada at launch

### D. Canada tax handling

Stakeholders must define:

- whether prices are tax-inclusive or tax-exclusive
- how GST, HST, and PST are handled
- whether taxes differ by province or product lane
- what receipts, invoices, or payment records must display

### E. Entitlements and listing limits

Stakeholders must decide whether Canada uses:

- the same listing limits as existing markets
- the same entitlement unlocks as existing markets
- the same free-to-paid conversion posture as existing markets
- any Canada-specific restrictions by role or account type

### F. Approval, moderation, and compliance rules

Stakeholders must define whether Canada needs distinct rules for:

- listing approval or auto-approval
- business verification or account eligibility
- property content/disclosure requirements
- supplier/provider participation rules
- moderation thresholds and enforcement posture

### G. Phased launch vs full marketplace launch

Stakeholders must explicitly decide whether Canada is launched as:

- subscriptions-only first
- subscriptions plus browse/discovery only
- subscriptions plus shortlets
- a full marketplace rollout including one-off monetisation lanes

## Risks if coding starts before policy is settled

If implementation starts before the above decisions are made, the repo risks:

- pricing logic that conflicts with business policy
- tax treatment that is incomplete or incorrect
- payment-provider routing drift across flows
- Canada surfaces appearing launch-ready when they are not
- country-specific compliance gaps being hidden inside generic shared logic
- later rework across billing, entitlements, content, and admin ops

## Policy gate

No Canada segmentation code should proceed until stakeholders define:

- Canada launch scope
- Canada pricing in CAD
- Canada provider routing by payment lane
- Canada tax handling
- Canada-specific entitlement, moderation, and compliance rules

This document should be treated as the pre-implementation policy gate for the Canada market segmentation workstream.

The Canada rental PAYG pilot companion policy narrows some of the commercial defaults for the rental lane, but runtime implementation remains blocked until the remaining tax, provider, tier-model, and activation decisions are completed.

## Audit source files

Primary source files reviewed for this policy document:

- [web/lib/market/market.ts](/Users/olubusayoadewale/rentnow/web/lib/market/market.ts)
- [web/lib/market/market.server.ts](/Users/olubusayoadewale/rentnow/web/lib/market/market.server.ts)
- [web/lib/settings/app-settings-keys.ts](/Users/olubusayoadewale/rentnow/web/lib/settings/app-settings-keys.ts)
- [web/lib/plans.ts](/Users/olubusayoadewale/rentnow/web/lib/plans.ts)
- [web/lib/billing/payg.ts](/Users/olubusayoadewale/rentnow/web/lib/billing/payg.ts)
- [web/lib/billing/featured.ts](/Users/olubusayoadewale/rentnow/web/lib/billing/featured.ts)
- [web/lib/billing/subscription-pricing.ts](/Users/olubusayoadewale/rentnow/web/lib/billing/subscription-pricing.ts)
- [web/lib/billing/subscription-price-book.ts](/Users/olubusayoadewale/rentnow/web/lib/billing/subscription-price-book.ts)
- [web/lib/billing/stripe-plans.ts](/Users/olubusayoadewale/rentnow/web/lib/billing/stripe-plans.ts)
- [web/lib/billing/provider-payments.ts](/Users/olubusayoadewale/rentnow/web/lib/billing/provider-payments.ts)
- [web/lib/shortlet/payments.server.ts](/Users/olubusayoadewale/rentnow/web/lib/shortlet/payments.server.ts)
- [docs/product/PAYMENT_PROVIDER_ROUTING_DECISION_2026-03-20.md](/Users/olubusayoadewale/rentnow/docs/product/PAYMENT_PROVIDER_ROUTING_DECISION_2026-03-20.md)
- [docs/product/SUBSCRIPTION_PRICING_AUDIT_2026-03-30.md](/Users/olubusayoadewale/rentnow/docs/product/SUBSCRIPTION_PRICING_AUDIT_2026-03-30.md)
