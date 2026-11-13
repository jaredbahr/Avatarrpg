export type CombatSpeed = 1 | 2 | 3;

/** A scene-owned mapping from monotonic wall time to presentation time. */
export class PresentationClock {
  private wallAnchor: number;
  private presentationAnchor: number;
  private speed: CombatSpeed = 1;
  private paused = false;

  constructor(startAt: number) {
    this.wallAnchor = startAt;
    this.presentationAnchor = startAt;
  }

  now(wallNow: number): number {
    return this.paused
      ? this.presentationAnchor
      : this.presentationAnchor + Math.max(0, wallNow - this.wallAnchor) * this.speed;
  }

  get rate(): CombatSpeed {
    return this.speed;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  setRate(speed: CombatSpeed, wallNow: number): void {
    if (speed === this.speed) return;
    this.presentationAnchor = this.now(wallNow);
    this.wallAnchor = wallNow;
    this.speed = speed;
  }

  pause(wallNow: number): void {
    if (this.paused) return;
    this.presentationAnchor = this.now(wallNow);
    this.wallAnchor = wallNow;
    this.paused = true;
  }

  resume(wallNow: number): void {
    if (!this.paused) return;
    this.wallAnchor = wallNow;
    this.paused = false;
  }

  /** Moves presentation sampling only; the reducer and command queue do not advance. */
  skipTo(presentationTime: number, wallNow: number): void {
    this.presentationAnchor = Math.max(this.now(wallNow), presentationTime);
    this.wallAnchor = wallNow;
  }
}
