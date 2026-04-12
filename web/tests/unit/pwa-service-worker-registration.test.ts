import test from "node:test";
import assert from "node:assert/strict";
import {
  registerRootServiceWorker,
  resetRootServiceWorkerRegistrationForTests,
} from "../../lib/pwa/register-service-worker";

void test("registerRootServiceWorker registers /sw.js with root scope", async () => {
  resetRootServiceWorkerRegistrationForTests();
  const calls: Array<{ script: string; options: { scope?: string } | undefined }> = [];
  const registration = { scope: "/" } as ServiceWorkerRegistration;

  const serviceWorker = {
    getRegistration: async () => null,
    register: async (script: string, options?: { scope?: string }) => {
      calls.push({ script, options });
      return registration;
    },
  } satisfies {
    getRegistration: (scope?: string) => Promise<ServiceWorkerRegistration | null>;
    register: (
      script: string,
      options?: { scope?: string }
    ) => Promise<ServiceWorkerRegistration>;
  };

  const result = await registerRootServiceWorker(serviceWorker);
  assert.equal(result, registration);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.script, "/sw.js");
  assert.deepEqual(calls[0]?.options, { scope: "/" });
});

void test("registerRootServiceWorker reuses existing root registration", async () => {
  resetRootServiceWorkerRegistrationForTests();
  const existingRegistration = { scope: "/" } as ServiceWorkerRegistration;
  let registerCalls = 0;
  let updateCalls = 0;

  const serviceWorker = {
    getRegistration: async () => existingRegistration,
    register: async () => {
      registerCalls += 1;
      return existingRegistration;
    },
  } satisfies {
    getRegistration: (scope?: string) => Promise<ServiceWorkerRegistration | null>;
    register: (
      script: string,
      options?: { scope?: string }
    ) => Promise<ServiceWorkerRegistration>;
  };

  (existingRegistration as ServiceWorkerRegistration & { update: () => Promise<void> }).update =
    async () => {
      updateCalls += 1;
    };

  const result = await registerRootServiceWorker(serviceWorker);
  assert.equal(result, existingRegistration);
  assert.equal(registerCalls, 0);
  assert.equal(updateCalls, 1);
});
