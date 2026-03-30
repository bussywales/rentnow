# Admin Subscription Price Book V1

## Decision

Recommended model: **DB-backed canonical price book with later provider-sync tooling**.

This is the correct v1 because:

- provider mode is already DB-backed
- current env-driven pricing is operationally fragile
- admin-owned pricing needs auditability and explicit market coverage
- Stripe prices should be linked infrastructure references, not the business source of truth

## Why the current env model is insufficient

### Operational fragility

- Environment variables are hard to inspect safely.
- Pricing changes require deploy-time mutation.
- Market coverage is easy to miss because missing currencies silently fall back.

### Scaling limits

- Currency-suffixed env keys do not scale well across:
  - product area
  - role
  - tier
  - cadence
  - market
  - provider
  - effective dates

### Mis-mapping risk

- Env names can be correct while the linked Stripe price is still commercially wrong.
- There is no durable audit layer explaining why a price exists.

### No admin ownership

- Operators cannot review, draft, compare, or retire prices from the product.

### Weak auditability

- There is no structured history for:
  - who changed pricing
  - when it changed
  - why it changed
  - what fallback should apply

## Canonical model

The platform should store one canonical row per subscription price option.

Suggested table: `subscription_price_book`

### Core fields

- `id`
- `product_area`
  - fixed to `subscriptions` for this first table
- `role`
  - `tenant`
  - `landlord`
  - `agent`
- `tier`
  - `tenant_pro`
  - `pro`
  - `starter`
  - `free` if needed for catalog completeness
- `cadence`
  - `monthly`
  - `yearly`
- `market_country`
  - e.g. `GB`, `NG`, `CA`, `US`
- `currency`
  - e.g. `GBP`, `NGN`, `CAD`, `USD`
- `amount_minor`
- `provider`
  - `stripe`
  - `paystack`
  - `flutterwave`
- `provider_price_ref`
  - Stripe `price_...`
  - Paystack plan/reference id if later introduced
  - Flutterwave plan/reference id if later introduced
- `active`
- `fallback_eligible`
- `effective_at`
- `ends_at`
- `display_order`
- `badge`
  - optional, e.g. `Popular`
- `operator_notes`
- `created_at`
- `updated_at`
- `updated_by`

### Suggested constraints

- only one active row per unique:
  - `product_area`
  - `role`
  - `tier`
  - `cadence`
  - `market_country`
  - `provider`
  - time window
- `amount_minor > 0` for paid tiers
- `currency` must match supported currency enum
- `fallback_eligible = false` by default

## Canonical quote resolution

UI and checkout should both resolve from the same internal quote service:

1. exact active row by:
   - product area
   - role
   - tier
   - cadence
   - market
2. exact active row by:
   - role
   - tier
   - cadence
   - fallback market only when explicitly allowed
3. if no safe fallback row exists:
   - disable purchase
   - show missing market coverage

The quote service should return:

- display currency
- display amount
- provider
- provider price reference
- fallback state
- missing-coverage reason

## Recommended admin UX

Keep v1 small and operator-safe.

### Primary screen

`/admin/settings/billing/prices`

### Table columns

- market
- role
- tier
- cadence
- currency
- amount
- provider
- provider price reference
- active
- fallback eligible
- effective date
- updated at
- updated by

### Filters

- market
- role
- cadence
- provider
- active state
- fallback eligible
- missing provider ref

### Row actions

- view
- duplicate
- deactivate
- edit draft replacement

### Edit form

- currency
- amount
- provider
- provider price reference
- fallback eligible
- effective date
- operator notes

### Required operator diagnostics

- market coverage gaps
- rows that fallback to another currency
- rows missing provider refs
- rows where display and checkout are misaligned

## Stripe sync strategy

Stripe should be a downstream payment rail.

### Rules

1. Store Stripe price IDs in PropatyHub.
2. Do not mutate active Stripe recurring prices in place.
3. When pricing changes:
   - create a new Stripe price
   - keep the old Stripe price for existing subscribers
   - link the new Stripe price to the new active price-book row
4. Checkout always uses the currently active internal price-book row.
5. Existing subscriptions remain on their original Stripe price unless a deliberate migration project is run.

### Why

- avoids breaking active subscriptions
- preserves historical billing truth
- keeps product pricing decisions inside PropatyHub

## Recommended rollout path

### Phase 1

- Keep current resolver
- Add DB-backed price-book table
- Add admin read-only matrix view
- Backfill current live/test subscription rows into the table

### Phase 2

- Change resolver source from env/provider tables to DB price book
- Keep env keys as emergency fallback only

### Phase 3

- Add provider-sync helpers for Stripe price creation and linking
- Add publish discipline with replacement rows instead of in-place edits
