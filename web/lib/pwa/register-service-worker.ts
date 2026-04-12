export type ServiceWorkerContainerLike = Pick<
  ServiceWorkerContainer,
  "register" | "getRegistration"
>;

let registerPromise: Promise<ServiceWorkerRegistration | undefined> | null = null;

export async function registerRootServiceWorker(
  serviceWorker: ServiceWorkerContainerLike | null | undefined
): Promise<ServiceWorkerRegistration | undefined> {
  if (!serviceWorker) return undefined;
  if (registerPromise) return registerPromise;

  registerPromise = (async () => {
    if (typeof serviceWorker.getRegistration === "function") {
      const existing = await serviceWorker.getRegistration("/");
      if (existing) {
        void existing.update?.().catch(() => undefined);
        return existing;
      }
    }
    return serviceWorker.register("/sw.js", { scope: "/" });
  })().catch((error) => {
    registerPromise = null;
    throw error;
  });

  return registerPromise;
}

export function resetRootServiceWorkerRegistrationForTests() {
  registerPromise = null;
}
