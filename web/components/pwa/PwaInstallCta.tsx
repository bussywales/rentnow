"use client";

import { useEffect, useState } from "react";
import { IosA2hsHint } from "@/components/pwa/IosA2hsHint";
import {
  derivePwaInstallUiState,
  dismissPwaInstallCta,
  getPwaInstallStateSnapshot,
  promptForPwaInstall,
  startPwaInstallCapture,
  subscribePwaInstallState,
} from "@/lib/pwa/install";

type PwaInstallCtaProps = {
  intentTriggered: boolean;
  className?: string;
};

export function PwaInstallCta({ intentTriggered, className }: PwaInstallCtaProps) {
  const [installState, setInstallState] = useState(getPwaInstallStateSnapshot);
  const [installing, setInstalling] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const cleanup = startPwaInstallCapture(window);
    return cleanup;
  }, []);

  useEffect(() => {
    return subscribePwaInstallState(() => {
      setInstallState(getPwaInstallStateSnapshot());
    });
  }, []);

  const uiState = derivePwaInstallUiState({
    intentTriggered,
    state: installState,
  });

  const handleDismiss = () => {
    dismissPwaInstallCta();
    setConfirmation(null);
  };

  const handleInstall = async () => {
    setInstalling(true);
    setConfirmation(null);
    const outcome = await promptForPwaInstall();
    if (outcome === "accepted") {
      setConfirmation("App installed.");
    } else if (outcome === "dismissed") {
      setConfirmation("Install prompt dismissed.");
    } else {
      setConfirmation("Install not available right now.");
    }
    setInstalling(false);
  };

  if (!uiState.showInstallCta && !uiState.showIosHint && !confirmation) {
    return null;
  }

  return (
    <section className={className} data-testid="pwa-install-cta">
      {uiState.showInstallCta ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm font-semibold text-slate-900">Install app</p>
          <p className="mt-1 text-xs text-slate-600">
            Get faster launches and a full-screen app experience on this device.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800"
              onClick={() => void handleInstall()}
              disabled={installing}
              aria-label="Install app"
              data-testid="pwa-install-action"
            >
              {installing ? "Installing..." : "Install app"}
            </button>
            <button
              type="button"
              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300"
              onClick={handleDismiss}
              aria-label="Dismiss install prompt"
              data-testid="pwa-install-dismiss"
            >
              Not now
            </button>
          </div>
        </div>
      ) : null}

      {uiState.showIosHint ? <IosA2hsHint onDismiss={handleDismiss} /> : null}

      {confirmation ? (
        <p className="mt-2 text-xs text-slate-500" data-testid="pwa-install-feedback">
          {confirmation}
        </p>
      ) : null}
    </section>
  );
}
