type HelpCalloutProps = {
  variant?: "info" | "warn" | "success";
  title: string;
  children: React.ReactNode;
};

const VARIANT_STYLES: Record<NonNullable<HelpCalloutProps["variant"]>, string> = {
  info: "border-slate-200 bg-slate-50 text-slate-700",
  warn: "border-amber-200 bg-amber-50 text-amber-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

export function HelpCallout({ variant = "info", title, children }: HelpCalloutProps) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3 ${VARIANT_STYLES[variant]}`}
      data-testid="help-callout"
    >
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-2 text-sm leading-relaxed">{children}</div>
    </div>
  );
}
