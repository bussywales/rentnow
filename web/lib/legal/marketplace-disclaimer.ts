export const MARKETPLACE_DISCLAIMER_VERSION = "v1";
export const MARKETPLACE_DISCLAIMER_STORAGE_KEY =
  "ph_marketplace_disclaimer_dismissed_version";

type DisclaimerStorage = Pick<Storage, "getItem" | "setItem">;

export function getMarketplaceDisclaimerDismissedVersion(
  storage: DisclaimerStorage | null | undefined
): string | null {
  if (!storage) return null;
  try {
    return storage.getItem(MARKETPLACE_DISCLAIMER_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function shouldRenderMarketplaceDisclaimer(
  dismissedVersion: string | null,
  version: string = MARKETPLACE_DISCLAIMER_VERSION
): boolean {
  return dismissedVersion !== version;
}

export function dismissMarketplaceDisclaimer(
  storage: DisclaimerStorage | null | undefined,
  version: string = MARKETPLACE_DISCLAIMER_VERSION
): void {
  if (!storage) return;
  try {
    storage.setItem(MARKETPLACE_DISCLAIMER_STORAGE_KEY, version);
  } catch {
    // ignore storage write errors and keep banner visible for this session
  }
}

export function isMarketplaceDisclaimerDismissed(
  storage: DisclaimerStorage | null | undefined,
  version: string = MARKETPLACE_DISCLAIMER_VERSION
): boolean {
  return !shouldRenderMarketplaceDisclaimer(
    getMarketplaceDisclaimerDismissedVersion(storage),
    version
  );
}
