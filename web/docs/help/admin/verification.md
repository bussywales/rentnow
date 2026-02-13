---
title: "Admin verification operations"
description: "Admin guide to verification requirements, rollout controls, and troubleshooting verification gaps."
order: 25
updated_at: "2026-02-13"
---

## Step-by-step operations

1. Open `/admin/system` and confirm verification requirements are visible.
2. Review requirement toggles in `/admin/settings`:
   - `verification_require_email`
   - `verification_require_phone`
   - `verification_require_bank`
3. Keep launch defaults practical (Nigeria-first recommendation):
   - Email: ON
   - Phone: OFF until channel readiness is confirmed
   - Bank: OFF until settlement workflow is fully live
4. Validate role checklists on `/tenant/home`, `/home`, and `/host`.

## Common errors and fixes

- **Users report “pending” despite completing steps**
  - Ask them to refresh `/account/verification`.
  - Verify requirement toggles were not changed recently.
- **Phone verification adoption is low**
  - Keep phone optional until delivery quality is consistent.
  - Use support scripts to validate formatting (`+234...`).
- **Bank required but no self-serve flow**
  - Treat as staged rollout. Keep UI non-blocking and communicate “Coming soon.”

## Success tips (Nigeria-first)

- Roll out verification requirements gradually, not all at once.
- Monitor missing marker counts on `/admin/system` before raising requirements.
- Pair verification policy changes with product updates and help notes so users are not surprised.
