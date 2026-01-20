import { z } from "zod";

const CURRENT_YEAR = new Date().getFullYear();

const optionalNumberUnion = (schema: z.ZodTypeAny) =>
  z
    .union([
      z.undefined(),
      z.literal("").transform(() => undefined),
      z.null().transform(() => undefined),
      schema,
    ])
    .optional();

export const optionalPositiveNumber = () =>
  optionalNumberUnion(z.coerce.number().positive());

export const optionalNonnegativeNumber = () =>
  optionalNumberUnion(z.coerce.number().nonnegative());

export const optionalIntNonnegative = () =>
  optionalNumberUnion(z.coerce.number().int().nonnegative());

export const optionalYearBuilt = () =>
  z
    .union([
      z.literal("").transform(() => undefined),
      z.literal(null).transform(() => undefined),
      z.undefined(),
      z
        .coerce.number()
        .int()
        .min(1800, { message: "Year built must be 1800 or later" })
        .max(CURRENT_YEAR + 1),
    ])
    .optional();

export const mapZodErrorToFieldErrors = (
  error: z.ZodError
): Record<string, string> => {
  const flattened = error.flatten().fieldErrors as Record<string, string[] | undefined>;
  const fieldErrors: Record<string, string> = {};
  for (const [field, messages] of Object.entries(flattened)) {
    const first = messages?.find(Boolean);
    if (first) {
      fieldErrors[field] = first;
    }
  }
  return fieldErrors;
};

export function hasPinnedLocation(input: {
  latitude?: number | null;
  longitude?: number | null;
  location_place_id?: string | null;
  location_label?: string | null;
}) {
  const hasLatLng =
    typeof input.latitude === "number" &&
    Number.isFinite(input.latitude) &&
    typeof input.longitude === "number" &&
    Number.isFinite(input.longitude);
  const hasPlace = !!(input.location_place_id && input.location_label);
  return hasLatLng || hasPlace;
}
