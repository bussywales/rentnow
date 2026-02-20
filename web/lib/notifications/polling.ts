type SetIntervalFn = typeof setInterval;
type ClearIntervalFn = typeof clearInterval;

export type VisibilityAwarePollController = {
  start: () => void;
  stop: () => void;
  dispose: () => void;
  setEnabled: (enabled: boolean) => void;
  triggerOnce: () => Promise<void>;
  isRunning: () => boolean;
};

type VisibilityAwarePollControllerOptions = {
  intervalMs: number;
  onTick: () => void | Promise<void>;
  isVisible?: () => boolean;
  setIntervalFn?: SetIntervalFn;
  clearIntervalFn?: ClearIntervalFn;
  addVisibilityChangeListener?: (listener: () => void) => () => void;
};

function defaultIsVisible() {
  if (typeof document === "undefined") return true;
  return document.visibilityState === "visible";
}

function defaultAddVisibilityChangeListener(listener: () => void) {
  if (typeof document === "undefined") return () => undefined;
  document.addEventListener("visibilitychange", listener);
  return () => document.removeEventListener("visibilitychange", listener);
}

export function createVisibilityAwarePollController(
  options: VisibilityAwarePollControllerOptions
): VisibilityAwarePollController {
  const intervalMs = Math.max(1000, Math.trunc(options.intervalMs));
  const onTick = options.onTick;
  const isVisible = options.isVisible ?? defaultIsVisible;
  const setIntervalFn = options.setIntervalFn ?? setInterval;
  const clearIntervalFn = options.clearIntervalFn ?? clearInterval;
  const addVisibilityChangeListener =
    options.addVisibilityChangeListener ?? defaultAddVisibilityChangeListener;

  let enabled = false;
  let started = false;
  let timer: ReturnType<SetIntervalFn> | null = null;
  let removeVisibilityListener: (() => void) | null = null;
  let inFlight: Promise<void> | null = null;

  const runTick = () => {
    if (inFlight) return inFlight;
    const result = onTick();
    if (!(result instanceof Promise)) {
      return Promise.resolve();
    }
    const promise = result.finally(() => {
      if (inFlight === promise) inFlight = null;
    });
    inFlight = promise;
    return promise;
  };

  const stopTimer = () => {
    if (!timer) return;
    clearIntervalFn(timer);
    timer = null;
  };

  const startTimerIfNeeded = () => {
    if (!started || !enabled || timer || !isVisible()) return;
    timer = setIntervalFn(() => {
      void runTick().catch(() => undefined);
    }, intervalMs);
  };

  const handleVisibilityChange = () => {
    if (!started) return;
    if (!isVisible()) {
      stopTimer();
      return;
    }
    if (!enabled) return;
    void runTick().catch(() => undefined);
    startTimerIfNeeded();
  };

  return {
    start() {
      if (started) return;
      started = true;
      removeVisibilityListener = addVisibilityChangeListener(handleVisibilityChange);
      startTimerIfNeeded();
    },
    stop() {
      stopTimer();
      if (removeVisibilityListener) {
        removeVisibilityListener();
        removeVisibilityListener = null;
      }
      started = false;
    },
    dispose() {
      this.stop();
    },
    setEnabled(nextEnabled) {
      enabled = nextEnabled;
      if (!started) return;
      if (!enabled) {
        stopTimer();
        return;
      }
      startTimerIfNeeded();
    },
    triggerOnce() {
      return runTick();
    },
    isRunning() {
      return Boolean(timer);
    },
  };
}
