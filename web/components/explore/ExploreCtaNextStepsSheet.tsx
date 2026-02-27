"use client";

import { Button } from "@/components/ui/Button";
import { BottomSheet } from "@/components/ui/BottomSheet";

type ExploreCtaNextStepsSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionLabel: "Book" | "Request viewing";
  primaryButtonLabel: string;
  onPrimaryAction: () => void;
  propertyTitle: string;
  requestMessage: string;
  onRequestMessageChange: (value: string) => void;
  onAvailabilityChipClick: (chip: "Weekdays" | "Weekends" | "Evenings") => void;
  requestSubmitting?: boolean;
  requestError?: string | null;
  requestSuccess?: string | null;
};

const REQUEST_AVAILABILITY_CHIPS: Array<"Weekdays" | "Weekends" | "Evenings"> = [
  "Weekdays",
  "Weekends",
  "Evenings",
];

export function ExploreCtaNextStepsSheet({
  open,
  onOpenChange,
  actionLabel,
  primaryButtonLabel,
  onPrimaryAction,
  propertyTitle,
  requestMessage,
  onRequestMessageChange,
  onAvailabilityChipClick,
  requestSubmitting = false,
  requestError = null,
  requestSuccess = null,
}: ExploreCtaNextStepsSheetProps) {
  const isShortletAction = actionLabel === "Book";

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={isShortletAction ? "What happens next" : "Request viewing"}
      description={isShortletAction ? "A quick overview before you continue." : "We will send your request to the host or agent."}
      testId="explore-cta-next-steps-sheet"
      sheetId="explore-cta-next-steps-sheet"
    >
      <div className="space-y-4" data-testid="explore-cta-next-steps-content">
        <ul className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          {isShortletAction ? (
            <>
              <li>Confirm your dates and guest details.</li>
              <li>Review the total and complete secure checkout.</li>
              <li>Host confirmation updates appear in your inbox.</li>
            </>
          ) : (
            <>
              <li>Send your request with a short note.</li>
              <li>Agent confirms a suitable viewing time.</li>
              <li>No obligation until you choose to proceed.</li>
            </>
          )}
        </ul>

        {!isShortletAction ? (
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Prefilled message</p>
            <p className="text-xs text-slate-500">You can edit this before sending for {propertyTitle}.</p>
            <textarea
              value={requestMessage}
              onChange={(event) => onRequestMessageChange(event.target.value)}
              rows={4}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              data-testid="explore-request-message"
              aria-label="Request viewing message"
            />
            <div className="flex flex-wrap gap-2">
              {REQUEST_AVAILABILITY_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => onAvailabilityChipClick(chip)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                  data-testid="explore-request-availability-chip"
                  data-chip={chip}
                >
                  {chip}
                </button>
              ))}
            </div>
            {requestError ? (
              <p className="text-xs text-rose-600" data-testid="explore-request-error" aria-live="polite">
                {requestError}
              </p>
            ) : null}
            {requestSuccess ? (
              <p className="text-xs text-emerald-700" data-testid="explore-request-success" aria-live="polite">
                {requestSuccess}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          <Button
            className="flex-1"
            onClick={onPrimaryAction}
            disabled={requestSubmitting}
            data-testid="explore-cta-next-steps-primary"
          >
            {requestSubmitting ? "Sending..." : primaryButtonLabel}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={requestSubmitting}
            data-testid="explore-cta-next-steps-dismiss"
          >
            Not now
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
