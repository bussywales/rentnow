import { sanitizeUserFacingErrorMessage } from "@/lib/observability/user-facing-errors";

export type PropertyPersistenceErrorPayload = {
  error: string;
  code?: string;
  fieldErrors?: Record<string, string>;
};

const INVALID_LISTING_TYPE_MESSAGE = "Choose a valid listing type.";
const LISTING_SAVE_ERROR_MESSAGE =
  "We couldn’t save this listing right now. Try again in a moment.";

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
    error: sanitizeUserFacingErrorMessage(text, LISTING_SAVE_ERROR_MESSAGE),
  };
}
