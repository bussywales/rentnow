import test from "node:test";
import assert from "node:assert/strict";
import {
  derivePwaInstallUiState,
  dismissPwaInstallCta,
  getPwaInstallIntentFlag,
  getPwaInstallStateSnapshot,
  promptForPwaInstall,
  resetPwaInstallStateForTests,
  setPwaInstallIntentFlag,
  startPwaInstallCapture,
  subscribePwaInstallState,
  type BeforeInstallPromptEvent,
} from "../../lib/pwa/install";

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length() {
    return this.store.size;
  }

  clear() {
    this.store.clear();
  }

  getItem(key: string) {
    return this.store.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.store.delete(key);
  }

  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
}

function createWindowMock(input: { userAgent?: string; standalone?: boolean } = {}) {
  const target = new EventTarget();
  const localStorage = new MemoryStorage();
  const userAgent = input.userAgent ?? "Mozilla/5.0 (Linux; Android 14)";
  const standalone = input.standalone ?? false;

  const win = {
    localStorage,
    navigator: {
      userAgent,
      standalone,
    } as Navigator & { standalone?: boolean },
    matchMedia: () =>
      ({
        matches: false,
        media: "(display-mode: standalone)",
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => true,
      }) as MediaQueryList,
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    dispatchEvent: target.dispatchEvent.bind(target),
  } as unknown as Window;

  return win;
}

void test("beforeinstallprompt capture enables install state and accepted install clears it", async () => {
  resetPwaInstallStateForTests();
  const win = createWindowMock();
  const cleanup = startPwaInstallCapture(win);

  const updates: Array<boolean> = [];
  const unsubscribe = subscribePwaInstallState(() => {
    updates.push(getPwaInstallStateSnapshot().canInstall);
  });

  const event = new Event("beforeinstallprompt", { cancelable: true }) as BeforeInstallPromptEvent;
  let prompted = false;
  event.prompt = async () => {
    prompted = true;
  };
  event.userChoice = Promise.resolve({ outcome: "accepted", platform: "web" });
  win.dispatchEvent(event);

  assert.equal(getPwaInstallStateSnapshot().canInstall, true);

  const outcome = await promptForPwaInstall();
  assert.equal(outcome, "accepted");
  assert.equal(prompted, true);
  assert.equal(getPwaInstallStateSnapshot().canInstall, false);
  assert.ok(updates.length >= 1);

  unsubscribe();
  cleanup();
});

void test("derive install UI state respects dismiss cooldown", () => {
  resetPwaInstallStateForTests();
  const storage = new MemoryStorage();
  dismissPwaInstallCta({ nowMs: 0, cooldownDays: 7, storage });

  const ui = derivePwaInstallUiState({
    intentTriggered: true,
    state: {
      canInstall: true,
      isInstalled: false,
      isIos: false,
      isStandalone: false,
      dismissedUntilMs: Number(storage.getItem("pwa_install_dismissed_until_v1")),
    },
    nowMs: 1,
  });

  assert.equal(ui.dismissed, true);
  assert.equal(ui.showInstallCta, false);
  assert.equal(ui.showIosHint, false);
});

void test("intent flag storage helpers persist and clear", () => {
  resetPwaInstallStateForTests();
  const storage = new MemoryStorage();

  assert.equal(getPwaInstallIntentFlag(storage), false);
  setPwaInstallIntentFlag(true, { storage });
  assert.equal(getPwaInstallIntentFlag(storage), true);
  setPwaInstallIntentFlag(false, { storage });
  assert.equal(getPwaInstallIntentFlag(storage), false);
});
