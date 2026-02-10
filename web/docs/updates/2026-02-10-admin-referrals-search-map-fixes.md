# Admin referrals, search strictness, and map layering fixes

## What changed
- Fixed referral program status persistence in Admin > Settings > Referrals by tightening no-store behavior and syncing hydrated form state with persisted settings.
- Fixed jurisdiction policy upsert reliability by enforcing a direct unique key on `referral_jurisdiction_policies.country_code` to match `onConflict: "country_code"`.
- Fixed Leaflet stacking overlap so maps no longer sit above UI overlays; request-viewing modal now stays above map layers.
- Updated property search behavior to use strict bedroom matching by default (`2 bed` returns only `2 bed` exact matches), with opt-in broader results via More options.
- Added an Advanced search panel with:
  - Beds mode: Exact or Minimum
  - Price min/max
  - Property type
  - Furnished filter
  - Apply and Reset actions
- Added an “Other available options” section for higher-bedroom alternatives when strict mode is active.

## Notes
- Smart search remains intact and now routes into strict-by-default bed filtering.
- Referral cashout remains disabled per jurisdiction unless explicitly enabled by admin policy.
