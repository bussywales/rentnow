# Tenant UX Gold Pass - Final Checklist

Use this as a sign-off standard before widening tenant access.

## 1) First Impression (0-10 seconds)
- Tenant lands on /tenant, not a generic dashboard
- Page has consistent left/right margins (matches /properties)
- Clear welcome headline ("Welcome back, {Name}")
- One obvious primary action above the fold
- No admin/host language visible (e.g. "listings", "manage", "publish")

Pass test: A non-technical tenant immediately understands what this app is for and what to do next.

## 2) Visual Hierarchy & Layout
- Max width capped (max-w-6xl or equivalent)
- Content padded (px-4 sm:px-6 lg:px-8)
- Sections clearly separated (hero -> actions -> content)
- Empty states are visually lighter than active content
- CTA buttons have strong contrast (no white-on-white issues)

Pass test: Page feels calm, not cramped or stretched edge-to-edge.

## 3) Primary Tenant Actions (Golden Path)

Tenant should always see at least one of these:
- View matching listings (primary CTA)
- Create / edit saved search
- Contact landlord / agent
- Track viewings or messages

Rules:
- One primary CTA (filled button)
- Secondary actions are outlined or subtle
- Never more than 2 CTAs competing at once

## 4) Empty States (Critical)

For every empty section, confirm:
- Explains why it is empty
- Explains what happens when they act
- Has exactly one relevant CTA
- Uses reassuring language (no blame)

Example:
"You don't have any saved searches yet. Create one and we'll notify you when matching homes appear."

Pass test: Empty doesn't feel broken or unfinished.

## 5) Copy & Language (Tenant-Friendly)
- No internal terms ("entities", "records", "telemetry")
- No admin verbs ("manage", "configure", "publish")
- Short sentences, plain English
- Location-aware language if possible ("homes in Manchester")

Pass test: Would a letting-agent-averse tenant still trust this?

## 6) Navigation & Orientation
- Tenant nav only shows tenant-relevant items
- No links to /host, /admin, /dashboard
- Current section is visually highlighted
- Back navigation never leads to role-mismatch pages

## 7) Loading & Transitions
- Loading skeleton respects same margins as content
- No layout jump when data loads
- Skeleton visually resembles final layout
- No flashing auth redirects or spinners

Pass test: App feels "native", not web-hacky.

## 8) Accessibility (Minimum Gold Standard)
- All CTAs keyboard-focusable
- Focus-visible styles are visible
- Button text contrasts meet WCAG AA
- No essential info conveyed by color alone

## 9) Emotional UX (Often Missed)

Ask:
- Does this feel helpful, not transactional?
- Does it reduce anxiety around renting?
- Does it feel like someone is guiding me?

Add at least one:
- Gentle reassurance line ("We'll notify you automatically")
- Progress cue ("You're all set" / "Nothing else to do right now")

## 10) Hard Fail Conditions (Block Release if Any)

- FAIL: Tenant sees host/admin UI
- FAIL: White text on light background
- FAIL: Edge-to-edge content with no margins
- FAIL: Empty sections with no explanation
- FAIL: Login/session instability
- FAIL: More than one primary CTA competing

## Recommendation

YES - give this checklist to Codex.

Use it as a definition of done for tenant UX going forward.

If you want, next high-impact moves would be:
1. Tenant onboarding micro-tour (3 steps, dismissible)
2. Saved search "confidence" indicator ("We'll notify you instantly")
3. Trust signal strip ("Verified landlords - Secure messaging")

## Viewing requests: tenant flow
- Request modal offers pre-generated slots (1–3) in the property’s timezone (06:00–22:00) with 30/60 minute lengths.
- Default message is polite and editable; submit disabled until a slot is chosen.
- Helper text clarifies “Times shown in {City} time ({IANA timezone})”.
- After success, CTA changes to “Viewing requested” with a link to “View my requests”.
- Tenant viewings page shows slots formatted in property timezone with a clear empty state CTA to browse homes.
