---
title: "Seed host profile completeness fields for internal billing smoke accounts"
audiences:
  - ADMIN
areas:
  - Billing
  - Support
cta_href: "/admin/billing"
published_at: "2026-04-02"
---

## 2026-04-02 - Billing test-account profile completeness seeding

- Updated the internal billing smoke-account provisioner to seed harmless placeholder `phone` and `preferred_contact` values for designated `.test` landlord and agent accounts.
- Tenant billing smoke accounts remain unchanged.
- The provisioner only fills these fields when they are blank, so reruns do not clobber legitimate non-empty profile data on reused test accounts.
- Billing test-account reset continues to operate only on `profile_plans`, so the seeded profile-completeness fields persist across resets and suppress the host/agent profile-completeness banner during billing smoke flows.
