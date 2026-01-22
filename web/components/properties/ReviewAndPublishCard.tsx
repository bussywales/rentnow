import { Button } from "@/components/ui/Button";
import { REVIEW_PUBLISH_COPY } from "@/lib/review-publish-microcopy";
import type { ReviewChecklist, ReviewActionTarget } from "@/lib/properties/review-publish";

type Props = {
  checklist: ReviewChecklist;
  lastUpdatedLabel: string;
  onFix: (target: ReviewActionTarget) => void;
  onDismiss: () => void;
};

export function ReviewAndPublishCard({ checklist, lastUpdatedLabel, onFix, onDismiss }: Props) {
  const readiness = checklist.readiness;

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{REVIEW_PUBLISH_COPY.title}</h3>
          <p className="text-sm text-slate-600">{REVIEW_PUBLISH_COPY.subtitle}</p>
        </div>
        <button
          type="button"
          className="text-xs font-semibold text-slate-500 hover:text-slate-700"
          onClick={onDismiss}
        >
          {REVIEW_PUBLISH_COPY.dismiss}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-700">
        <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-900">
          {REVIEW_PUBLISH_COPY.readinessLabel} {readiness.score} · {readiness.tier}
        </span>
        <span className="text-xs text-slate-500">
          {REVIEW_PUBLISH_COPY.lastUpdatedLabel} {lastUpdatedLabel}
        </span>
      </div>

      {checklist.blocking.length > 0 && (
        <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">{REVIEW_PUBLISH_COPY.requiredTitle}</p>
          <div className="space-y-3">
            {checklist.blocking.map((item) => (
              <div
                key={item.code}
                className="flex flex-col gap-2 rounded-lg bg-white/60 p-3 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-semibold text-amber-900">{item.title}</p>
                  <p className="text-xs text-amber-800">{item.body}</p>
                </div>
                <Button size="sm" onClick={() => onFix(item.actionTarget)}>
                  {item.actionLabel}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {checklist.recommended.length > 0 && (
        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
          <p className="font-semibold text-slate-900">{REVIEW_PUBLISH_COPY.recommendedTitle}</p>
          <div className="space-y-3">
            {checklist.recommended.map((item) => (
              <div
                key={item.code}
                className="flex flex-col gap-2 rounded-lg bg-white p-3 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-semibold text-slate-900">{item.title}</p>
                  <p className="text-xs text-slate-600">{item.body}</p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => onFix(item.actionTarget)}>
                  {item.actionLabel || REVIEW_PUBLISH_COPY.fix}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
