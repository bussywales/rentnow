export type AdminUpdatesViewMode = "all" | "admin";

export const ADMIN_UPDATES_VIEW_STORAGE_KEY = "ph_updates_admin_view_mode";

export function readAdminUpdatesViewMode(): AdminUpdatesViewMode {
  if (typeof window === "undefined") return "all";
  const value = window.localStorage.getItem(ADMIN_UPDATES_VIEW_STORAGE_KEY);
  return value === "admin" ? "admin" : "all";
}

export function writeAdminUpdatesViewMode(mode: AdminUpdatesViewMode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ADMIN_UPDATES_VIEW_STORAGE_KEY, mode);
}
