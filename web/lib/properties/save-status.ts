export type SaveStatus = "idle" | "saving" | "saved" | "error" | "submitting" | "submitted";

type Scheduler = {
  schedule: (fn: () => void, ms: number) => unknown;
  clear: (id: unknown) => void;
};

export class SaveStatusManager {
  private status: SaveStatus = "idle";
  private onChange: (status: SaveStatus) => void;
  private scheduler: Scheduler;
  private showSavingTimer: unknown | null = null;
  private holdTimer: unknown | null = null;
  private retryFn: (() => void) | null = null;

  constructor(onChange: (status: SaveStatus) => void, scheduler?: Scheduler) {
    this.onChange = onChange;
    this.scheduler = scheduler ?? {
      schedule: (fn, ms) => setTimeout(fn, ms),
      clear: (id) => clearTimeout(id as number),
    };
  }

  get current() {
    return this.status;
  }

  get retry() {
    return this.retryFn;
  }

  reset() {
    this.clearTimers();
    this.retryFn = null;
    this.setStatus("idle");
  }

  setSaving(retry?: () => void) {
    this.retryFn = retry ?? null;
    this.clearTimers();
    this.showSavingTimer = this.scheduler.schedule(() => {
      this.setStatus("saving");
    }, 300);
  }

  setSaved() {
    this.retryFn = null;
    if (this.showSavingTimer) {
      this.scheduler.clear(this.showSavingTimer);
      this.showSavingTimer = null;
    }
    this.setStatus("saved");
    this.holdTimer = this.scheduler.schedule(() => {
      this.setStatus("idle");
    }, 1500);
  }

  setError(retry?: () => void) {
    this.retryFn = retry ?? null;
    this.clearTimers();
    this.setStatus("error");
  }

  setSubmitting() {
    this.retryFn = null;
    this.clearTimers();
    this.setStatus("submitting");
  }

  setSubmitted() {
    this.retryFn = null;
    this.clearTimers();
    this.setStatus("submitted");
    this.holdTimer = this.scheduler.schedule(() => {
      this.setStatus("idle");
    }, 1500);
  }

  triggerRetry() {
    if (this.retryFn) {
      this.retryFn();
    }
  }

  private setStatus(next: SaveStatus) {
    this.status = next;
    this.onChange(next);
  }

  private clearTimers() {
    if (this.showSavingTimer) {
      this.scheduler.clear(this.showSavingTimer);
      this.showSavingTimer = null;
    }
    if (this.holdTimer) {
      this.scheduler.clear(this.holdTimer);
      this.holdTimer = null;
    }
  }
}
