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
    getRegistration: async (_scope: string) => null,
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

  const serviceWorker = {
    getRegistration: async (_scope: string) => existingRegistration,
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

  const result = await registerRootServiceWorker(serviceWorker);
  assert.equal(result, existingRegistration);
  assert.equal(registerCalls, 0);
});
