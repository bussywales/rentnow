type Props = {
  mode: "test" | "live";
  className?: string;
};

export function PaymentModeBadge({ mode, className }: Props) {
  const isLive = mode === "live";
  const label = isLive ? "LIVE MODE" : "TEST MODE";
  const base =
    "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide";
  const tone = isLive
    ? "bg-emerald-100 text-emerald-700"
    : "bg-amber-100 text-amber-700";
  const combined = [base, tone, className].filter(Boolean).join(" ");

  return <span className={combined}>Payments: {label}</span>;
}
