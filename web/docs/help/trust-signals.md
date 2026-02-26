# Discovery Trust Signals (v1)

Featured discovery cards now use static trust signals to improve clarity without personal profiling.

## Signals shown

- **Popular**: derived from static catalogue priority or an explicit static badge flag.
- **New**: derived from static catalogue dates (`introducedAt` / `validFrom`) within a fixed window.
- **Verified**: only shown when a static `verificationBasis` is explicitly provided in the catalogue.

## Where these signals appear

- Mobile Home featured strip (`/`)
- Shortlets featured rail (`/shortlets`)
- Properties featured rail (`/properties`)
- Collection cards (`/collections/[shareId]`)
- Saved rail cards (when applicable)

## Market context

Cards can include a subtle market chip (`Picks for {Market}`) based on selected market context.
This is display-only and does not add market query params to destination routes.

## Editorial guardrails

- Do not add personalised or sensitive targeting labels.
- Keep badge assignment deterministic and static.
- If `VERIFIED` is used, include a credible static `verificationBasis` value.

