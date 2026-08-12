/**
 * Game orchestrator: input, simulation clock, and the render loop.
 *
 * Latency decisions worth knowing about:
 *
 * - Input is Pointer Events with `touch-action: none`, not `click`. Pointer
 *   events fire at the same instant as `touchstart` and additionally cover mouse
 *   and pen, so one code path serves every device with no synthetic-click delay.
 * - `getCoalescedEvents()` replays the samples the browser buffered between
 *   frames. On a 120 Hz screen a fast swipe produces several positions per
 *   frame; feeding all of them to the trail is what stops the stroke from
 *   cutting corners.
 * - Everything time-based is driven by the `requestAnimationFrame` timestamp.
 *   No CSS transition is ever read back or relied on for state.
 */

import { getPuzzle } from '../core/levels';
import type { Puzzle } from '../core/types';
import { computeLayout } from './layout';
import type { Layout } from './layout';
import { Particles } from './particles';
import { Renderer } from './render';
import type { ThemeName } from './theme';
import {
  advance,
  clearEvents,
  createEvents,
  createTrail,
  currentNode,
  edgesRemaining,
  isComplete,
  isDeadEnd,
  nodeAt,
  startAt,
  tipPosition,
} from './trail';
import type { Trail, TrailEvents } from './trail';

export type Phase = 'idle' | 'drawing' | 'failed' | 'solved';

export interface GameHooks {
  onPhase(phase: Phase): void;
  onProgress(remaining: number, total: number): void;
  onElapsed(ms: number): void;
  /** Fires only on change: every line out of the current dot is already drawn. */
  onDeadEnd(active: boolean): void;
}

export interface GameOptions {
  canvas: HTMLCanvasElement;
  surface: HTMLElement;
  hooks: GameHooks;
}

/** Failures on one level before we start pointing at the valid opening dots. */
const HINT_AFTER_FAILURES = 3;
/** Levels that always show the hint — the opening move is the tutorial. */
const HINT_UNTIL_LEVEL = 2;

const CELEBRATION_SECONDS = 1.15;
const PULSE_DECAY = 6.5;

const DIRECTION_KEYS: Readonly<Record<string, readonly [number, number]>> = {
  arrowup: [0, -1],
  w: [0, -1],
  arrowdown: [0, 1],
  s: [0, 1],
  arrowleft: [-1, 0],
  a: [-1, 0],
  arrowright: [1, 0],
  d: [1, 0],
  q: [-1, -1],
  e: [1, -1],
  z: [-1, 1],
  c: [1, 1],
};

function vibrate(pattern: number | number[]): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(pattern);
  }
}

export class Game {
  private readonly renderer: Renderer;
  private readonly surface: HTMLElement;
  private readonly hooks: GameHooks;
  private readonly particles = new Particles(220);
  private readonly events: TrailEvents = createEvents();
  private readonly tip = { x: 0, y: 0 };

  private puzzle: Puzzle;
  private layout: Layout;
  private trail: Trail;
  private nodePulse: Float32Array;

  private phase: Phase = 'idle';
  private level = 1;
  private failures = 0;
  private elapsed = 0;
  private timing = false;
  private celebration = 0;
  private clock = 0;
  private deadEnd = false;

  private rafId = 0;
  private lastFrame = 0;
  private pointerId = -1;
  private surfaceRect: DOMRect;

  private keyboardActive = false;
  private focusNode = 0;
  private readonly hintBuffer: number[] = [];

  private reducedMotion = false;
  private readonly resizeObserver: ResizeObserver;

  constructor(options: GameOptions) {
    this.surface = options.surface;
    this.hooks = options.hooks;
    this.renderer = new Renderer(options.canvas);

    this.puzzle = getPuzzle(this.level);
    this.trail = createTrail(this.puzzle);
    this.nodePulse = new Float32Array(this.puzzle.nodes.length);
    this.focusNode = this.puzzle.validStarts[0] ?? 0;
    this.surfaceRect = this.surface.getBoundingClientRect();
    this.layout = this.buildLayout();

    if (typeof matchMedia === 'function') {
      const query = matchMedia('(prefers-reduced-motion: reduce)');
      this.reducedMotion = query.matches;
      query.addEventListener('change', (event) => {
        this.reducedMotion = event.matches;
      });
    }

    this.resizeObserver = new ResizeObserver(() => {
      this.handleResize();
    });
    this.resizeObserver.observe(this.surface);

    this.attachPointer();
    this.attachKeyboard();
  }

  // -- lifecycle -----------------------------------------------------------

  start(): void {
    if (this.rafId !== 0) return;
    this.handleResize();
    this.lastFrame = performance.now();
    this.rafId = requestAnimationFrame(this.frame);
  }

  destroy(): void {
    if (this.rafId !== 0) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    this.resizeObserver.disconnect();
  }

  setTheme(theme: ThemeName): void {
    this.renderer.setTheme(theme);
  }

  get currentLevel(): number {
    return this.level;
  }

  get elapsedMs(): number {
    return this.elapsed;
  }

  get currentPhase(): Phase {
    return this.phase;
  }

  /** Read-only view of the board currently in play. */
  get currentPuzzle(): Puzzle {
    return this.puzzle;
  }

  /** Read-only view of where the dots have landed on screen. */
  get currentLayout(): Readonly<Layout> {
    return this.layout;
  }

  loadLevel(level: number): void {
    this.level = Math.max(1, Math.floor(level));
    this.puzzle = getPuzzle(this.level);
    this.trail = createTrail(this.puzzle);
    this.nodePulse = new Float32Array(this.puzzle.nodes.length);
    this.failures = 0;
    this.focusNode = this.puzzle.validStarts[0] ?? 0;
    this.layout = this.buildLayout();
    this.resetRun();
  }

  /** Same board, clean slate. The fast path players hit over and over. */
  restart(): void {
    this.resetRun();
  }

  private resetRun(): void {
    this.trail = createTrail(this.puzzle);
    this.particles.clear();
    this.nodePulse.fill(0);
    this.elapsed = 0;
    this.timing = false;
    this.celebration = 0;
    this.pointerId = -1;
    this.setPhase('idle');
    this.hooks.onElapsed(0);
    this.hooks.onProgress(this.puzzle.edges.length, this.puzzle.edges.length);
  }

  private setPhase(phase: Phase): void {
    if (this.phase === phase) return;
    this.phase = phase;
    this.hooks.onPhase(phase);
    this.refreshDeadEnd();
  }

  /**
   * Recomputed on every change to the stroke rather than once per frame, so the
   * warning appears on the same input event that caused it instead of up to a
   * frame later.
   */
  private refreshDeadEnd(): void {
    const active = this.phase === 'drawing' && isDeadEnd(this.trail, this.puzzle);
    if (active === this.deadEnd) return;
    this.deadEnd = active;
    this.hooks.onDeadEnd(active);
  }

  // -- layout --------------------------------------------------------------

  private buildLayout(): Layout {
    const width = Math.max(1, this.surfaceRect.width);
    const height = Math.max(1, this.surfaceRect.height);
    const padding = Math.max(30, Math.min(width, height) * 0.1);
    return computeLayout(this.puzzle, width, height, padding);
  }

  private handleResize(): void {
    this.surfaceRect = this.surface.getBoundingClientRect();
    this.layout = this.buildLayout();
    this.renderer.resize(this.surfaceRect.width, this.surfaceRect.height);
  }

  // -- frame loop ----------------------------------------------------------

  private readonly frame = (now: number): void => {
    this.rafId = requestAnimationFrame(this.frame);

    const raw = (now - this.lastFrame) / 1000;
    this.lastFrame = now;
    // Two clamps on purpose: animation stays stable through a hitch, while the
    // stopwatch tolerates a longer stall before it decides the tab was hidden.
    const dtAnimation = Math.min(0.05, Math.max(0, raw));
    const dtTimer = Math.min(0.25, Math.max(0, raw));

    this.update(dtAnimation, dtTimer);
    this.render();
  };

  private update(dtAnimation: number, dtTimer: number): void {
    this.clock += dtAnimation;

    if (this.timing && this.phase === 'drawing') {
      this.elapsed += dtTimer * 1000;
      this.hooks.onElapsed(this.elapsed);
    }

    const decay = Math.exp(-PULSE_DECAY * dtAnimation);
    for (let i = 0; i < this.nodePulse.length; i++) this.nodePulse[i] *= decay;

    this.particles.update(dtAnimation);

    if (this.phase === 'solved' && this.celebration < 1) {
      this.celebration = Math.min(1, this.celebration + dtAnimation / CELEBRATION_SECONDS);
    }
  }

  private render(): void {
    tipPosition(this.trail, this.layout.px, this.layout.py, this.tip);

    this.hintBuffer.length = 0;
    if (this.phase !== 'solved') {
      if (this.trail.nodes.length === 0) {
        if (this.level <= HINT_UNTIL_LEVEL || this.failures >= HINT_AFTER_FAILURES) {
          for (const node of this.puzzle.validStarts) this.hintBuffer.push(node);
        } else if (this.keyboardActive) {
          this.hintBuffer.push(this.focusNode);
        }
      }
    }

    this.renderer.draw({
      puzzle: this.puzzle,
      layout: this.layout,
      trail: this.trail,
      particles: this.particles,
      time: this.clock,
      nodePulse: this.nodePulse,
      hintNodes: this.hintBuffer,
      deadEnd: this.deadEnd,
      celebration: this.phase === 'solved' && this.celebration < 1 ? this.celebration : 0,
      reducedMotion: this.reducedMotion,
      tipX: this.tip.x,
      tipY: this.tip.y,
    });
  }

  // -- pointer -------------------------------------------------------------

  private attachPointer(): void {
    const surface = this.surface;
    surface.style.touchAction = 'none';

    surface.addEventListener('pointerdown', this.onPointerDown, { passive: false });
    surface.addEventListener('pointermove', this.onPointerMove, { passive: false });
    surface.addEventListener('pointerup', this.onPointerUp);
    surface.addEventListener('pointercancel', this.onPointerUp);
    // Losing capture (system gesture, alt-tab) has to count as lifting off,
    // otherwise a run could survive the player leaving the page.
    surface.addEventListener('lostpointercapture', this.onPointerUp);
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (this.phase === 'failed' || this.phase === 'solved') return;
    if (this.pointerId !== -1) return;

    event.preventDefault();
    this.surfaceRect = this.surface.getBoundingClientRect();

    const x = event.clientX - this.surfaceRect.left;
    const y = event.clientY - this.surfaceRect.top;
    const node = nodeAt(this.puzzle, this.layout.px, this.layout.py, x, y, this.layout.hitRadius);
    if (node < 0) return;

    this.pointerId = event.pointerId;
    this.surface.setPointerCapture(event.pointerId);
    this.keyboardActive = false;

    startAt(this.trail, node);
    this.nodePulse[node] = 1;
    this.setPhase('drawing');
    this.hooks.onProgress(this.puzzle.edges.length, this.puzzle.edges.length);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId || this.phase !== 'drawing') return;
    event.preventDefault();

    clearEvents(this.events);
    const samples =
      typeof event.getCoalescedEvents === 'function' ? event.getCoalescedEvents() : [event];
    const left = this.surfaceRect.left;
    const top = this.surfaceRect.top;

    for (const sample of samples) {
      advance(
        this.trail,
        this.puzzle,
        this.layout.px,
        this.layout.py,
        sample.clientX - left,
        sample.clientY - top,
        this.events,
      );
    }

    this.applyTrailEvents();
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId) return;
    this.pointerId = -1;
    if (this.surface.hasPointerCapture(event.pointerId)) {
      this.surface.releasePointerCapture(event.pointerId);
    }
    if (this.phase !== 'drawing') return;

    if (isComplete(this.trail, this.puzzle)) {
      this.solve();
    } else {
      this.fail();
    }
  };

  // -- keyboard ------------------------------------------------------------

  private attachKeyboard(): void {
    this.surface.addEventListener('keydown', this.onKeyDown);
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const key = event.key.toLowerCase();

    if (key === 'r') {
      event.preventDefault();
      this.restart();
      return;
    }
    if (this.phase === 'solved') return;

    if (key === 'backspace') {
      event.preventDefault();
      this.keyboardActive = true;
      this.undoLastEdge();
      return;
    }

    if (key === 'enter' || key === ' ') {
      event.preventDefault();
      this.keyboardActive = true;
      if (this.trail.nodes.length === 0) {
        startAt(this.trail, this.focusNode);
        this.nodePulse[this.focusNode] = 1;
        this.setPhase('drawing');
      }
      return;
    }

    const direction = DIRECTION_KEYS[key];
    if (direction === undefined) return;
    event.preventDefault();
    this.keyboardActive = true;

    if (this.trail.nodes.length === 0) {
      this.moveFocus(direction[0], direction[1]);
      return;
    }
    this.stepInDirection(direction[0], direction[1]);
  };

  private moveFocus(dx: number, dy: number): void {
    const from = this.puzzle.nodes[this.focusNode];
    let best = -1;
    let bestScore = Infinity;
    for (const node of this.puzzle.nodes) {
      if (node.id === this.focusNode) continue;
      const ox = node.gx - from.gx;
      const oy = node.gy - from.gy;
      if (ox * dx + oy * dy <= 0) continue;
      // Prefer the closest dot that lies most squarely in the pressed direction.
      const drift = Math.abs(ox * dy - oy * dx);
      const score = Math.hypot(ox, oy) + drift * 2;
      if (score < bestScore) {
        bestScore = score;
        best = node.id;
      }
    }
    if (best >= 0) this.focusNode = best;
  }

  private stepInDirection(dx: number, dy: number): void {
    const from = currentNode(this.trail);
    if (from < 0) return;

    const origin = this.puzzle.nodes[from];
    const length = Math.hypot(dx, dy);
    let bestEdge = -1;
    let bestTo = -1;
    let bestMatch = 0.7;

    for (const ref of this.puzzle.adjacency[from]) {
      if (this.trail.used[ref.edgeId] === 1) continue;
      const target = this.puzzle.nodes[ref.to];
      const ox = target.gx - origin.gx;
      const oy = target.gy - origin.gy;
      const match = (ox * dx + oy * dy) / (length * Math.hypot(ox, oy));
      if (match > bestMatch) {
        bestMatch = match;
        bestEdge = ref.edgeId;
        bestTo = ref.to;
      }
    }

    if (bestEdge < 0) return;

    this.trail.used[bestEdge] = 1;
    this.trail.nodes.push(bestTo);
    this.trail.edges.push(bestEdge);

    clearEvents(this.events);
    this.events.committed.push(bestEdge);
    this.applyTrailEvents();

    if (isComplete(this.trail, this.puzzle)) this.solve();
  }

  private undoLastEdge(): void {
    if (this.trail.edges.length === 0) return;
    const edge = this.trail.edges.pop();
    this.trail.nodes.pop();
    if (edge !== undefined) this.trail.used[edge] = 0;
    this.hooks.onProgress(edgesRemaining(this.trail, this.puzzle), this.puzzle.edges.length);
    this.refreshDeadEnd();
  }

  // -- shared reactions ----------------------------------------------------

  private applyTrailEvents(): void {
    const node = currentNode(this.trail);

    if (this.events.committed.length > 0) {
      if (!this.timing) {
        // The clock starts on the first real move, not on the first touch, so a
        // moment of hesitation costs nothing.
        this.timing = true;
        this.elapsed = 0;
      }
      if (node >= 0) {
        this.nodePulse[node] = 1;
        if (!this.reducedMotion) {
          this.particles.burst(
            this.layout.px[node],
            this.layout.py[node],
            6,
            this.layout.unit * 1.5,
            0.42,
            this.layout.nodeRadius * 0.85,
            this.clock * 3,
          );
        }
      }
      vibrate(6);
    }

    if (this.events.committed.length > 0 || this.events.undone.length > 0) {
      this.hooks.onProgress(edgesRemaining(this.trail, this.puzzle), this.puzzle.edges.length);
    }

    if (isComplete(this.trail, this.puzzle) && this.phase === 'drawing') {
      // Completing mid-drag ends the run immediately; there is nothing left to
      // draw, so waiting for the finger to lift would only add latency.
      this.solve();
      return;
    }

    this.refreshDeadEnd();
  }

  private solve(): void {
    if (this.phase === 'solved') return;
    this.timing = false;
    this.celebration = 0;
    this.setPhase('solved');
    this.hooks.onElapsed(this.elapsed);

    if (!this.reducedMotion) {
      for (const node of this.trail.nodes) {
        this.particles.burst(
          this.layout.px[node],
          this.layout.py[node],
          4,
          this.layout.unit * 2.1,
          0.75,
          this.layout.nodeRadius,
          node * 0.7,
        );
      }
    }
    vibrate([14, 40, 22]);
  }

  private fail(): void {
    this.failures++;
    this.timing = false;
    this.setPhase('failed');
    vibrate(26);
  }
}
