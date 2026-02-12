import {
  dispatchSavedSearchEmailAlerts,
  type SavedSearchAlertsRunResult,
} from "@/lib/saved-searches/alerts.server";

export async function runSavedSearchEmailAlerts(input?: {
  limit?: number;
  now?: Date;
}): Promise<SavedSearchAlertsRunResult> {
  return dispatchSavedSearchEmailAlerts(input);
}
