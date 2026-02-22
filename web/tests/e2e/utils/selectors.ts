export const smokeSelectors = {
  shortletsShell: "shortlets-search-shell",
  shortletsStickyPill: "shortlets-compact-search-pill",
  shortletsFiltersButton: "shortlets-filters-button",
  shortletsFiltersDrawer: "shortlets-filters-drawer",
  shortletsMapOpen: "shortlets-open-map",
  shortletsMapClose: "shortlets-map-close",
  shortletsMobileMap: "shortlets-mobile-map",
  shortletsMap: "shortlets-map",
  shortletsSearchThisArea: "shortlets-search-this-area",
  shortletsMapMoveToggle: "shortlets-map-move-toggle",
  shortletBookingWidget: "shortlet-booking-widget",
  shortletCheckInTrigger: "shortlet-checkin-trigger",
  shortletCalendarPopover: "shortlet-calendar-popover",
  shortletCalendarSheet: "shortlet-calendar-sheet",
  shortletCtaPrimary: "shortlet-cta-primary",
  shortletReturnStatus: "shortlet-return-status",
  shortletReturnFinalising: "shortlet-return-finalising",
  shortletReturnConfirmed: "shortlet-return-confirmed",
  shortletReturnPending: "shortlet-return-pending",
  hostBookingsInbox: "host-bookings-inbox",
  hostBookingRow: "host-booking-row",
  hostBookingView: "host-booking-view",
  hostBookingDrawer: "host-booking-drawer",
  hostBookingApprove: "host-booking-approve",
  hostBookingDecline: "host-booking-decline",
  hostCalendarPage: "host-calendar-page",
  hostCalendar: "host-calendar",
  hostCheckinAgenda: "host-checkin-agenda",
} as const;

export function shortletsResultLabelText(total: number, withinMapArea: boolean): RegExp {
  if (withinMapArea) {
    return new RegExp(`${total}\\s+stays?\\s+within\\s+map\\s+area`, "i");
  }
  return new RegExp(`${total}\\s+stays?\\s+found`, "i");
}
