type PropertyCheckinErrorBody = {
  error?: string;
  code?: string;
};

export function resolvePropertyCheckinErrorMessage(status: number, body: unknown) {
  const payload = (body ?? null) as PropertyCheckinErrorBody | null;
  const apiError = typeof payload?.error === "string" ? payload.error.trim() : "";

  if (status === 401) {
    return "Please log in to check in.";
  }

  if (status === 403 && payload?.code === "listing_relation_required") {
    return "You’re signed in, but only the listing owner or a delegated manager can check in here.";
  }

  if (status === 403 && payload?.code === "role_not_allowed") {
    return "Property check-in is available to admins, landlords, and delegated agents.";
  }

  if (status === 503 && payload?.code === "not_configured") {
    return "Property check-in is unavailable right now.";
  }

  if (apiError.length > 0 && apiError !== "Forbidden" && apiError !== "Unauthorized") {
    return apiError;
  }

  return "Couldn’t record check-in. Try again.";
}
