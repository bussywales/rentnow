export const UPDATES_DRAWER_OPEN_EVENT = "ph:updates-drawer-open";
export const UPDATES_DRAWER_CLOSE_EVENT = "ph:updates-drawer-close";
export const HELP_DRAWER_OPEN_EVENT = "ph:help-drawer-open";
export const HELP_DRAWER_CLOSE_EVENT = "ph:help-drawer-close";

export function dispatchOverlayEvent(eventName: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(eventName));
}

export function openProductUpdatesDrawer() {
  dispatchOverlayEvent(UPDATES_DRAWER_OPEN_EVENT);
}

export function closeProductUpdatesDrawer() {
  dispatchOverlayEvent(UPDATES_DRAWER_CLOSE_EVENT);
}

export function openHelpDrawer() {
  dispatchOverlayEvent(HELP_DRAWER_OPEN_EVENT);
}

export function closeHelpDrawer() {
  dispatchOverlayEvent(HELP_DRAWER_CLOSE_EVENT);
}
