---
title: "Removed grey flash during Explore V2 image swipes"
areas: [Explore V2, Images, UI, Performance]
audiences: [TENANT]
published_at: "2026-03-04"
---

## What changed
- Updated carousel slide surfaces to always render a premium neutral base background while swiping.
- Applied dominant-colour fallback backgrounds at the slide wrapper level so transitions never expose a raw grey frame.
- Kept the existing decode-gated placeholder reveal behavior, so placeholders remain stable until image decode completes.

## Rollback plan
- Revert commit `fix(ui): remove grey flash during carousel swipe transitions`.
- If needed, disable Explore via the existing kill switch while rollback deploys.
