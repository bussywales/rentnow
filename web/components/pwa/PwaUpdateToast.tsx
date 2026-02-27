"use client";

import { useEffect, useState } from "react";
import {
  applyPendingSwUpdate,
  getSwUpdateStateSnapshot,
  subscribeSwUpdateState,
} from "@/lib/pwa/sw-update";

export function PwaUpdateToast() {
  const [state, setState] = useState(getSwUpdateStateSnapshot);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    return subscribeSwUpdateState(() => {
      const next = getSwUpdateStateSnapshot();
      setState(next);
      if (next.updateAvailable) {
        setDismissed(false);
      }
    });
  }, []);

  if (!state.updateAvailable || dismissed) {
    return null;
  }

  return (
    <div
      className="fixed inset-x-3 bottom-4 z-[130] mx-auto max-w-sm rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg"
      role="status"
      aria-live="polite"
      data-testid="pwa-update-toast"
    >
      <div className="flex items-center gap-2">
        <p className="text-xs font-medium text-slate-700">Update available</p>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800"
            onClick={() => applyPendingSwUpdate()}
            aria-label="Refresh app to apply update"
            data-testid="pwa-update-refresh"
          >
            Refresh
          </button>
          <button
            type="button"
            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss update message"
            data-testid="pwa-update-dismiss"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
