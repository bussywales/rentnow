export const FOCUSABLE_SELECTOR =
  "button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex='-1'])";

export function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (node) => !node.hasAttribute("disabled") && node.tabIndex !== -1
  );
}

export function focusFirstTarget(container: HTMLElement | null) {
  if (!container) return;
  const first = getFocusableElements(container)[0];
  (first ?? container).focus();
}

export function trapFocusWithinContainer(event: KeyboardEvent, container: HTMLElement | null): boolean {
  if (event.key !== "Tab") return false;
  if (!container) return false;

  const focusable = getFocusableElements(container);
  if (focusable.length === 0) {
    event.preventDefault();
    container.focus();
    return true;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const activeElement = document.activeElement as HTMLElement | null;
  const containsFocus = activeElement ? container.contains(activeElement) : false;

  if (event.shiftKey) {
    if (!containsFocus || activeElement === first) {
      event.preventDefault();
      last?.focus();
      return true;
    }
    return false;
  }

  if (!containsFocus || activeElement === last) {
    event.preventDefault();
    first?.focus();
    return true;
  }

  return false;
}
