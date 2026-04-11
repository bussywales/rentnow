export type PropertyPersistenceErrorPayload = {
  error: string;
  code?: string;
  fieldErrors?: Record<string, string>;
};

const INVALID_LISTING_TYPE_MESSAGE = "Choose a valid listing type.";

export function mapPropertyPersistenceError(message?: string | null): PropertyPersistenceErrorPayload {
  const text = typeof message === "string" ? message.trim() : "";

  if (text.includes("properties_listing_type_check")) {
    return {
      error: INVALID_LISTING_TYPE_MESSAGE,
      code: "INVALID_LISTING_TYPE",
      fieldErrors: {
        listing_type: INVALID_LISTING_TYPE_MESSAGE,
      },
    };
  }

  return {
    error: text || "Unable to save listing.",
  };
}
