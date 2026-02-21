export const DRAG_DISTANCE_PX = 8;
export const WHEEL_THROTTLE_MS = 160;
export const HORIZONTAL_WHEEL_THRESHOLD_PX = 6;
export const HORIZONTAL_VS_VERTICAL_RATIO = 1.2;
export const WHEEL_GESTURE_IDLE_RESET_MS = 220;

export type CarouselWheelInput = {
  deltaX: number;
  deltaY: number;
  shiftKey?: boolean;
};

export type CarouselWheelDirection = "next" | "prev";

export function shouldSuppressCarouselClickAfterDrag(pointerDistancePx: number): boolean {
  return pointerDistancePx > DRAG_DISTANCE_PX;
}

export function resolveWheelDelta(input: CarouselWheelInput): number {
  const horizontalFromTrackpad = Number.isFinite(input.deltaX) ? input.deltaX : 0;
  const horizontalFromShiftScroll =
    input.shiftKey && Number.isFinite(input.deltaY) ? input.deltaY : 0;

  if (Math.abs(horizontalFromShiftScroll) > Math.abs(horizontalFromTrackpad)) {
    return horizontalFromShiftScroll;
  }

  return horizontalFromTrackpad;
}

export function shouldTreatWheelAsHorizontal(input: CarouselWheelInput): boolean {
  const horizontalDelta = resolveWheelDelta(input);
  const horizontalMagnitude = Math.abs(horizontalDelta);
  const verticalMagnitude = Number.isFinite(input.deltaY) ? Math.abs(input.deltaY) : 0;

  if (input.shiftKey) {
    return verticalMagnitude >= HORIZONTAL_WHEEL_THRESHOLD_PX;
  }

  return (
    horizontalMagnitude >= HORIZONTAL_WHEEL_THRESHOLD_PX ||
    horizontalMagnitude >= verticalMagnitude * HORIZONTAL_VS_VERTICAL_RATIO
  );
}

export function resolveWheelDirection(input: CarouselWheelInput): CarouselWheelDirection | null {
  const horizontalDelta = resolveWheelDelta(input);
  if (Math.abs(horizontalDelta) < HORIZONTAL_WHEEL_THRESHOLD_PX) return null;
  if (horizontalDelta > 0) return "next";
  if (horizontalDelta < 0) return "prev";
  return null;
}

export function resolveWheelDirectionFromAccumulatedDelta(
  accumulatedDelta: number
): CarouselWheelDirection | null {
  if (accumulatedDelta > HORIZONTAL_WHEEL_THRESHOLD_PX) return "next";
  if (accumulatedDelta < -HORIZONTAL_WHEEL_THRESHOLD_PX) return "prev";
  return null;
}

export function shouldThrottleWheelNavigation(input: {
  nowMs: number;
  lastTriggeredAtMs: number;
  nextDirection: CarouselWheelDirection;
  lastDirection: CarouselWheelDirection | null;
  throttleMs?: number;
}): boolean {
  const throttleMs = input.throttleMs ?? WHEEL_THROTTLE_MS;
  const withinCooldown = input.nowMs - input.lastTriggeredAtMs < throttleMs;
  if (!withinCooldown) return false;
  return input.nextDirection === input.lastDirection;
}

export function applyInertialSnapHint(input: {
  enabled: boolean;
  isActive: boolean;
  reducedMotion?: boolean;
}): string {
  if (!input.enabled || input.reducedMotion) return "";
  if (input.isActive) return "scale-[1.005] opacity-100";
  return "scale-[0.995] opacity-95";
}
