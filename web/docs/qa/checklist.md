# QA Checklist

## Plan limits (landlord/agent)
- Create listings until the Free plan cap is reached; confirm the New Listing button is disabled.
- Attempt to submit a new listing when at the cap; expect API response with `code=plan_limit_reached`.
- Upgrade CTA is visible and clear when the limit is reached.

## Admin overrides
- In Admin → Users, change a user plan tier and save.
- Set a Max listings override and save (positive integer).
- Confirm the user can publish up to the new limit and events are logged.
