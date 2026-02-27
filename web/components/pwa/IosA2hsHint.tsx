"use client";

type IosA2hsHintProps = {
  onDismiss: () => void;
};

export function IosA2hsHint({ onDismiss }: IosA2hsHintProps) {
  return (
    <div
      className="rounded-xl border border-slate-200 bg-slate-50 p-3"
      data-testid="pwa-ios-a2hs-hint"
    >
      <p className="text-sm font-semibold text-slate-900">Install app</p>
      <p className="mt-1 text-xs text-slate-600">
        On iPhone/iPad Safari, tap <strong>Share</strong> then{" "}
        <strong>Add to Home Screen</strong> for an app-like experience.
      </p>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300"
          onClick={onDismiss}
          aria-label="Dismiss install hint"
          data-testid="pwa-ios-a2hs-dismiss"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
