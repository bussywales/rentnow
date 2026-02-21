# Property Gallery Experience Roadmap

## Objective
Keep `/properties/[id]` gallery interaction premium and consistent with discovery carousels while preserving booking and page-performance stability.

## Next enhancement (not shipped in this pass)
- Add tap-to-zoom and a dedicated full-screen gallery mode.
- Preserve current thumbnail sync behaviour so slide index stays aligned between inline and full-screen views.
- Keep reduced-motion support in the zoom transition path.

## Constraints for the zoom phase
- No layout shift on entering or leaving full-screen mode.
- Do not break share/save/booking CTAs on the property page.
- Maintain keyboard support: `Escape` exits full-screen and restores focus to the previously focused gallery control.
