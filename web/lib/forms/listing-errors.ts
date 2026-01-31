const FIELD_LABELS: Record<string, string> = {
  title: "Listing title",
  city: "City",
  rental_type: "Rental type",
  listing_intent: "Listing intent",
  price: "Price",
  currency: "Currency",
  bedrooms: "Bedrooms",
  bathrooms: "Bathrooms",
  size_value: "Size",
  size_unit: "Size unit",
  year_built: "Year built",
  deposit_amount: "Security deposit",
};

export type FieldErrorMap = Record<string, string>;

export function labelForField(key: string): string {
  return FIELD_LABELS[key] ?? key;
}

export function formatListingErrors(
  errors: unknown
): { fieldErrors: FieldErrorMap; order: string[] } {
  const fieldErrors: FieldErrorMap = {};
  const order: string[] = [];
  if (
    errors &&
    typeof errors === "object" &&
    "fieldErrors" in (errors as Record<string, unknown>)
  ) {
    const source = (errors as { fieldErrors?: Record<string, string> }).fieldErrors;
    if (source && typeof source === "object") {
      Object.entries(source).forEach(([key, value]) => {
        const msg = typeof value === "string" ? value : String(value);
        fieldErrors[key] = msg;
        order.push(key);
      });
    }
  }
  return { fieldErrors, order };
}
