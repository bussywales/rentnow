export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function getMotionSafeScrollBehavior(preferred: ScrollBehavior = "smooth"): ScrollBehavior {
  return prefersReducedMotion() ? "auto" : preferred;
}
