# PropatyHub Brand Guidelines

This document is the durable brand reference for PropatyHub.

It combines:

- the useful strategic material recovered from the old `Branding Blueprint/` folder
- the live brand assets and constants already used in the product

## 1. Brand overview

### Brand name

`PropatyHub`

### Working brand role

PropatyHub is a trust-led property platform designed to help people discover, evaluate, and navigate property opportunities with more clarity and confidence.

### Core idea

`Property with more clarity and confidence.`

### Current product tagline

From [web/lib/brand.ts](/Users/olubusayoadewale/rentnow/web/lib/brand.ts):

`Property Rentals & Sales Re-Imagined`

### Priority markets

- Nigeria
- Canada

Supporting market:

- United Kingdom

### Primary audiences

- property seekers
- landlords
- agents
- diaspora-connected audiences

## 2. Brand positioning

The brand should not present itself as just another generic property listings site.

The stronger position is:

- trust-led
- clarity-first
- modern
- digitally credible
- cross-market aware

What the brand should repeatedly communicate:

- trust
- clarity
- access
- possibility
- connection across markets

## 3. Brand personality

Recovered from the blueprint materials, the intended brand personality is:

- trustworthy
- modern
- premium
- digital-first
- human-centred
- clear
- intelligent

The product should feel:

- deliberate, not accidental
- polished, not improvised
- calm, not noisy
- premium, not flashy

## 4. Tone of voice

The intended tone is:

- calm
- clear
- confident
- credible
- modern
- useful

Operational writing rules:

- explain plainly
- reduce confusion
- avoid property-market hype
- avoid empty luxury language
- sound competent and composed
- favour clarity over cleverness

## 5. Visual direction

The recovered brand strategy points to:

- a blue-led premium palette
- clean structured layouts
- bold but controlled typography
- minimal clutter
- high-trust visual cues
- realistic aspirational property imagery

The current live product already reflects part of this direction through its logo and UI colour system.

## 6. Core colours

### Canonical live colours in use

These are the current tracked colours visible in live brand assets and app styling.

From [web/public/logo.svg](/Users/olubusayoadewale/rentnow/web/public/logo.svg) and [web/public/mark.svg](/Users/olubusayoadewale/rentnow/web/public/mark.svg):

- deep brand blue: `#03497A`
- bright brand blue: `#0B8CBE`

From [web/app/globals.css](/Users/olubusayoadewale/rentnow/web/app/globals.css):

- background: `#F8FAFC`
- foreground: `#0F172A`
- accent: `#0EA5E9`
- muted text: `#CBD5E1`

### Guidance

- use blue as the trust and clarity anchor
- keep backgrounds clean and bright
- use dark slate for readable product text
- use bright accent blue to highlight interaction, not to flood the interface

### Do not

- overload layouts with too many competing bright colours
- drift into flyer-style saturated gradients
- replace the trust-led blue system with trend-driven palettes without a brand decision

## 7. Typography

The blueprint materials call for:

- bold but elegant typography
- high readability
- minimal clutter

Repo truth today:

- there is no separate tracked branded type system documented as source-of-truth
- the current product should therefore favour legible, modern UI typography over decorative experimentation

Guidance for now:

- use modern sans-serif presentation
- prioritise readability and hierarchy
- keep headings confident and compact
- avoid overly condensed, gimmicky, or luxury-editorial type unless a future brand refresh explicitly adopts it

This is intentionally conservative because the loose blueprint folder did not provide a clean, implementation-grade font system that should be promoted to canonical status.

## 8. Logo usage

### Canonical tracked logo assets

- light logo: [web/public/logo.svg](/Users/olubusayoadewale/rentnow/web/public/logo.svg)
- dark logo: [web/public/logo-dark.svg](/Users/olubusayoadewale/rentnow/web/public/logo-dark.svg)
- mark only: [web/public/mark.svg](/Users/olubusayoadewale/rentnow/web/public/mark.svg)

### Live usage components

- [web/components/branding/BrandLogo.tsx](/Users/olubusayoadewale/rentnow/web/components/branding/BrandLogo.tsx)
- [web/components/branding/BrandMark.tsx](/Users/olubusayoadewale/rentnow/web/components/branding/BrandMark.tsx)

### Meaning carried by the mark

The recovered blueprint describes the logo concept as combining:

- `P` for PropatyHub
- a house form for property recognition
- a keyhole for trust, access, and security

That meaning is useful and should be preserved in future logo discussions.

### Usage rules

- use the tracked SVG assets, not ad-hoc exported PNGs, whenever possible
- prefer the full logo in navigation, footer, and formal brand surfaces
- use the mark for constrained icon spaces where the wordmark would be too small
- preserve aspect ratio and clear legibility

### Do not

- redraw the mark informally
- swap in loose root-folder PNG variants as canonical assets
- add effects, shadows, droplets, outlines, or decorative overlays not present in the tracked assets

## 9. Icon and app usage

### Canonical tracked app icons

- [web/public/icon-192.png](/Users/olubusayoadewale/rentnow/web/public/icon-192.png)
- [web/public/icon-512.png](/Users/olubusayoadewale/rentnow/web/public/icon-512.png)
- [web/public/icon-192-maskable.png](/Users/olubusayoadewale/rentnow/web/public/icon-192-maskable.png)
- [web/public/icon-512-maskable.png](/Users/olubusayoadewale/rentnow/web/public/icon-512-maskable.png)
- [web/public/apple-touch-icon.png](/Users/olubusayoadewale/rentnow/web/public/apple-touch-icon.png)
- [web/public/favicon.ico](/Users/olubusayoadewale/rentnow/web/public/favicon.ico)

### Manifest reference

- [web/app/manifest.ts](/Users/olubusayoadewale/rentnow/web/app/manifest.ts)

Guidance:

- use the tracked icons for PWA, browser, and share surfaces
- do not promote loose exploratory exports from the old blueprint folder into production use without replacing the tracked assets deliberately

## 10. Imagery and graphic direction

The intended imagery direction is:

- realistic, aspirational property visuals
- human-centred, not sterile
- credible, not fantasy-driven
- clean and premium, not cluttered

Guidance:

- property imagery should support confidence and decision-making
- avoid cliché luxury visuals that make the product feel unrealistic
- avoid cheap flyer-style composition and graphic noise

## 11. Misuse notes

Do not create:

- generic real estate brochure aesthetics
- cliché luxury-property visuals
- tacky flyer-style layouts
- noisy social graphics with too many competing elements
- inconsistent country-specific mini-brands

Do not imply:

- that PropatyHub is a loose, local-only classifieds board
- that the brand is accidental or unfinished

## 12. Source-of-truth boundaries

### Strategic source of truth

- this file
- [docs/brand/README.md](/Users/olubusayoadewale/rentnow/docs/brand/README.md)

### Live asset source of truth

- [web/public/logo.svg](/Users/olubusayoadewale/rentnow/web/public/logo.svg)
- [web/public/logo-dark.svg](/Users/olubusayoadewale/rentnow/web/public/logo-dark.svg)
- [web/public/mark.svg](/Users/olubusayoadewale/rentnow/web/public/mark.svg)
- [web/public/icon-192.png](/Users/olubusayoadewale/rentnow/web/public/icon-192.png)
- [web/public/icon-512.png](/Users/olubusayoadewale/rentnow/web/public/icon-512.png)

### Runtime product brand constants

- [web/lib/brand.ts](/Users/olubusayoadewale/rentnow/web/lib/brand.ts)

### What is not source of truth anymore

- the former root-level `Branding Blueprint/` folder
- duplicate slide exports
- local video exports
- exploratory PNG logo variants

## 13. Folder-resolution decision

Audit result:

- useful source-of-truth brand material:
  - the strategic blueprint text in the two RTF files
- useful reference material:
  - filenames and slide structure from the deck exports
- duplicate or noisy material:
  - repeated `.pptx` / `.pdf` decks
  - raster slide PNG exports
  - duplicated mark/logo PNGs
- not worth tracking as brand source-of-truth:
  - social videos
  - training videos
  - `.DS_Store`

Final decision:

- retain the brand thinking as tracked docs
- retain the existing live brand assets already used by the product
- remove the ambiguous loose root folder from the repo root
- archive the old local files at `.local-work/Branding Blueprint`
- ignore future local-only brand working exports
