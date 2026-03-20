# Payment Provider Routing Decision — 2026-03-20

This document is based on repo truth plus current official provider sources. I did not have access to live provider dashboards, live credentials, or account-level compliance approvals in this environment. Read this as a routing decision framework for go-live, not proof that either provider is already safe to enable live.

## A) Executive summary

The current product does not have one canonical payment-provider routing system.

- Shortlet checkout is the only flow with explicit country/currency provider routing.
- Subscription billing is not routed by country or currency today. It is effectively user-choice driven from the billing UI.
- PAYG listing submission, PAYG featured listing, and featured request payments are Paystack-locked today.
- Repo defaults are still heavily NGN-biased outside shortlets.

Recommended strategy before live:

- Use `Paystack` as the canonical provider for Nigeria-local `NGN` flows only.
- Use `Stripe` as the canonical provider for non-`NGN` international card flows, including UK, US, and Canada.
- Do not assume `Paystack` should own all Nigeria-adjacent or international flows.
- Do not decide routing from market selector alone. Canonical routing must consider:
  - flow
  - charge currency
  - merchant/provider account country and configuration
  - whether the provider is actually enabled for that currency and business category

Biggest risks:

1. Current repo logic is inconsistent across flows.
2. Paystack international availability is not equivalent to universal live readiness for this business category.
3. Paystack officially flags `real estate businesses` as ineligible for international payments in at least some cases.
4. Stripe is structurally better for broader multi-currency international coverage, but only if the operating entity is in a Stripe-supported country.

Top decisions required before live:

1. Choose the canonical routing source of truth and stop letting each payment flow make its own decision.
2. Decide whether PropatyHub’s live entity for international payments is Stripe-supported and which country it is based in.
3. Confirm Paystack business approval scope for this specific business category and whether it includes international transactions.

## B) Current repo truth

### What Stripe currently handles

- Subscription checkout:
  - [web/app/api/billing/stripe/checkout/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/billing/stripe/checkout/route.ts)
- Subscription webhook processing:
  - [web/app/api/billing/stripe/webhook/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/billing/stripe/webhook/route.ts)
- Shortlet booking checkout:
  - [web/app/api/shortlet/payments/stripe/init/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/shortlet/payments/stripe/init/route.ts)
- Shortlet webhook processing:
  - [web/app/api/webhooks/stripe/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/webhooks/stripe/route.ts)

### What Paystack currently handles

- Subscription initialize and verify:
  - [web/app/api/billing/paystack/initialize/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/billing/paystack/initialize/route.ts)
  - [web/app/api/billing/paystack/verify/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/billing/paystack/verify/route.ts)
- PAYG listing submission and PAYG featured listing checkout:
  - [web/app/api/billing/checkout/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/billing/checkout/route.ts)
- PAYG listing/feature webhook:
  - [web/app/api/billing/webhook/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/billing/webhook/route.ts)
- Featured request payments:
  - [web/app/api/payments/featured/initialize/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/payments/featured/initialize/route.ts)
- Shortlet booking checkout:
  - [web/app/api/shortlet/payments/paystack/init/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/shortlet/payments/paystack/init/route.ts)
- Shared Paystack webhook for featured + shortlets:
  - [web/app/api/webhooks/paystack/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/webhooks/paystack/route.ts)

### Where routing exists today

Actual provider-selection logic exists only in shortlets:

- [web/lib/shortlet/payments.server.ts](/Users/olubusayoadewale/rentnow/web/lib/shortlet/payments.server.ts)

Current decision rule:

- if property country is `NG` or booking currency is `NGN`:
  - prefer `Paystack`
- else:
  - prefer `Stripe`
- fallback to the other provider only if the preferred one is disabled

This is the real routing source of truth today:

```ts
const wantsPaystack = propertyCountry === "NG" || bookingCurrency === "NGN";

if (bookingCurrency === "NGN") {
  if (paystackEnabled) chosenProvider = "paystack";
  else if (stripeEnabled) chosenProvider = "stripe";
} else if (stripeEnabled) {
  chosenProvider = "stripe";
} else if (paystackEnabled) {
  chosenProvider = "paystack";
}
```

### Where routing is missing or inconsistent

#### Subscriptions

- Billing UI exposes multiple provider buttons:
  - [web/components/billing/PlansGrid.tsx](/Users/olubusayoadewale/rentnow/web/components/billing/PlansGrid.tsx)
  - [web/components/billing/PlanCard.tsx](/Users/olubusayoadewale/rentnow/web/components/billing/PlanCard.tsx)
- There is no country-based or currency-based provider routing here.
- Stripe prices are GBP-denominated in UI copy.
- Paystack and Flutterwave provider pricing is hardcoded to `NGN`:
  - [web/lib/billing/provider-payments.ts](/Users/olubusayoadewale/rentnow/web/lib/billing/provider-payments.ts)

#### PAYG listing fees

- Provider is hardcoded to `Paystack`
- Currency is hardcoded to `NGN`
- Source:
  - [web/lib/billing/payg.ts](/Users/olubusayoadewale/rentnow/web/lib/billing/payg.ts)
  - [web/app/api/billing/checkout/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/billing/checkout/route.ts)

#### Featured listing / request fees

- Provider is hardcoded to `Paystack`
- Currency is hardcoded to `NGN`
- Sources:
  - [web/lib/billing/featured.ts](/Users/olubusayoadewale/rentnow/web/lib/billing/featured.ts)
  - [web/app/api/billing/checkout/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/billing/checkout/route.ts)
  - [web/app/api/payments/featured/initialize/route.ts](/Users/olubusayoadewale/rentnow/web/app/api/payments/featured/initialize/route.ts)

### Source of truth today

There is no global provider-routing source of truth.

Current state:

- Shortlets: routed in code by country/currency
- Subscriptions: provider selected by user interaction and button availability
- PAYG listing/feature flows: provider locked to Paystack
- Provider modes: configured per provider in `provider_settings`
  - [web/lib/billing/provider-settings.ts](/Users/olubusayoadewale/rentnow/web/lib/billing/provider-settings.ts)

## C) Country / currency decision framework

This is the practical framework that should govern live routing.

### Nigeria local NGN flows

Recommended primary provider: `Paystack`

Why:

- Repo already encodes this rule in shortlets.
- Paystack officially supports `NGN` in Nigeria.
- Paystack’s card rails and local familiarity make it the strongest local-Nigeria fit in this codebase.

Evidence:

- Shortlet routing prefers Paystack for `NG` / `NGN`
- Paystack supported currency docs list `NGN` for Nigeria:
  - [Paystack API docs](https://paystack.com/docs/api/)

Important limitation:

- This says nothing about using Paystack for cross-border or non-NGN real-estate flows.

### UK flows

Recommended primary provider: `Stripe`

Why:

- Repo already treats non-`NGN` shortlets as Stripe-first.
- Stripe is officially available in the UK and supports GBP plus broad multi-currency card charging.
- Current Paystack subscription/PAYG code is still NGN-centric and not shaped for UK-local billing.

Evidence:

- Stripe global availability includes the United Kingdom:
  - [Stripe global availability](https://stripe.com/global)
- Stripe supports GBP, USD, CAD, NGN and many more presentment currencies:
  - [Stripe supported currencies](https://docs.stripe.com/currencies/conversions)

### US flows

Recommended primary provider: `Stripe`

Why:

- Stripe is officially available in the United States and built for USD card billing.
- Current Paystack codebase does not implement US-local merchant routing.
- Paystack international support may improve international card acceptance, but it does not make Paystack the clean default for US-local flows.

Evidence:

- Stripe global availability includes the United States:
  - [Stripe global availability](https://stripe.com/global)

### Canada flows

Recommended primary provider: `Stripe`

Why:

- Stripe is officially available in Canada and supports CAD.
- Repo market support already includes `CA` / `CAD`, but no Paystack-specific Canada routing exists.
- Paystack may help with some international cards, but Canada-local charging is not what the current Paystack code is designed around.

Evidence:

- Stripe global availability includes Canada:
  - [Stripe global availability](https://stripe.com/global)

### Broader international flows

Recommended primary provider: `Stripe`, unless the charge is explicitly `NGN` and the business account is intentionally using Paystack for that lane.

Why:

- Stripe officially supports broad international business coverage and 135+ presentment currencies.
- Current Paystack implementation is narrower, more config-fragile, and partly callback-driven.
- Paystack international payments require explicit approval and currency enablement.

Evidence:

- Stripe supports processing charges in 135+ currencies:
  - [Stripe multiple currencies](https://docs.stripe.com/connect/currencies)
  - [Stripe supported currencies](https://docs.stripe.com/currencies/conversions)
- Paystack supports a smaller explicit currency set per market:
  - [Paystack supported currency](https://paystack.com/docs/api/)
- Paystack international payments must be enabled and currency availability depends on country/business setup:
  - [Paystack international payments](https://support.paystack.com/hc/en-us/articles/360009882000-How-do-I-turn-on-international-payments-on-Paystack)

## D) Flow-by-flow recommendation

### 1. Subscriptions

Recommended owner:

- `Stripe` for UK / US / Canada / non-NGN international
- `Paystack` only for Nigeria-local `NGN` subscriptions if that lane is intentionally kept and approved

Current repo state:

- Not routed centrally
- User can trigger Stripe, Paystack, or Flutterwave from billing UI
- Paystack and Flutterwave subscription pricing is hardcoded `NGN`

Decision:

- Remove provider ambiguity before live.
- Do not present Paystack subscription checkout for non-NGN markets.
- De-scope Flutterwave from live unless a separate decision explicitly keeps it.

### 2. PAYG listing fees

Recommended owner:

- `Paystack` only for Nigeria-local `NGN` listing fees in v1
- `Stripe` for non-NGN markets if PAYG is meant to exist there later

Current repo state:

- Paystack-only
- NGN-only

Decision:

- Treat this as Nigeria-only until a Stripe PAYG path exists.
- Do not imply UK/US/CA readiness for PAYG listing fees yet.

### 3. Featured listing / featured request payments

Recommended owner:

- `Paystack` only for Nigeria-local `NGN` in current code shape
- `Stripe` later if non-NGN featured monetisation is required

Current repo state:

- Paystack-only
- NGN-only
- split across two payment models

Decision:

- Keep this constrained to Nigeria-local NGN until the payment model is unified and a Stripe path exists.

### 4. Shortlet booking payments

Recommended owner:

- `Paystack` for `NGN` / Nigeria stays
- `Stripe` for non-`NGN` stays

Current repo state:

- This is already the live code path

Decision:

- Keep this as the canonical routing model for the rest of the product.
- It is the only payment flow already expressing the right shape of rule.

### 5. Flutterwave

Recommended owner:

- none for this live decision

Current repo state:

- subscription initialize/verify only
- callback-driven

Decision:

- Do not include Flutterwave in the live provider-routing decision unless a separate go-live decision explicitly keeps it.

## E) Constraints and risks

### Provider support limitations

- Stripe availability depends on the business entity being in a supported country.
- Stripe is officially supported in UK, US, and Canada, but not as a normal self-serve country list item for Nigeria in the source reviewed:
  - [Stripe global availability](https://stripe.com/global)

This means:

- if the operating entity is UK/US/CA-based, Stripe is a strong international default
- if the operating entity is Nigeria-only, Stripe assumptions must be reviewed more carefully

### Paystack currency limitations

Official Paystack docs show a narrower supported currency footprint:

- `NGN` in Nigeria
- `USD` in Nigeria and Kenya
- `GHS` in Ghana
- `KES` and `USD` in Kenya
- `ZAR` in South Africa
- `XOF` in Côte d'Ivoire

Source:

- [Paystack supported currency](https://paystack.com/docs/api/)

This means the current business assumption:

- "Paystack for Nigerian locals / NGN"

is credible.

But this assumption:

- "Paystack for international generally"

is not safe without explicit approval and currency configuration.

### Callback / webhook weaknesses

- Stripe subscriptions are webhook-driven
- Paystack subscriptions are callback/verify-driven
- Flutterwave subscriptions are callback/verify-driven
- shortlets have better webhook/reconcile coverage than subscriptions

This makes Stripe operationally stronger for recurring international billing.

### Business-category risk

Paystack’s official help centre says `real estate businesses` are ineligible for international payments in the cited policy context:

- [Paystack international payment eligibility](https://support.paystack.com/en/articles/2127682)

That is a major go-live risk for PropatyHub.

It does not automatically prove domestic NGN Paystack payments are blocked.
It does mean the team must not assume Paystack international real-estate charging is safe to enable live without explicit provider confirmation.

### Unsafe assumptions

These assumptions should be treated as unsafe until proven:

1. `market == Nigeria` always means `Paystack`
2. `Paystack` is acceptable for all real-estate payment flows
3. `UK/US/CA customers` should route to Paystack because they are paying a Nigerian merchant
4. billing market selector alone is enough to decide provider

## F) Recommended canonical routing rules

These are the recommended rules to adopt before live.

### Canonical principles

1. Route by `flow + charge currency + provider capability`, not by marketing market label alone.
2. Treat `NGN` as the clearest signal for Paystack.
3. Treat non-`NGN` international card billing as Stripe territory unless there is an explicit approved Paystack exception.
4. Do not offer providers in UI if backend policy would reject or downgrade them.

### Proposed rules

#### Shortlet bookings

- If `currency == NGN` or `property_country == NG`:
  - use `Paystack`
- Else:
  - use `Stripe`

#### Subscriptions

- If `role in {tenant, landlord, agent}` and `billing currency == NGN` and `account country == NG` and `Paystack international/compliance policy allows this exact lane`:
  - allow `Paystack`
- Else if `account country in {GB, US, CA}` or `billing currency in {GBP, USD, CAD}`:
  - use `Stripe`
- Else:
  - do not expose multi-provider choice until the rule is implemented centrally

#### PAYG listing submission

- If `currency == NGN` and `listing country == NG`:
  - use `Paystack`
- Else:
  - block live use until Stripe or another approved non-NGN implementation exists

#### Featured listing / featured request

- If `currency == NGN` and relevant listing/request country == `NG`:
  - use `Paystack`
- Else:
  - block live use until a non-NGN provider path exists

### What should not be the canonical rule

Do not use:

- `if market == NG then Paystack else Stripe`

That is too coarse because:

- market selector is a display/search context
- provider capability depends on actual charge currency
- provider capability also depends on account-country and compliance state

## G) What must be implemented or cleaned up before live

### 1. Must fix before live

1. Create a single provider-routing helper for all payment flows.
2. Remove UI-level provider ambiguity for subscriptions.
3. Confirm the legal/operating entity country for Stripe account ownership.
4. Confirm with Paystack whether PropatyHub’s business category is approved for:
   - domestic NGN payments
   - international payments
   - USD payments if those are intended
5. Decide whether non-NGN PAYG/featured flows are out of scope for launch.

### 2. Should fix before live

1. Unify Paystack config so billing routes and ops/reconcile routes use the same source of truth.
2. De-scope Flutterwave from checkout UI if it is not part of the live decision.
3. Replace hardcoded NGN provider pricing assumptions for subscriptions with a real routing-aware price configuration.
4. Document exact webhook/callback ownership by provider and flow.

### 3. Can wait until after launch

1. Finer routing by city or sub-market
2. Smart fallback between providers after provider-specific declines
3. A more advanced admin routing control panel

## Final recommendation

The safest canonical decision today is:

- `Paystack` owns Nigeria-local `NGN` lanes
- `Stripe` owns UK / US / Canada / non-NGN international lanes
- `Flutterwave` is out of current live scope
- non-NGN PAYG and featured flows should not be called live-ready until they actually exist in code

The highest-risk unresolved issue is not technical routing alone. It is the mismatch between:

- current repo assumptions
- Paystack’s real country/currency/business-category restrictions
- the lack of one centralized routing source of truth

Until that is resolved, enabling both providers live would be operationally loose.
