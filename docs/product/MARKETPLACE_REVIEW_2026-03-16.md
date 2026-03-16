# Marketplace Review - 2026-03-16

## Executive summary

This review is based on the shipped reporting surfaces and aggregation helpers, not live production totals. In this shell, live admin data is not safely accessible because the admin pages require an authenticated admin session and the analytics helpers rely on Supabase environment and service-role access that are not available here.

What the current platform can already tell us:

- Explore V2 has a valid experiment readout for trust-cue and CTA-copy variants, but the current surface is best for directional reading, not final keep/kill decisions.
- Host listing quality now has enough telemetry to answer whether submit-step guidance is being reached and whether it correlates with score improvement before submit.
- Property Requests has reached a meaningful operational milestone: admins can now see demand creation, response coverage, first-response timing, and stalled segments by market and intent.

Biggest strengths:

- The core marketplace loops are now measurable without inventing new instrumentation.
- The Property Requests MVP is operational enough to test its thesis.
- The admin surfaces are compact and decision-friendly rather than dashboard sprawl.

Biggest risks:

- Explore V2 experiment reads can still be muddied by low volume, consent gating, and scope misunderstandings.
- Host quality telemetry is focused on the submit step only, so it may under-explain where hosts actually abandon quality fixes.
- Property Requests can still fail silently if demand is published but responders do not engage fast enough.

Top 3 recommended next actions:

1. Start a disciplined weekly metric capture from the shipped admin pages before changing any Explore V2 experiment surfaces.
2. Prioritize Property Requests stall diagnosis over new request-surface expansion if zero-response segments persist.
3. Keep host quality improvements focused on the highest-clicked and lowest-improving step only after two to four weeks of telemetry accumulation.

## Evidence limits

This environment does not provide trustworthy live production numbers for this review.

Why:

- `/admin/analytics/explore-v2`, `/admin/analytics/host`, and `/admin/requests` are admin-authenticated surfaces.
- The Explore V2 and host analytics pages use Supabase-backed server queries and prefer service-role access when available.
- No Supabase environment variables were present in the current shell session.

Because of that, this review is evidence-led about:

- what each surface measures
- what decisions it supports
- what would count as real signal
- what values should be collected next from live admin surfaces

It is not a claim about current production totals.

## Surface audit

### Explore V2 conversion

Current surface:

- `/admin/analytics/explore-v2`

Metrics exposed now:

- `sheet_opened`
- `primary_clicked`
- `view_details_clicked`
- `save_clicked`
- `share_clicked`
- rates from sheet open to each action
- breakdown by day
- breakdown by market
- breakdown by intent
- breakdown by trust cue variant
- breakdown by CTA copy variant

Decision this surface supports:

- whether the micro-sheet itself is producing movement to primary CTA and details
- whether trust-cue and CTA-copy variants are directionally helping or hurting
- whether a given market or intent is materially underperforming

Important limitations:

- consent-gated telemetry means missing volume is not neutral
- micro-sheet only; rail-level save/share is explicitly excluded
- no significance testing or confidence intervals in the UI
- no unique-user/session dedupe in the report
- older rows can land in `unknown` variant buckets
- the report is strongest for directional reads, not final experiment closure

### Host analytics

Current surface:

- `/admin/analytics/host`

Host quality telemetry exposed now:

- guidance viewed
- fix clicks
- click-through rate from viewed to fix click
- submit attempts with quality telemetry
- improvement rate before submit
- average score delta
- fix clicks by target step: `basics`, `details`, `photos`

Decision this surface supports:

- whether submit-step guidance is being seen at all
- whether hosts are using jump-back actions
- which step is drawing the most corrective activity
- whether quality scores are improving before submit

Important limitations:

- telemetry is submit-step focused, not full-step funnel telemetry
- no per-market or per-intent breakdown for quality behavior
- no denominator for earlier step exposure
- no unique-host/session dedupe shown in the page
- strong click volume without score improvement would indicate weak or cosmetic guidance

### Property Requests admin ops and analytics

Current surface:

- `/admin/requests`

Metrics exposed now:

- requests created
- requests published
- open, matched, closed, expired, removed
- requests with responses
- requests with zero responses
- total responses sent
- overall response rate
- average first response time
- median first response time
- breakdown by intent
- breakdown by market
- stall segments for published requests with zero responses

Decision this surface supports:

- whether demand is being created and published
- whether responders are replying at all
- which intents and markets are viable vs stalled
- whether the marketplace loop is failing because requests get no responses or because first response is too slow

Important limitations:

- current analytics are table-derived, not event-funnel telemetry
- no board-view or responder browse telemetry yet
- no explicit publish-abandonment funnel from draft to open
- no responder-side conversion from request detail view to response send
- no cohorting by responder type or listing quality yet

## Explore V2 review

### What is measurable now

Explore V2 is measurable enough to compare variant direction on:

- `sheet_opened -> primary_clicked`
- `sheet_opened -> view_details_clicked`
- supporting behaviors: save and share
- market and intent mix
- trust cue variant performance
- CTA copy variant performance

### What counts as directional signal vs noise

Treat a variant as potentially directional only if all of the following are true:

- it has a meaningful number of `sheet_opened` events relative to the other variants
- the CTR gap is not tiny relative to total volume
- the direction is consistent across at least one more cut, ideally intent or market
- the change does not come from a single day spike

Practical threshold guidance:

- Do not call a winner from very small cells.
- Prefer at least low hundreds of opens per active variant before acting.
- Treat sub-2 point CTR gaps as noise until the volume is comfortably large.
- Treat `unknown` rows as migration/history noise, not as an experiment arm.

### Trust cue experiment assessment

What to look for:

- higher primary CTR without a collapse in detail-view CTR
- stable or improved save/share rates
- consistency by intent, especially shortlet if that cue is most relevant there

Decision rule:

- keep running if volume is still low or signal is mixed
- pause or kill if the cue clearly depresses primary CTR across the main active intent/market
- keep only if the improvement is repeated and not limited to one day or one tiny segment

### CTA copy experiment assessment

What to look for:

- whether `clarity` improves either primary CTR or detail CTR without reducing total engagement quality
- whether `action` changes behavior meaningfully or just adds copy noise
- whether intent-specific differences suggest one label family is good for shortlets but neutral for rent/buy

Decision rule:

- do not collapse the experiment yet unless one arm is clearly harmful
- default and clarity are the most likely serious contenders; action should be held to a higher proof bar because copy drift can muddy meaning
- if `view_details_clicked` rises but primary falls, do not automatically call that bad; it may indicate healthier consideration depending on the intent

### Recommendation

- Keep both Explore V2 experiments live until there is a clean weekly capture set with enough openings per active variant.
- Do not redesign the micro-sheet while these reads are still young.
- If one variant materially underperforms for two consecutive weekly reviews, remove it rather than layering more copy changes on top.

## Host quality review

### Is the telemetry sufficient?

Sufficient for a first product decision cycle: yes.

The shipped telemetry can answer:

- are hosts seeing the submit-step guidance?
- are they clicking the fix actions?
- which step is most often targeted?
- are scores improving before submit?

It is not sufficient yet to answer:

- where in the flow hosts first stall before reaching submit
- whether one step's local nudge is read but ignored
- whether improvement differs by market, host type, or listing type

### What the metrics should suggest

Interpretation framework:

- high guidance views + high fix clicks + positive score delta = guidance is useful
- high guidance views + low fix clicks = summary is visible but not persuasive
- high fix clicks + low improvement rate = hosts try to act but the suggested fix or target step is weak
- clicks concentrated on one step = that step likely contains the largest quality bottleneck

### Likely weak steps to watch

The current design implies these likely failure modes:

- `Basics`: title, location, and price are structurally important; if this step dominates clicks, hosts may be arriving at submit still under-completing fundamentals
- `Details`: if clicks are high but score change is weak, description/title guidance may be too soft or too abstract
- `Photos`: if this dominates, listing supply quality is probably still image-constrained upstream

### Recommendation

- Do not add new quality blockers yet.
- Wait for a stable sample, then improve only the single weakest step indicated by click concentration plus low score improvement.
- If `Photos` is dominant and improvement remains low, the next product move should likely be media workflow simplification rather than more submit-step copy.

## Property Requests review

### Is the MVP loop complete enough to test the thesis?

Yes, for a first operational read.

The platform now supports:

- seeker request creation and management
- responder discovery board
- send-matching-listing workflow
- seeker response visibility
- admin moderation and request analytics

That is enough to test the core thesis:

- will seekers publish demand?
- will responders act on it?
- will demand receive responses fast enough to feel alive?

### Where the likely bottlenecks are

Use this order of diagnosis:

1. `requests created` high but `requests published` low
   - creation/publish friction is the problem
2. `requests published` healthy but `requests with responses` low
   - responder engagement or request discoverability is the problem
3. responses exist but `median first response` is slow
   - marketplace is alive but too sluggish to feel useful
4. one market/intent dominates stall segments
   - supply-demand mismatch is segment-specific, not platform-wide

### What metrics matter most right now

Most important:

- published requests
- requests with responses
- zero-response requests
- response rate
- median time to first response
- stall segments by market + intent

Less important right now:

- total response count alone
- matched count without response context
- raw created count without publish rate

### Recommendation

- Treat `zero-response rate` and `median first response` as the primary health metrics.
- If published demand grows but zero-response segments remain high, the next move should target responder activation and board usability, not more seeker-side feature work.
- If response rate is healthy in one market/intent and dead in another, optimize supply operations segment-by-segment rather than broad product changes.

## Bottleneck diagnosis

Based on current shipped instrumentation and feature maturity, the most likely marketplace weak points are:

1. **Response rate / responder activation**
   - Property Requests now has enough seeker surface area. The highest remaining risk is whether hosts and agents actually respond.
2. **Listing quality upstream**
   - The marketplace still depends on hosts fixing basics, details, and photos before submit. Weak quality will suppress both traditional listing conversion and the usefulness of matches sent to requests.
3. **Experiment discipline**
   - Explore V2 is measurable, but premature CTA/trust changes could destroy read quality before enough evidence accumulates.
4. **Discoverability**
   - Property Requests navigation now exists, but the next risk is not access alone; it is whether the right role gets enough value after entering.

Less likely to be the primary current bottleneck:

- moderation capacity
- the admin surfaces are already operational for this maturity stage
- demand creation itself, unless live publish counts prove otherwise

## Recommended next decisions

### 1. Do now

- Start a weekly operator review using the shipped admin pages and capture the same metric set each time.
- Hold Explore V2 experiment surfaces steady until at least two consecutive weekly reads show the same direction.
- Review Property Requests stall segments weekly and escalate the worst market-intent pair to supply ops immediately if zero-response demand persists.

### 2. Do next

- If host quality telemetry shows one dominant weak step with poor improvement, improve that one step only.
- If Property Requests response rate is weak, add responder-side telemetry next: board views, detail opens, composer starts, sends.
- If one Explore V2 variant is clearly harmful, remove that arm before testing anything else on the same surface.

### 3. Wait for more data

- Killing or declaring a winner in the CTA copy experiment
- major redesign of Explore V2 micro-sheet structure
- publish-blocking host quality rules
- broad Property Requests product expansion beyond the current core loop

### 4. Do not do yet

- do not add more Explore V2 experiments on top of trust cue and CTA copy simultaneously
- do not build a large BI dashboard for Property Requests yet
- do not add full chat or off-platform contact paths to requests
- do not add punitive listing-quality blockers without strong proof that guidance has plateaued

## Anti-noise guidance

Do not change these yet unless there is a clear regression:

- Explore V2 micro-sheet structure, CTA meaning, or trust presentation while experiment reads are still forming
- host submit-step quality summary wording plus jump-back actions before a telemetry read cycle completes
- Property Requests request schema or response model before the current loop is measured for at least a few review cycles

Changes most likely to muddy reads right now:

- simultaneous copy and layout changes in Explore V2
- adding new host quality warnings while measuring current jump-back behavior
- changing responder eligibility, visibility rules, and request board filters at the same time

## Weekly review checklist

Each weekly review should record, at minimum:

### Explore V2

- total `sheet_opened`
- primary CTR overall
- details CTR overall
- trust cue variant rows
- CTA copy variant rows
- top active market and intent

### Host quality

- guidance viewed
- fix clicks
- CTR
- submit attempts
- improvement rate
- average score delta
- clicks by target step

### Property Requests

- requests published
- open requests
- requests with responses
- zero-response requests
- response rate
- median first response
- top stall segments by market + intent

## What to collect from live admin surfaces next

Because this review could not read live totals directly, the next live review should capture:

1. Screenshot or CSV export from `/admin/analytics/explore-v2`
2. Screenshot from `/admin/analytics/host`
3. Screenshot from `/admin/requests`
4. A one-line note on whether volume is growing, flat, or noisy week over week

With those values, the next review can move from framework to live product diagnosis.
