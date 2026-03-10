"use client";

import { useEffect } from "react";

const STARTUP_SHELL_ID = "app-startup-shell";
const STARTUP_SHELL_FADE_MS = 160;

type StartupShellDocumentLike = Pick<Document, "getElementById">;
type TimerSchedule = (callback: () => void, delayMs: number) => unknown;

export function fadeAndRemoveStartupShell(
  documentLike: StartupShellDocumentLike | null | undefined,
  input: { fadeMs?: number; schedule?: TimerSchedule } = {}
) {
  const shell = documentLike?.getElementById(STARTUP_SHELL_ID) as HTMLElement | null;
  if (!shell || shell.dataset.state === "removing" || shell.dataset.state === "removed") return false;

  shell.dataset.state = "removing";
  shell.style.opacity = "0";
  shell.style.transform = "translate3d(0, 6px, 0) scale(0.98)";
  shell.style.pointerEvents = "none";

  const fadeMs = input.fadeMs ?? STARTUP_SHELL_FADE_MS;
  const schedule =
    input.schedule ?? ((callback, delayMs) => globalThis.setTimeout(callback, delayMs));

  schedule(() => {
    shell.dataset.state = "removed";
    shell.style.display = "none";
    shell.style.visibility = "hidden";
  }, fadeMs);

  return true;
}

export function AppStartupShellRemover() {
  useEffect(() => {
    fadeAndRemoveStartupShell(typeof document === "undefined" ? null : document);
  }, []);

  return null;
}
