---
title: "Profile page now self-heals missing profiles"
audiences:
  - ADMIN
  - HOST
  - TENANT
  - AGENT
areas:
  - Account
  - Profile
  - Auth
cta_href: "/profile"
---
We fixed an issue where older accounts without a profile record could see “Unable to load profile.” The profile page now creates a minimal profile automatically and offers a safe retry option. We also tightened login redirect handling to avoid confusing errors when navigating between auth flows.
