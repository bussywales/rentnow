---
title: "Explore V2 mobile comfort polish: dock safe-zone spacing and smoother dock rendering"
areas: [Explore V2, PWA, Performance, Mobile UI]
audiences: [TENANT]
published_at: "2026-03-04"
---

## What changed
- Added a dedicated bottom safe-zone spacer in the Explore V2 feed so the final cards sit comfortably above the mobile GlassDock.
- Improved perceived smoothness while scrolling by temporarily disabling expensive dock blur during active scroll and restoring it when scrolling goes idle.
- Kept existing Explore V2 behaviour unchanged (no route or gesture logic changes).

## Rollback plan
- Revert commit `feat(pwa): add dock safe-zone and reduce blur while scrolling` if regressions are observed.
- If urgent, disable Explore via the existing kill switch while rollback is deployed.
