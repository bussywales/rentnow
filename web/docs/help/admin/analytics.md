---
title: "Admin analytics"
description: "How to use the analytics hub, read Explore V2 experiments, and interpret host quality telemetry."
order: 22
updated_at: "2026-03-16"
---

## Where to access analytics

- Open `/admin/analytics` for the analytics hub.
- Use the shared sibling navigation to move between:
  - `Marketplace analytics`
  - `Explore analytics`
  - `Explore V2 conversion`
  - `Host analytics`

Use the hub for discoverability. Use each destination for interpretation and export.

## Analytics destinations

### Marketplace analytics

- Route: `/admin/analytics`
- Use for core marketplace health and high-level system snapshot.

### Explore analytics

- Route: `/admin/analytics/explore`
- Use for Explore telemetry exports and event-level tracking controls.

### Explore V2 conversion

- Route: `/admin/analytics/explore-v2`
- Use for micro-sheet conversion reporting and active experiment interpretation.

### Host analytics

- Route: `/admin/analytics/host`
- Use for host-level activity lookups and submit-step listing quality telemetry.

## Explore V2 conversion: what the report means

The Explore V2 conversion report is intentionally narrow.

Included:

- `sheet_opened`
- `primary_clicked`
- `view_details_clicked`
- `save_clicked`
- `share_clicked`

Scope boundary:

- the report covers Explore V2 micro-sheet interactions only
- rail-level save/share events are excluded

Do not treat this report as a full Explore funnel. It is a micro-sheet conversion read.

## Explore V2 trust cue experiment

The trust cue section compares conversion from `sheet_opened` by trust cue variant.

Current buckets:

- `None`
  - no trust cue shown
- `Instant confirmation`
  - the instant-confirmation trust cue was shown
- `Unknown`
  - older rows without `trust_cue_variant`

Interpretation rules:

- use it for directional comparison, not proof of causation by itself
- low-volume differences are noise
- do not change trust cues casually while the experiment is still live
- trust cues must stay truthful and listing-dependent

## Explore V2 CTA copy experiment

The CTA copy section compares conversion from `sheet_opened` by CTA copy variant.

Current buckets:

- `Default`
- `Clarity`
- `Action`
- `Unknown`
  - older rows without `ctaCopyVariant`

Interpretation rules:

- keep labels intent-aware and truthful
- do not collapse `unknown` into `default`
- compare both:
  - primary CTR
  - view details CTR

If one variant wins on one metric but hurts the other, treat that as a trade-off, not an automatic rollout.

## Host analytics: what the report means

`/admin/analytics/host` has two jobs:

1. look up host-level activity
2. show submit-step listing quality telemetry

### Host quality guidance telemetry

The quality telemetry block is submit-step only. It is not a full editor funnel.

Metrics:

- `Guidance viewed`
  - how often hosts reached the submit-step quality guidance
- `Fix clicks`
  - how often hosts clicked a jump-back action
- `CTR`
  - fix clicks divided by guidance views
- `Submit attempts`
  - submit events carrying quality telemetry context
- `Improvement rate`
  - share of submit attempts where score improved before submit
- `Avg score delta`
  - average change between score before guidance and score at submit

`Fix clicks by target step` shows where hosts most often need to go back:

- `Basics`
- `Details`
- `Photos`

Interpretation rules:

- high guidance views with low fix clicks usually means the submit guidance is seen but not compelling
- high fix clicks with weak improvement rate suggests hosts are trying to fix listings but the guidance or step UX is not closing the gap
- if one target step dominates, improve that step before editing cross-step copy elsewhere

## What not to change casually

- Do not broaden Explore V2 conversion scope while experiment reads are active.
- Do not rename experiment buckets without updating reporting and help text together.
- Do not interpret small sample movement as a win or loss.
- Do not use host quality telemetry as a punitive ranking signal; it is guidance telemetry.

## Related guides

- [Admin getting started](/help/admin/getting-started)
- [Admin core workflows](/help/admin/core-workflows)
- [Admin ops](/help/admin/ops)
