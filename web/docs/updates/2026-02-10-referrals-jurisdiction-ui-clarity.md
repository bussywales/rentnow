---
title: "Referrals: jurisdiction policy clarity + PAYG-anchored conversion modes"
audiences:
  - ADMIN
  - AGENT
areas:
  - Referrals
  - Admin
cta_href: "/admin/settings/referrals"
---
What changed:
- Clarified the Admin referral jurisdiction policy card with explicit labels for country, currency, cashout/conversion toggles, and manual approval.
- Cashout conversion rate can now be configured as either a fixed amount per credit or a percentage of PAYG listing fee (`payg_listing_fee_amount`), with live percent↔amount auto-calculation.
- Added eligible reward source controls per jurisdiction: PAYG listing fees, featured purchases, and subscriptions.
- Subscriptions remain OFF by default for cashout eligibility to reduce arbitrage risk.

Important:
- Cashout remains disabled by default per jurisdiction until explicitly enabled.
- Conversion math now uses stored amount-per-credit in minor units for request-time enforcement.
- Source-based cashout eligibility is enforced server-side; rewards without mapped source are treated as not cashout eligible.
