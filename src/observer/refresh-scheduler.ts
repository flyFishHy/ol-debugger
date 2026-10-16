export class RefreshScheduler {
  private handle: number | undefined;
  private microtaskPending = false;
  private disposed = false;

  constructor(private readonly refresh: () => void) {}

  schedule(): void {
    if (this.disposed || this.handle !== undefined || this.microtaskPending) return;
    if (typeof requestAnimationFrame === 'function') {
      this.handle = requestAnimationFrame(() => {
        this.handle = undefined;
        if (!this.disposed) this.refresh();
      });
    } else {
      this.microtaskPending = true;
      queueMicrotask(() => {
        this.microtaskPending = false;
        if (!this.disposed) this.refresh();
      });
    }
  }

  cancel(): void {
    if (this.handle !== undefined && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.handle);
    this.handle = undefined;
    this.microtaskPending = false;
  }

  dispose(): void { this.cancel(); this.disposed = true; }
}
