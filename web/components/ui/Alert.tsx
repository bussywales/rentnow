import { cn } from "@/components/ui/cn";

type AlertProps = {
  title?: string;
  description?: string;
  variant?: "info" | "warning" | "error" | "success";
  onClose?: () => void;
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
  onClose,
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
      <div className="flex items-start gap-3">
        <div className="flex-1">
          {title && <p className="font-semibold">{title}</p>}
          {description && <p className="mt-1 leading-relaxed">{description}</p>}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-sm text-slate-500 hover:bg-white/50"
            aria-label="Close"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
