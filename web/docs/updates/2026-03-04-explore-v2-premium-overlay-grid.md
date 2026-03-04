---
title: "Explore V2 premium polish: unified glass controls and safer overlay spacing"
areas: [Explore V2, Mobile UI]
audiences: [TENANT]
published_at: "2026-03-04"
---

## What changed
- Unified the Explore V2 hero control surfaces (Save, Share, CTA, and 1/N badge) under one consistent glass material token for cleaner visual consistency.
- Aligned the overlay controls to a predictable right-side grid with refined spacing and tap-target sizing.
- Increased separation between CTA and carousel dots to prevent collisions on smaller mobile screens.

## Rollback plan
- Revert commit `feat(explore-v2): unify glass surfaces and stabilise overlay grid` if visual regressions are found.
- If urgent, disable Explore using the existing kill switch while rollback is deployed.
