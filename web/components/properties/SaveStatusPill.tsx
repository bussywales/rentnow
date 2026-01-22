import { SAVE_STATUS_COPY } from "@/lib/properties/save-status-microcopy";
import type { SaveStatus } from "@/lib/properties/save-status";
import { Button } from "@/components/ui/Button";

type Props = {
  status: SaveStatus;
  onRetry?: () => void;
};

const tone: Record<SaveStatus, string> = {
  idle: "text-slate-500",
  saving: "text-slate-600",
  saved: "text-emerald-700",
  error: "text-rose-700",
  submitting: "text-slate-600",
  submitted: "text-emerald-700",
};

export function SaveStatusPill({ status, onRetry }: Props) {
  if (status === "idle") return null;
  const label = SAVE_STATUS_COPY[status as keyof typeof SAVE_STATUS_COPY] || "";
  const isError = status === "error";

  return (
    <div className={`flex items-center gap-3 text-xs ${tone[status]}`}>
      <span>{label}</span>
      {isError && onRetry && (
        <Button size="sm" variant="secondary" onClick={onRetry}>
          {SAVE_STATUS_COPY.retry}
        </Button>
      )}
    </div>
  );
}
