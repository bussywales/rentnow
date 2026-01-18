# Incident: Draft save blocked by NaN from optional numeric fields

**Date:** 2026-01  
**Surface:** Listing wizard (Basics → Details) draft save  
**Symptom:** POST `/api/properties` returned `fieldErrors` like `size_value: "expected number, received NaN"` when optional numeric fields (size, deposit) were left blank. Wizard could not advance from Basics.

## Root cause
Optional numeric fields were coerced with `z.coerce.number()` after `null`/`""` were converted to `NaN`, so Zod rejected drafts that intentionally omitted those fields.

## Fix
- Added empty-safe optional numeric helpers to treat `undefined/null/""` as `undefined` before coercion.
- Draft payload builder now omits optional numerics when empty.

## Prevention
- Unit tests assert optional numeric helpers accept empty inputs and reject invalid non-empty values.
- Regression test parses draft payload with empty numerics to guarantee no NaN errors.

## Rule
Optional numeric fields **must** use the shared empty-safe helpers from `lib/properties/validation.ts`. Never apply raw `z.coerce.number()` to optional fields.
