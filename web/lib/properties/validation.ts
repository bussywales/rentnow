import { z } from "zod";

const CURRENT_YEAR = new Date().getFullYear();

const preprocessOptionalNumber = (value: unknown) => {
  if (value === "" || value === null || typeof value === "undefined") {
    return undefined;
  }
  return value;
};

export const optionalPositiveNumber = () =>
  z
    .preprocess(preprocessOptionalNumber, z.coerce.number().positive())
    .optional();

export const optionalNonnegativeNumber = () =>
  z
    .preprocess(preprocessOptionalNumber, z.coerce.number().nonnegative())
    .optional();

export const optionalIntNonnegative = () =>
  z
    .preprocess(preprocessOptionalNumber, z.coerce.number().int().nonnegative())
    .optional();

export const optionalYearBuilt = () =>
  z
    .union([
      z.literal("").transform(() => undefined),
      z.literal(null).transform(() => undefined),
      z.undefined(),
      z.coerce.number().int().min(1800).max(CURRENT_YEAR + 1),
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
