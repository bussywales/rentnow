# UTM convention

This is the team convention for campaign tagging on PropatyHub / RentNow. Use these rules consistently so acquisition reporting remains credible.

## Required parameters
- `utm_source`
- `utm_medium`
- `utm_campaign`

## Optional parameters
- `utm_content`
- `utm_term`

## Field rules
### `utm_source`
What it means:
- the platform or source sending the traffic

Use:
- lowercase
- no spaces
- platform-specific names

Examples:
- `facebook`
- `instagram`
- `google`
- `whatsapp`
- `newsletter`
- `partner_name`

### `utm_medium`
What it means:
- the marketing channel type

Allowed vocabulary:
- `cpc`
- `paid_social`
- `social`
- `email`
- `referral`
- `display`
- `influencer`
- `affiliate`
- `organic`

Do not invent near-duplicates like:
- `paidsocial`
- `paid-social`
- `social_paid`

### `utm_campaign`
What it means:
- the stable business campaign name

Use:
- lowercase
- snake_case
- stable naming for a whole campaign flight

Examples:
- `uk_launch_q2`
- `agent_monthly_push`
- `tenant_saved_searches_april`

### `utm_content`
What it means:
- the creative or audience variant

Use it for:
- hook variant
- audience variant
- ad version
- placement variant

Examples:
- `creative_a`
- `video_hook_1`
- `landlord_angle`
- `carousel_card_3`

### `utm_term`
What it means:
- search keyword style targeting when relevant

Use only where that concept is real, for example:
- paid search keywords

Examples:
- `london_flat`
- `house_for_rent_uk`

## Naming rules
- lowercase only
- use underscores, not spaces
- keep names short but unambiguous
- do not encode dates into every field unless they are part of the real campaign identity

## Recommended examples
### Facebook paid ads
```text
utm_source=facebook
utm_medium=paid_social
utm_campaign=uk_launch_q2
utm_content=creative_a
```

### Organic social post
```text
utm_source=instagram
utm_medium=social
utm_campaign=april_supply_story
utm_content=reel_1
```

### Email
```text
utm_source=newsletter
utm_medium=email
utm_campaign=tenant_digest_april
utm_content=hero_cta
```

### WhatsApp
```text
utm_source=whatsapp
utm_medium=referral
utm_campaign=host_direct_share
utm_content=listing_share
```

### Partner / referral traffic
```text
utm_source=partner_name
utm_medium=affiliate
utm_campaign=q2_partner_push
utm_content=homepage_link
```

## What to avoid
- missing `utm_source` with only `utm_medium`
- changing `utm_campaign` every time creative changes
- putting audience and platform into the same field
- using human-readable sentences instead of stable tokens
- relying on direct traffic for paid campaigns

## QA checks before launch
1. Open the exact campaign URL.
2. Confirm all expected UTM params are present.
3. Confirm the landing page is correct.
4. Confirm later events retain the same attribution in `product_analytics_events`.
5. Confirm GA4 Realtime shows the expected source / medium.
