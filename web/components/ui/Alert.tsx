import { cn } from "@/components/ui/cn";

type AlertProps = {
  title?: string;
  description?: string;
  variant?: "info" | "warning" | "error" | "success";
  className?: string;
};

const variantStyles: Record<NonNullable<AlertProps["variant"]>, string> = {
  info: "bg-sky-50 text-sky-900 border-sky-200",
  warning: "bg-amber-50 text-amber-900 border-amber-200",
  error: "bg-rose-50 text-rose-900 border-rose-200",
  success: "bg-emerald-50 text-emerald-900 border-emerald-200",
};

export function Alert({
  title,
  description,
  variant = "info",
  className,
}: AlertProps) {
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 text-sm shadow-sm",
        variantStyles[variant],
        className
      )}
    >
      {title && <p className="font-semibold">{title}</p>}
      {description && <p className="mt-1 leading-relaxed">{description}</p>}
    </div>
  );
}
