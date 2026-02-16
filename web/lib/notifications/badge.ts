export type NotificationBadgeRow = {
  is_read?: boolean | null;
};

export function countUnreadNotifications(rows: NotificationBadgeRow[]) {
  return rows.reduce((count, row) => (row.is_read ? count : count + 1), 0);
}

export function resolveUnreadNotificationsCount(
  rows: NotificationBadgeRow[],
  unreadCountFromApi?: number | null
) {
  if (typeof unreadCountFromApi === "number" && Number.isFinite(unreadCountFromApi)) {
    return Math.max(0, Math.trunc(unreadCountFromApi));
  }
  return countUnreadNotifications(rows);
}
