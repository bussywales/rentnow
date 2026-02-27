export type PushCapabilitySnapshot = {
  supported: boolean;
  serviceWorkerSupported: boolean;
  pushManagerSupported: boolean;
  notificationsSupported: boolean;
  isIos: boolean;
  isStandalone: boolean;
  requiresIosInstall: boolean;
};

type CapabilityInput = {
  userAgent?: string;
  serviceWorkerSupported?: boolean;
  pushManagerSupported?: boolean;
  notificationsSupported?: boolean;
  standalone?: boolean;
};

export function isIosDevice(userAgent: string): boolean {
  const normalized = userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(normalized);
}

export function isStandaloneDisplayMode(input?: {
  standaloneFlag?: boolean;
  matchMedia?: (query: string) => { matches: boolean };
}): boolean {
  const standaloneFlag = input?.standaloneFlag;
  if (standaloneFlag === true) return true;
  const mediaResult = input?.matchMedia?.("(display-mode: standalone)");
  return mediaResult?.matches === true;
}

export function getPushCapabilitySnapshot(
  input: CapabilityInput = {}
): PushCapabilitySnapshot {
  const hasWindow = typeof window !== "undefined";
  const hasNavigator = typeof navigator !== "undefined";

  const userAgent =
    input.userAgent ?? (hasNavigator ? navigator.userAgent || "" : "");

  const serviceWorkerSupported =
    input.serviceWorkerSupported ?? (hasNavigator && "serviceWorker" in navigator);
  const pushManagerSupported =
    input.pushManagerSupported ??
    (typeof globalThis !== "undefined" && "PushManager" in globalThis);
  const notificationsSupported =
    input.notificationsSupported ??
    (typeof globalThis !== "undefined" && "Notification" in globalThis);

  const isStandalone =
    input.standalone ??
    isStandaloneDisplayMode({
      standaloneFlag: hasNavigator
        ? (navigator as Navigator & { standalone?: boolean }).standalone
        : undefined,
      matchMedia: hasWindow ? window.matchMedia.bind(window) : undefined,
    });

  const isIos = isIosDevice(userAgent);
  const supported =
    serviceWorkerSupported && pushManagerSupported && notificationsSupported;

  return {
    supported,
    serviceWorkerSupported,
    pushManagerSupported,
    notificationsSupported,
    isIos,
    isStandalone,
    requiresIosInstall: isIos && !isStandalone,
  };
}
