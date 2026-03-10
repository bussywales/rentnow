import test from "node:test";
import assert from "node:assert/strict";
import { fadeAndRemoveStartupShell } from "@/components/layout/AppStartupShellRemover";

function createMockShell() {
  return {
    dataset: {} as Record<string, string | undefined>,
    style: {} as Record<string, string>,
  };
}

void test("fadeAndRemoveStartupShell fades and hides the startup shell", () => {
  const shell = createMockShell();
  let scheduledDelay: number | null = null;
  let scheduledCallback: (() => void) | null = null;

  const started = fadeAndRemoveStartupShell(
    {
      getElementById: (id) => (id === "app-startup-shell" ? (shell as unknown as HTMLElement) : null),
    },
    {
      fadeMs: 170,
      schedule: (callback, delayMs) => {
        scheduledDelay = delayMs;
        scheduledCallback = callback;
        return 1;
      },
    }
  );

  assert.equal(started, true);
  assert.equal(shell.dataset.state, "removing");
  assert.equal(shell.style.opacity, "0");
  assert.equal(shell.style.transform, "translate3d(0, 6px, 0) scale(0.98)");
  assert.equal(shell.style.pointerEvents, "none");
  assert.equal(scheduledDelay, 170);
  assert.equal(shell.dataset.state, "removing");

  assert.ok(scheduledCallback);
  scheduledCallback();
  assert.equal(shell.dataset.state, "removed");
  assert.equal(shell.style.display, "none");
  assert.equal(shell.style.visibility, "hidden");
});

void test("fadeAndRemoveStartupShell does nothing when already removing", () => {
  const shell = createMockShell();
  shell.dataset.state = "removing";
  let scheduled = false;

  const started = fadeAndRemoveStartupShell(
    {
      getElementById: (id) => (id === "app-startup-shell" ? (shell as unknown as HTMLElement) : null),
    },
    {
      schedule: () => {
        scheduled = true;
        return 1;
      },
    }
  );

  assert.equal(started, false);
  assert.equal(scheduled, false);
  assert.equal(shell.dataset.state, "removing");
});
