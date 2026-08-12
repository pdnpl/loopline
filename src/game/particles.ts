/**
 * A tiny fixed-capacity particle pool.
 *
 * Flat typed arrays and swap-removal mean the system allocates once at startup
 * and never again, so bursts cannot trigger a GC pause mid-stroke.
 */

export class Particles {
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly vx: Float32Array;
  readonly vy: Float32Array;
  readonly life: Float32Array;
  readonly maxLife: Float32Array;
  readonly size: Float32Array;

  /** Live particles occupy indices `[0, count)`. */
  private liveCount = 0;

  constructor(readonly capacity: number) {
    this.x = new Float32Array(capacity);
    this.y = new Float32Array(capacity);
    this.vx = new Float32Array(capacity);
    this.vy = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.size = new Float32Array(capacity);
  }

  get count(): number {
    return this.liveCount;
  }

  clear(): void {
    this.liveCount = 0;
  }

  /**
   * Radial spray from a point.
   *
   * @param seedAngle offset so consecutive bursts do not look identical.
   */
  burst(
    x: number,
    y: number,
    amount: number,
    speed: number,
    lifeSeconds: number,
    particleSize: number,
    seedAngle: number,
  ): void {
    for (let i = 0; i < amount; i++) {
      if (this.liveCount >= this.capacity) return;
      const index = this.liveCount++;
      const angle = seedAngle + (i / amount) * Math.PI * 2;
      const magnitude = speed * (0.45 + ((i * 0.37) % 1) * 0.75);
      this.x[index] = x;
      this.y[index] = y;
      this.vx[index] = Math.cos(angle) * magnitude;
      this.vy[index] = Math.sin(angle) * magnitude;
      this.life[index] = lifeSeconds;
      this.maxLife[index] = lifeSeconds;
      this.size[index] = particleSize * (0.6 + ((i * 0.61) % 1) * 0.8);
    }
  }

  /** Advances the simulation. `dt` is seconds, taken from the frame clock. */
  update(dt: number): void {
    const drag = Math.exp(-3.4 * dt);
    for (let i = 0; i < this.liveCount; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.swapRemove(i);
        i--;
        continue;
      }
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;
      this.vx[i] *= drag;
      this.vy[i] *= drag;
    }
  }

  private swapRemove(index: number): void {
    const last = --this.liveCount;
    if (index === last) return;
    this.x[index] = this.x[last];
    this.y[index] = this.y[last];
    this.vx[index] = this.vx[last];
    this.vy[index] = this.vy[last];
    this.life[index] = this.life[last];
    this.maxLife[index] = this.maxLife[last];
    this.size[index] = this.size[last];
  }
}
