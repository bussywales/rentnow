import test from "node:test";
import assert from "node:assert/strict";
import { derivePwaInstallUiState } from "../../lib/pwa/install";

void test("ios hint only appears on iOS when standalone is false and install prompt is unavailable", () => {
  const iosHintState = derivePwaInstallUiState({
    intentTriggered: true,
    state: {
      canInstall: false,
      isInstalled: false,
      isIos: true,
      isStandalone: false,
      dismissedUntilMs: null,
    },
    nowMs: 0,
  });

  assert.equal(iosHintState.showIosHint, true);
  assert.equal(iosHintState.showInstallCta, false);
});

void test("ios hint stays hidden when not iOS or already standalone", () => {
  const nonIos = derivePwaInstallUiState({
    intentTriggered: true,
    state: {
      canInstall: false,
      isInstalled: false,
      isIos: false,
      isStandalone: false,
      dismissedUntilMs: null,
    },
    nowMs: 0,
  });

  const standaloneIos = derivePwaInstallUiState({
    intentTriggered: true,
    state: {
      canInstall: false,
      isInstalled: false,
      isIos: true,
      isStandalone: true,
      dismissedUntilMs: null,
    },
    nowMs: 0,
  });

  assert.equal(nonIos.showIosHint, false);
  assert.equal(standaloneIos.showIosHint, false);
});
