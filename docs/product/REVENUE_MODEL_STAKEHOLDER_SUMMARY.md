# Revenue Model Stakeholder Summary

## What PropatyHub charges for

PropatyHub currently monetises through four main paths in the codebase:

1. subscriptions
2. pay-as-you-go listing submission
3. paid featured placement
4. shortlet booking payments

There is also an admin manual override system, but that is not revenue.

## Who pays and when

### Tenants

- can pay for `Tenant Pro`
- payment starts from `/dashboard/billing`
- current hard backend unlocks are unlimited saved searches, instant alerts, and early-access time

### Landlords and agents

- can pay for `Starter` or `Pro` subscriptions
- can pay one-off fees when they try to submit listings or feature listings without credits
- can pay to activate approved featured requests

### Shortlet guests

- pay when completing a shortlet booking checkout

## What payment unlocks

### Subscription payment

Unlocks time-bound plan access and, for host plans, can issue listing credits and featured credits.

### PAYG listing payment

Unlocks one listing submission into the moderation pipeline.

### PAYG featured payment

Unlocks one featured placement window for a listing.

### Featured request payment

Unlocks approved featured activation for a listing request.

### Shortlet booking payment

Unlocks booking payment completion and booking state progression.

## Current readiness view

### Closest to launch-ready

- Stripe subscriptions
- shortlet booking payments
- Paystack Nigeria-local `NGN` one-off payment lanes

### Still amber

- Paystack subscriptions
- featured monetisation clarity across older/newer models
- full provider-routing standardisation outside shortlets

### Out of initial live scope

- Flutterwave
- broad international Paystack lanes

## Plain-English summary

The platform is designed to earn money from recurring plans, one-off host fees, promoted visibility, and shortlet booking payments. The code already supports all four categories, but not every lane is equally hardened yet. The most disciplined initial live scope is Stripe for international recurring and non-NGN lanes, plus Paystack for Nigeria-local NGN lanes.
