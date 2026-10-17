export class RefreshScheduler {
  private handle: number | undefined;
  private microtaskPending = false;
  private generation = 0;
  private disposed = false;

  constructor(private readonly refresh: () => void) {}

  schedule(): void {
    if (this.disposed || this.handle !== undefined || this.microtaskPending) return;
    const generation = this.generation;
    if (typeof requestAnimationFrame === 'function') {
      this.handle = requestAnimationFrame(() => {
        this.handle = undefined;
        if (!this.disposed && generation === this.generation) this.refresh();
      });
    } else {
      this.microtaskPending = true;
      queueMicrotask(() => {
        this.microtaskPending = false;
        if (!this.disposed && generation === this.generation) this.refresh();
      });
    }
  }

  cancel(): void {
    this.generation += 1;
    if (this.handle !== undefined && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.handle);
    this.handle = undefined;
    this.microtaskPending = false;
  }

  dispose(): void { this.cancel(); this.disposed = true; }
}
