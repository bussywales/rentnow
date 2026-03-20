# Brand Reference

This folder is the tracked brand documentation home for PropatyHub.

Use it as the source of truth for future product, design, marketing, and Codex work.

## What lives here

- [BRAND_GUIDELINES.md](/Users/olubusayoadewale/rentnow/docs/brand/BRAND_GUIDELINES.md)
  - strategic brand overview
  - live logo and icon references
  - colour and typography guidance
  - tone-of-voice guidance
  - misuse notes
  - source-of-truth boundaries

## Source-of-truth model

Brand information now has three layers:

1. Strategy and usage guidance
   - [BRAND_GUIDELINES.md](/Users/olubusayoadewale/rentnow/docs/brand/BRAND_GUIDELINES.md)
2. Live implementation assets
   - [web/public/logo.svg](/Users/olubusayoadewale/rentnow/web/public/logo.svg)
   - [web/public/logo-dark.svg](/Users/olubusayoadewale/rentnow/web/public/logo-dark.svg)
   - [web/public/mark.svg](/Users/olubusayoadewale/rentnow/web/public/mark.svg)
   - [web/public/icon-192.png](/Users/olubusayoadewale/rentnow/web/public/icon-192.png)
   - [web/public/icon-512.png](/Users/olubusayoadewale/rentnow/web/public/icon-512.png)
3. Runtime brand constants
   - [web/lib/brand.ts](/Users/olubusayoadewale/rentnow/web/lib/brand.ts)

## What was resolved

The old untracked `Branding Blueprint/` root folder was audited and distilled.

Useful retained material:

- strategic brand narrative from:
  - `Branding Blueprint/PropatyHub Blueprint.rtf`
  - `Branding Blueprint/PropatyHub Blueprint - Condensed for Lovart.rtf`
- live logo/mark/icon references already tracked in `web/public`

Material intentionally not kept as tracked source-of-truth:

- duplicate deck exports:
  - `.pptx`
  - `.pdf`
  - slide PNGs
- exploratory raster logo exports
- social video exports
- training videos
- `.DS_Store`

Reason:

- the decks and slide snapshots are heavy duplicates of the same strategic content
- the videos are enablement/tutorial material, not brand source-of-truth
- the live product already has tracked logo/icon assets

## Future rule

The loose root folder itself is no longer part of the repo root workflow.
It was moved to local-only archive storage at `.local-work/Branding Blueprint` and is ignored.

Do not reintroduce loose root-level brand folders as repo source-of-truth.

If new brand material is produced:

- distilled guidance goes in `docs/brand/`
- production assets go in `web/public/` or another tracked asset folder with a clear owner
- temporary working exports stay local and should not be treated as canonical
