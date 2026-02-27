import test from "node:test";
import assert from "node:assert/strict";
import {
  applyPendingSwUpdate,
  createSwUpdateController,
  getSwUpdateStateSnapshot,
  resetSwUpdateStateForTests,
  startSwUpdateCapture,
} from "../../lib/pwa/sw-update";

function createServiceWorkerContainerMock(input: {
  hasController: boolean;
  waitingRegistration?: boolean;
}) {
  const target = new EventTarget();
  const registrationTarget = new EventTarget();

  const registration: ServiceWorkerRegistration = {
    waiting: input.waitingRegistration ? ({} as ServiceWorker) : null,
    installing: null,
    addEventListener: registrationTarget.addEventListener.bind(registrationTarget),
    removeEventListener: registrationTarget.removeEventListener.bind(registrationTarget),
  } as ServiceWorkerRegistration;

  const serviceWorker = {
    controller: input.hasController ? ({} as ServiceWorker) : null,
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    dispatchEvent: target.dispatchEvent.bind(target),
    getRegistration: async () => registration,
  } as unknown as ServiceWorkerContainer;

  return serviceWorker;
}

void test("sw update controller ignores first controllerchange when no existing controller", () => {
  const controller = createSwUpdateController(false);
  assert.equal(controller.shouldFlagControllerChange(), false);
  assert.equal(controller.shouldFlagControllerChange(), true);
});

void test("startSwUpdateCapture marks update available when a waiting worker exists", async () => {
  resetSwUpdateStateForTests();
  const serviceWorker = createServiceWorkerContainerMock({
    hasController: true,
    waitingRegistration: true,
  });

  const cleanup = startSwUpdateCapture(serviceWorker);
  await Promise.resolve();

  assert.equal(getSwUpdateStateSnapshot().updateAvailable, true);
  cleanup();
});

void test("applyPendingSwUpdate calls provided reload callback", () => {
  let called = 0;
  applyPendingSwUpdate(() => {
    called += 1;
  });
  assert.equal(called, 1);
});
