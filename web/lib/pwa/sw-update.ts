export type SwUpdateState = {
  updateAvailable: boolean;
};

let swUpdateState: SwUpdateState = { updateAvailable: false };
let captureStarted = false;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

function setSwUpdateState(next: Partial<SwUpdateState>) {
  swUpdateState = {
    ...swUpdateState,
    ...next,
  };
  notifyListeners();
}

export function getSwUpdateStateSnapshot(): SwUpdateState {
  return swUpdateState;
}

export function subscribeSwUpdateState(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function createSwUpdateController(initialHasController: boolean) {
  let hasController = initialHasController;

  return {
    shouldFlagControllerChange() {
      if (hasController) return true;
      hasController = true;
      return false;
    },
    shouldFlagWaitingUpdate() {
      return hasController;
    },
  };
}

export function applyPendingSwUpdate(reload: () => void = () => window.location.reload()) {
  reload();
}

export function startSwUpdateCapture(serviceWorker: ServiceWorkerContainer) {
  if (captureStarted) {
    return () => undefined;
  }
  captureStarted = true;

  const controller = createSwUpdateController(Boolean(serviceWorker.controller));
  const cleanups: Array<() => void> = [];

  const onControllerChange = () => {
    if (controller.shouldFlagControllerChange()) {
      setSwUpdateState({ updateAvailable: true });
    }
  };

  serviceWorker.addEventListener("controllerchange", onControllerChange);
  cleanups.push(() =>
    serviceWorker.removeEventListener("controllerchange", onControllerChange)
  );

  const bindRegistration = (
    registration: ServiceWorkerRegistration | null | undefined
  ) => {
    if (!registration) return;

    if (registration.waiting && controller.shouldFlagWaitingUpdate()) {
      setSwUpdateState({ updateAvailable: true });
    }

    const onUpdateFound = () => {
      const installing = registration.installing;
      if (!installing) return;

      const onStateChange = () => {
        if (installing.state === "installed" && controller.shouldFlagWaitingUpdate()) {
          setSwUpdateState({ updateAvailable: true });
        }
      };

      installing.addEventListener("statechange", onStateChange);
      cleanups.push(() =>
        installing.removeEventListener("statechange", onStateChange)
      );
    };

    registration.addEventListener("updatefound", onUpdateFound);
    cleanups.push(() =>
      registration.removeEventListener("updatefound", onUpdateFound)
    );
  };

  serviceWorker.getRegistration("/").then(bindRegistration).catch(() => undefined);

  return () => {
    cleanups.forEach((cleanup) => cleanup());
    captureStarted = false;
  };
}

export function resetSwUpdateStateForTests() {
  swUpdateState = { updateAvailable: false };
  captureStarted = false;
  listeners.clear();
}
