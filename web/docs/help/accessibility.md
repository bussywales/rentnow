# Discovery Accessibility Notes

## Scope

This guide covers tenant discovery UI surfaces:

- mobile quick search sheet
- shortlets and properties filter drawers
- discovery rails and strips (home, shortlets, properties, collections)
- save toggle and continue-browsing controls.

## Interaction standards

- Dialog triggers should expose `aria-expanded`, `aria-controls`, and `aria-haspopup="dialog"`.
- Open drawers/sheets should:
  - close on Escape
  - keep keyboard focus inside while open
  - return focus to the trigger when closed.
- Icon-only actions should include explicit `aria-label` values.

## Rails and motion

- Rails should be labeled as regions/carousels for assistive tech.
- Keyboard users should be able to traverse rail content and use arrow/home/end rail navigation where implemented.
- Respect reduced-motion preferences:
  - avoid forced smooth transitions when `prefers-reduced-motion` is enabled.
