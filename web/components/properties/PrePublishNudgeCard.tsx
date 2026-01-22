import { Button } from "@/components/ui/Button";
import type { PrePublishNudgeItem, PrePublishNudgeAction } from "@/lib/properties/prepublish-nudge";

type Props = {
  items: PrePublishNudgeItem[];
  onDismiss: () => void;
  onAction: (action: PrePublishNudgeAction) => void;
};

export function PrePublishNudgeCard({ items, onDismiss, onAction }: Props) {
  if (!items.length) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Before you publish</p>
          <p className="text-xs text-slate-600">Quick wins to make your listing shine.</p>
        </div>
        <button
          type="button"
          className="text-xs font-semibold text-slate-500 hover:text-slate-900"
          onClick={onDismiss}
        >
          Dismiss
        </button>
      </div>
      <div className="mt-3 space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-xs text-slate-700"
          >
            <div>
              <p className="font-semibold text-slate-900">{item.status}</p>
              <p className="text-slate-600">{item.description}</p>
            </div>
            {item.action && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => onAction(item.action!)}
              >
                {item.action === "location" ? "Improve location" : "Review photos"}
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
