# Subscription Pricing Audit — 2026-03-30

## Scope

- Product area: subscriptions only
- Roles: tenant, landlord, agent
- Markets audited: GB, NG, CA, US
- Providers in current runtime path: Stripe, Paystack, Flutterwave

## Current pricing truth chain

1. Billing page pricing is resolved in `/web/app/dashboard/billing/page.tsx`.
2. Active market is resolved by `resolveMarketFromRequest(...)` in `/web/lib/market/market.ts`.
3. Subscription quotes are resolved centrally by `resolveSubscriptionPlanQuote(...)` in `/web/lib/billing/subscription-pricing.ts`.
4. Stripe price IDs are selected by `resolveStripePriceSelection(...)` in `/web/lib/billing/stripe-plans.ts`.
5. Paystack and Flutterwave subscription prices are hardcoded in `/web/lib/billing/provider-payments.ts`.
6. Stripe checkout uses the same quote resolver in `/web/app/api/billing/stripe/checkout/route.ts`.

Result:

- UI display and checkout now share one canonical quote contract.
- Pricing truth is still split across:
  - Stripe env price IDs
  - hardcoded local-provider price tables
  - provider mode in the database

## Runtime modes audited

- Stripe mode: `live`
- Paystack mode: `test`
- Flutterwave mode: `test`

## Configured Stripe price keys found

- `STRIPE_PRICE_LANDLORD_MONTHLY`
- `STRIPE_PRICE_LANDLORD_YEARLY`
- `STRIPE_PRICE_AGENT_MONTHLY`
- `STRIPE_PRICE_AGENT_YEARLY`
- `STRIPE_PRICE_TENANT_MONTHLY`
- `STRIPE_PRICE_TENANT_YEARLY`

No market-specific Stripe subscription price keys were configured in the local runtime environment during this audit.

## Pricing matrix

| Market | Role | Cadence | Display | Provider | Resolution key | Fallback | Safe | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GB | Tenant | Monthly | £9.99 | Stripe (live) | `STRIPE_PRICE_TENANT_MONTHLY` | No | Conditional | Runtime-consistent, but differs from older planning doc that said £9.00 |
| GB | Tenant | Yearly | £99.00 | Stripe (live) | `STRIPE_PRICE_TENANT_YEARLY` | No | Conditional | Runtime-consistent, but differs from older planning doc that said £90.00 |
| GB | Landlord | Monthly | £19.99 | Stripe (live) | `STRIPE_PRICE_LANDLORD_MONTHLY` | No | Unsafe business truth | Points to `Landlord Plan` in Stripe, but differs from planning doc that said £29.00 |
| GB | Landlord | Yearly | £199.00 | Stripe (live) | `STRIPE_PRICE_LANDLORD_YEARLY` | No | Unsafe business truth | Points to `Landlord Plan` in Stripe, but differs from planning doc that said £290.00 |
| GB | Agent | Monthly | £49.99 | Stripe (live) | `STRIPE_PRICE_AGENT_MONTHLY` | No | Conditional | Resolver is correct; amount comes from Stripe/env config |
| GB | Agent | Yearly | £499.00 | Stripe (live) | `STRIPE_PRICE_AGENT_YEARLY` | No | Conditional | Resolver is correct; amount comes from Stripe/env config |
| NG | Tenant | Monthly | ₦900.00 | Paystack (test) | `PAYSTACK_TENANT_MONTHLY_NGN` | No | Unsafe | Hardcoded in app code, not admin-authored pricing truth |
| NG | Tenant | Yearly | ₦9,000.00 | Paystack (test) | `PAYSTACK_TENANT_YEARLY_NGN` | No | Unsafe | Hardcoded in app code, not admin-authored pricing truth |
| NG | Landlord | Monthly | ₦2,900.00 | Paystack (test) | `PAYSTACK_LANDLORD_MONTHLY_NGN` | No | Unsafe | Hardcoded in app code, not admin-authored pricing truth |
| NG | Landlord | Yearly | ₦29,000.00 | Paystack (test) | `PAYSTACK_LANDLORD_YEARLY_NGN` | No | Unsafe | Hardcoded in app code, not admin-authored pricing truth |
| NG | Agent | Monthly | ₦4,900.00 | Paystack (test) | `PAYSTACK_AGENT_MONTHLY_NGN` | No | Unsafe | Hardcoded in app code, not admin-authored pricing truth |
| NG | Agent | Yearly | ₦49,000.00 | Paystack (test) | `PAYSTACK_AGENT_YEARLY_NGN` | No | Unsafe | Hardcoded in app code, not admin-authored pricing truth |
| CA | Tenant | Monthly | £9.99 | Stripe (live) | `STRIPE_PRICE_TENANT_MONTHLY` | Yes | Unsafe | No CAD coverage; explicit GBP fallback |
| CA | Tenant | Yearly | £99.00 | Stripe (live) | `STRIPE_PRICE_TENANT_YEARLY` | Yes | Unsafe | No CAD coverage; explicit GBP fallback |
| CA | Landlord | Monthly | £19.99 | Stripe (live) | `STRIPE_PRICE_LANDLORD_MONTHLY` | Yes | Unsafe | No CAD coverage; explicit GBP fallback |
| CA | Landlord | Yearly | £199.00 | Stripe (live) | `STRIPE_PRICE_LANDLORD_YEARLY` | Yes | Unsafe | No CAD coverage; explicit GBP fallback |
| CA | Agent | Monthly | £49.99 | Stripe (live) | `STRIPE_PRICE_AGENT_MONTHLY` | Yes | Unsafe | No CAD coverage; explicit GBP fallback |
| CA | Agent | Yearly | £499.00 | Stripe (live) | `STRIPE_PRICE_AGENT_YEARLY` | Yes | Unsafe | No CAD coverage; explicit GBP fallback |
| US | Tenant | Monthly | £9.99 | Stripe (live) | `STRIPE_PRICE_TENANT_MONTHLY` | Yes | Unsafe | No USD coverage; explicit GBP fallback |
| US | Tenant | Yearly | £99.00 | Stripe (live) | `STRIPE_PRICE_TENANT_YEARLY` | Yes | Unsafe | No USD coverage; explicit GBP fallback |
| US | Landlord | Monthly | £19.99 | Stripe (live) | `STRIPE_PRICE_LANDLORD_MONTHLY` | Yes | Unsafe | No USD coverage; explicit GBP fallback |
| US | Landlord | Yearly | £199.00 | Stripe (live) | `STRIPE_PRICE_LANDLORD_YEARLY` | Yes | Unsafe | No USD coverage; explicit GBP fallback |
| US | Agent | Monthly | £49.99 | Stripe (live) | `STRIPE_PRICE_AGENT_MONTHLY` | Yes | Unsafe | No USD coverage; explicit GBP fallback |
| US | Agent | Yearly | £499.00 | Stripe (live) | `STRIPE_PRICE_AGENT_YEARLY` | Yes | Unsafe | No USD coverage; explicit GBP fallback |

## Confirmed findings

### 1. No landlord/agent resolver swap

The suspected UK role swap is **not** a resolver bug.

Proof:

- `landlord-pro` maps to role `landlord` in `/web/lib/billing/subscription-plan-cards.ts`
- `agent-pro` maps to role `agent` in `/web/lib/billing/subscription-plan-cards.ts`
- `resolveStripePriceSelection(...)` builds role-specific env keys in `/web/lib/billing/stripe-plans.ts`
- The configured landlord price IDs retrieve Stripe product name `Landlord Plan`
- The configured agent price IDs retrieve Stripe product name `Agent Plan`

Conclusion:

- Current UK mapping is role-correct.
- The problem is pricing truth drift between configured Stripe prices and older planning docs.

### 2. UK landlord price is lower than planning docs

Repo planning docs in `/docs/product/REVENUE_MODEL_AND_PAYMENT_STAGES.md` still describe:

- Landlord Pro: `£29 / month`, `£290 / year`
- Agent Pro: `£49 / month`, `£490 / year`
- Tenant Pro: `£9 / month`, `£90 / year`

Current runtime Stripe truth resolves to:

- Landlord Pro: `£19.99 / month`, `£199.00 / year`
- Agent Pro: `£49.99 / month`, `£499.00 / year`
- Tenant Pro: `£9.99 / month`, `£99.00 / year`

Conclusion:

- This is a config/business-truth mismatch, not a plan-role bug.

### 3. Nigeria pricing is not business-authored pricing truth

NGN pricing currently comes from hardcoded provider tables in `/web/lib/billing/provider-payments.ts`.

That means:

- it is explicit
- it is not admin-owned
- it is not auditable
- it is not market-strategy-ready

Conclusion:

- NG pricing is operationally deterministic
- NG pricing is not trustworthy as long-term business truth

### 4. Canada and US remain explicit fallback markets

CA and US currently resolve to legacy GBP Stripe prices with explicit fallback messaging because no CAD or USD Stripe subscription price keys exist.

Conclusion:

- The fallback is technically honest
- It is not acceptable as mature pricing coverage

## Immediate actions required before broader rollout

1. Decide whether UK landlord runtime price should remain `£19.99/£199.00` or be corrected to the business target.
2. Treat `/docs/product/REVENUE_MODEL_AND_PAYMENT_STAGES.md` as non-runtime until pricing truth is centralized.
3. Stop treating NGN provider tables as canonical business pricing.
4. Do not present CA or US subscription pricing as launch-ready until market-specific price book coverage exists.
