export function formatRelativeTime(value: string | Date | null | undefined, nowInput: Date = new Date()): string {
  if (!value) return "Just now";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";
  const now = nowInput.getTime();
  const diffMs = date.getTime() - now;
  const diffSeconds = Math.round(diffMs / 1000);

  const divisions: { amount: number; name: Intl.RelativeTimeFormatUnit }[] = [
    { amount: 60, name: "second" },
    { amount: 60, name: "minute" },
    { amount: 24, name: "hour" },
    { amount: 7, name: "day" },
    { amount: 4.34524, name: "week" },
    { amount: 12, name: "month" },
    { amount: Infinity, name: "year" },
  ];

  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  let duration = diffSeconds;
  for (const division of divisions) {
    if (Math.abs(duration) < division.amount) {
      return rtf.format(duration, division.name);
    }
    duration = Math.round(duration / division.amount);
  }
  return rtf.format(duration, "year");
}
