import { isIosDevice, isStandaloneDisplayMode } from "@/lib/pwa/push-capabilities";

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export type PwaInstallState = {
  canInstall: boolean;
  isInstalled: boolean;
  isIos: boolean;
  isStandalone: boolean;
  dismissedUntilMs: number | null;
};

const DISMISS_KEY = "pwa_install_dismissed_until_v1";
const INTENT_KEY = "pwa_install_intent_tenant_v1";
const DEFAULT_DISMISS_DAYS = 7;

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let captureStarted = false;

let installState: PwaInstallState = {
  canInstall: false,
  isInstalled: false,
  isIos: false,
  isStandalone: false,
  dismissedUntilMs: null,
};

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

function setInstallState(next: Partial<PwaInstallState>) {
  installState = {
    ...installState,
    ...next,
  };
  notifyListeners();
}

function readDismissedUntilFromStorage(storage: Storage | null | undefined) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(DISMISS_KEY);
    if (!raw) return null;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeDismissedUntilToStorage(
  storage: Storage | null | undefined,
  dismissedUntilMs: number | null
) {
  if (!storage) return;
  try {
    if (!dismissedUntilMs) {
      storage.removeItem(DISMISS_KEY);
      return;
    }
    storage.setItem(DISMISS_KEY, String(dismissedUntilMs));
  } catch {
    // Ignore storage failures.
  }
}

function readIntentFromStorage(storage: Storage | null | undefined) {
  if (!storage) return false;
  try {
    return storage.getItem(INTENT_KEY) === "1";
  } catch {
    return false;
  }
}

function writeIntentToStorage(storage: Storage | null | undefined, value: boolean) {
  if (!storage) return;
  try {
    if (value) {
      storage.setItem(INTENT_KEY, "1");
    } else {
      storage.removeItem(INTENT_KEY);
    }
  } catch {
    // Ignore storage failures.
  }
}

function computePlatformInstallState(win: Window) {
  const ua = win.navigator?.userAgent ?? "";
  const isIos = isIosDevice(ua);
  const isStandalone = isStandaloneDisplayMode({
    standaloneFlag: (win.navigator as Navigator & { standalone?: boolean }).standalone,
    matchMedia: win.matchMedia.bind(win),
  });

  return { isIos, isStandalone };
}

function syncDismissedFromStorage(storage: Storage | null | undefined) {
  const dismissedUntilMs = readDismissedUntilFromStorage(storage);
  setInstallState({ dismissedUntilMs });
}

export function getPwaInstallStateSnapshot(): PwaInstallState {
  return installState;
}

export function subscribePwaInstallState(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isPwaInstallDismissed(
  dismissedUntilMs: number | null,
  nowMs: number = Date.now()
) {
  return Number.isFinite(dismissedUntilMs ?? NaN) && Number(dismissedUntilMs) > nowMs;
}

export function dismissPwaInstallCta(
  input: {
    nowMs?: number;
    cooldownDays?: number;
    storage?: Storage | null;
  } = {}
) {
  const nowMs = input.nowMs ?? Date.now();
  const cooldownDays = input.cooldownDays ?? DEFAULT_DISMISS_DAYS;
  const dismissedUntilMs = nowMs + cooldownDays * 24 * 60 * 60 * 1000;
  writeDismissedUntilToStorage(
    input.storage ?? (typeof window !== "undefined" ? window.localStorage : null),
    dismissedUntilMs
  );
  setInstallState({ dismissedUntilMs });
}

export function clearPwaInstallDismissal(storage?: Storage | null) {
  writeDismissedUntilToStorage(
    storage ?? (typeof window !== "undefined" ? window.localStorage : null),
    null
  );
  setInstallState({ dismissedUntilMs: null });
}

export function getPwaInstallIntentFlag(storage?: Storage | null) {
  return readIntentFromStorage(
    storage ?? (typeof window !== "undefined" ? window.localStorage : null)
  );
}

export function setPwaInstallIntentFlag(
  value: boolean,
  input: { storage?: Storage | null } = {}
) {
  writeIntentToStorage(
    input.storage ?? (typeof window !== "undefined" ? window.localStorage : null),
    value
  );
}

export function derivePwaInstallUiState(input: {
  intentTriggered: boolean;
  state: PwaInstallState;
  nowMs?: number;
}) {
  const nowMs = input.nowMs ?? Date.now();
  const dismissed = isPwaInstallDismissed(input.state.dismissedUntilMs, nowMs);
  const baseEligible =
    input.intentTriggered && !input.state.isInstalled && !input.state.isStandalone && !dismissed;

  return {
    showInstallCta: baseEligible && input.state.canInstall,
    showIosHint: baseEligible && input.state.isIos && !input.state.canInstall,
    dismissed,
  };
}

export async function promptForPwaInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferredPrompt) return "unavailable";

  const prompt = deferredPrompt;
  deferredPrompt = null;

  await prompt.prompt();
  const choice = await prompt.userChoice;

  if (choice.outcome === "accepted") {
    setInstallState({ canInstall: false, dismissedUntilMs: null });
    return "accepted";
  }

  dismissPwaInstallCta();
  setInstallState({ canInstall: false });
  return "dismissed";
}

export function startPwaInstallCapture(win: Window) {
  if (captureStarted) {
    return () => undefined;
  }
  captureStarted = true;

  const storage = win.localStorage;
  const platform = computePlatformInstallState(win);
  installState = {
    ...installState,
    ...platform,
  };
  syncDismissedFromStorage(storage);

  const onBeforeInstallPrompt = (event: Event) => {
    const promptEvent = event as BeforeInstallPromptEvent;
    event.preventDefault();
    deferredPrompt = promptEvent;
    setInstallState({ canInstall: true });
  };

  const onAppInstalled = () => {
    deferredPrompt = null;
    clearPwaInstallDismissal(storage);
    setInstallState({ isInstalled: true, canInstall: false });
  };

  const onVisibilityChange = () => {
    const latestPlatform = computePlatformInstallState(win);
    setInstallState(latestPlatform);
    syncDismissedFromStorage(storage);
  };

  win.addEventListener("beforeinstallprompt", onBeforeInstallPrompt as EventListener);
  win.addEventListener("appinstalled", onAppInstalled);
  win.addEventListener("visibilitychange", onVisibilityChange);

  return () => {
    win.removeEventListener(
      "beforeinstallprompt",
      onBeforeInstallPrompt as EventListener
    );
    win.removeEventListener("appinstalled", onAppInstalled);
    win.removeEventListener("visibilitychange", onVisibilityChange);
    captureStarted = false;
  };
}

export function resetPwaInstallStateForTests() {
  deferredPrompt = null;
  captureStarted = false;
  installState = {
    canInstall: false,
    isInstalled: false,
    isIos: false,
    isStandalone: false,
    dismissedUntilMs: null,
  };
  listeners.clear();
}
