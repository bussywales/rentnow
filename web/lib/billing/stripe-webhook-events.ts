type WebhookInsertError = { code?: string } | null;

export function parseWebhookInsertError(error: WebhookInsertError) {
  if (!error) return { duplicate: false, error: null };
  if (error.code === "23505") return { duplicate: true, error: null };
  return { duplicate: false, error };
}

export function shouldMarkWebhookProcessed(params: {
  applied: boolean;
  status: string;
  reason: string | null;
}) {
  if (params.applied) return true;
  if (params.status === "ignored" && (params.reason === "manual_override" || params.reason === "duplicate_update")) {
    return true;
  }
  return false;
}
