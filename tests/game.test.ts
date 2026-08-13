// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findEulerTrail } from '../src/core/graph';
import type { Puzzle } from '../src/core/types';
import { Game } from '../src/game/game';
import type { Phase } from '../src/game/game';
import {
  pointerEvent,
  preparePointerTarget,
  stubAnimationFrame,
  stubCanvas,
  stubMatchMedia,
  stubResizeObserver,
  withEmptyCoalesced,
} from './helpers/browser-stubs';
import type { FramePump, PointerTarget, PointerTargetOptions } from './helpers/browser-stubs';

const WIDTH = 420;
const HEIGHT = 680;
const FRAME_MS = 16;

const DIRECTION_TO_KEY = new Map<string, string>([
  ['0,-1', 'ArrowUp'],
  ['0,1', 'ArrowDown'],
  ['-1,0', 'ArrowLeft'],
  ['1,0', 'ArrowRight'],
  ['-1,-1', 'q'],
  ['1,-1', 'e'],
  ['-1,1', 'z'],
  ['1,1', 'c'],
]);

/** Node ids in the order an Eulerian solution visits them. */
function solutionPath(puzzle: Puzzle, start: number): number[] {
  const edges = findEulerTrail(puzzle.nodes.length, puzzle.edges, start);
  if (edges === null) throw new Error(`level ${puzzle.level} has no solution`);

  const path = [start];
  let node = start;
  for (const edgeId of edges) {
    const edge = puzzle.edges[edgeId];
    node = edge.a === node ? edge.b : edge.a;
    path.push(node);
  }
  return path;
}

interface Harness {
  game: Game;
  surface: HTMLElement;
  pump: FramePump;
  phases: Phase[];
  progress: number[];
  target: PointerTarget;
}

let harness: Harness;

function setup(
  options: PointerTargetOptions = {},
  box: { width: number; height: number } = { width: WIDTH, height: HEIGHT },
): Harness {
  stubResizeObserver();
  stubMatchMedia(false);
  const pump = stubAnimationFrame();

  const surface = document.createElement('div');
  const canvas = document.createElement('canvas');
  surface.append(canvas);
  document.body.append(surface);
  const target = preparePointerTarget(surface, box.width, box.height, options);

  const phases: Phase[] = [];
  const progress: number[] = [];
  const game = new Game({
    canvas,
    surface,
    hooks: {
      onPhase: (phase) => phases.push(phase),
      onProgress: (remaining) => progress.push(remaining),
      onElapsed: () => undefined,
    },
  });
  game.start();

  return { game, surface, pump, phases, progress, target };
}

function press(target: HTMLElement, type: string, x: number, y: number, pointerId = 1): void {
  target.dispatchEvent(pointerEvent(type, x, y, pointerId));
}

/** Tears the current harness down and builds a fresh one under new conditions. */
function remount(
  options: PointerTargetOptions = {},
  box: { width: number; height: number } = { width: WIDTH, height: HEIGHT },
): void {
  harness.game.destroy();
  harness.pump.restore();
  document.body.replaceChildren();
  harness = setup(options, box);
}

/** Plays a level to completion by dragging through a real Eulerian solution. */
function solveWithPointer(state: Harness): void {
  const { game, surface, pump } = state;
  const puzzle = game.currentPuzzle;
  const layout = game.currentLayout;
  const path = solutionPath(puzzle, puzzle.validStarts[0]);

  press(surface, 'pointerdown', layout.px[path[0]], layout.py[path[0]]);
  for (let i = 1; i < path.length; i++) {
    press(surface, 'pointermove', layout.px[path[i]], layout.py[path[i]]);
    pump.advance(FRAME_MS);
  }
  press(surface, 'pointerup', layout.px[path[path.length - 1]], layout.py[path[path.length - 1]]);
}

beforeEach(() => {
  stubCanvas();
  harness = setup();
});

afterEach(() => {
  harness.game.destroy();
  harness.pump.restore();
  document.body.replaceChildren();
});

describe('Game — pointer play', () => {
  it('ignores a touch that lands nowhere near a dot', () => {
    press(harness.surface, 'pointerdown', 3, 3);
    expect(harness.game.currentPhase).toBe('idle');
    expect(harness.phases).toEqual([]);
  });

  it('starts drawing when a dot is touched', () => {
    const layout = harness.game.currentLayout;
    const start = harness.game.currentPuzzle.validStarts[0];
    press(harness.surface, 'pointerdown', layout.px[start], layout.py[start]);
    expect(harness.game.currentPhase).toBe('drawing');
    expect(harness.phases).toEqual(['drawing']);
  });

  it('ignores a second finger while one is already drawing', () => {
    const layout = harness.game.currentLayout;
    const puzzle = harness.game.currentPuzzle;
    const path = solutionPath(puzzle, puzzle.validStarts[0]);

    press(harness.surface, 'pointerdown', layout.px[path[0]], layout.py[path[0]]);
    press(harness.surface, 'pointerdown', layout.px[path[2]], layout.py[path[2]], 2);
    // The second finger must not move the stroke.
    press(harness.surface, 'pointermove', layout.px[path[2]], layout.py[path[2]], 2);
    expect(harness.progress.at(-1)).toBe(puzzle.edges.length);
  });

  it.each([1, 2, 5, 9, 14, 23])('solves level %i by dragging the real solution', (level) => {
    harness.game.loadLevel(level);
    const total = harness.game.currentPuzzle.edges.length;

    solveWithPointer(harness);

    expect(harness.game.currentPhase).toBe('solved');
    expect(harness.progress.at(-1)).toBe(0);
    expect(harness.phases.at(-1)).toBe('solved');
    expect(harness.game.elapsedMs).toBeGreaterThan(0);
    expect(total).toBeGreaterThan(4);
  });

  it('ends the run when the finger lifts early', () => {
    const puzzle = harness.game.currentPuzzle;
    const layout = harness.game.currentLayout;
    const path = solutionPath(puzzle, puzzle.validStarts[0]);

    press(harness.surface, 'pointerdown', layout.px[path[0]], layout.py[path[0]]);
    press(harness.surface, 'pointermove', layout.px[path[1]], layout.py[path[1]]);
    press(harness.surface, 'pointerup', layout.px[path[1]], layout.py[path[1]]);

    expect(harness.game.currentPhase).toBe('failed');
    expect(harness.phases).toEqual(['drawing', 'failed']);
  });

  it('treats a lost pointer capture as lifting off', () => {
    const puzzle = harness.game.currentPuzzle;
    const layout = harness.game.currentLayout;
    const path = solutionPath(puzzle, puzzle.validStarts[0]);

    press(harness.surface, 'pointerdown', layout.px[path[0]], layout.py[path[0]]);
    press(harness.surface, 'pointermove', layout.px[path[1]], layout.py[path[1]]);
    harness.surface.dispatchEvent(pointerEvent('lostpointercapture', 0, 0));

    expect(harness.game.currentPhase).toBe('failed');
  });

  it('restarts to a clean board and a zeroed clock', () => {
    const puzzle = harness.game.currentPuzzle;
    const layout = harness.game.currentLayout;
    const path = solutionPath(puzzle, puzzle.validStarts[0]);

    press(harness.surface, 'pointerdown', layout.px[path[0]], layout.py[path[0]]);
    press(harness.surface, 'pointermove', layout.px[path[1]], layout.py[path[1]]);
    harness.pump.advance(FRAME_MS * 20);
    press(harness.surface, 'pointerup', 0, 0);

    harness.game.restart();
    expect(harness.game.currentPhase).toBe('idle');
    expect(harness.game.elapsedMs).toBe(0);
    expect(harness.progress.at(-1)).toBe(puzzle.edges.length);
  });

  it('does not punish touching a dot and letting go without drawing', () => {
    const layout = harness.game.currentLayout;
    const start = harness.game.currentPuzzle.validStarts[0];

    press(harness.surface, 'pointerdown', layout.px[start], layout.py[start]);
    press(harness.surface, 'pointerup', layout.px[start], layout.py[start]);

    // Exploring where to begin is not a failed run.
    expect(harness.game.currentPhase).toBe('idle');
    expect(harness.phases).toEqual(['drawing', 'idle']);
  });

  it('does not punish dragging every line back off again before letting go', () => {
    const puzzle = harness.game.currentPuzzle;
    const layout = harness.game.currentLayout;
    const path = solutionPath(puzzle, puzzle.validStarts[0]);

    press(harness.surface, 'pointerdown', layout.px[path[0]], layout.py[path[0]]);
    press(harness.surface, 'pointermove', layout.px[path[1]], layout.py[path[1]]);
    expect(harness.progress.at(-1)).toBe(puzzle.edges.length - 1);

    press(harness.surface, 'pointermove', layout.px[path[0]], layout.py[path[0]]);
    expect(harness.progress.at(-1)).toBe(puzzle.edges.length);

    press(harness.surface, 'pointerup', layout.px[path[0]], layout.py[path[0]]);
    expect(harness.game.currentPhase).toBe('idle');
    expect(harness.phases).not.toContain('failed');
  });

  it('reports a full board whenever there is nothing drawn to restart', () => {
    const total = harness.game.currentPuzzle.edges.length;
    const layout = harness.game.currentLayout;
    const path = solutionPath(
      harness.game.currentPuzzle,
      harness.game.currentPuzzle.validStarts[0],
    );

    expect(harness.progress.at(-1)).toBe(total);

    press(harness.surface, 'pointerdown', layout.px[path[0]], layout.py[path[0]]);
    press(harness.surface, 'pointermove', layout.px[path[1]], layout.py[path[1]]);
    expect(harness.progress.at(-1)).toBeLessThan(total);

    harness.game.restart();
    expect(harness.progress.at(-1)).toBe(total);
  });

  it('answers a restart on an untouched board instead of doing nothing', () => {
    const total = harness.game.currentPuzzle.edges.length;
    const before = harness.progress.length;

    harness.game.restart();

    // Nothing was drawn, so no state changes — but the press is still
    // acknowledged, which is what stops the button reading as broken.
    expect(harness.progress.length).toBeGreaterThan(before);
    expect(harness.progress.at(-1)).toBe(total);
    expect(harness.game.currentPhase).toBe('idle');
  });

  it('does not start the clock until the first line is drawn', () => {
    const layout = harness.game.currentLayout;
    const start = harness.game.currentPuzzle.validStarts[0];

    press(harness.surface, 'pointerdown', layout.px[start], layout.py[start]);
    harness.pump.advance(FRAME_MS * 30);
    expect(harness.game.elapsedMs).toBe(0);
  });
});

describe('Game — surviving a hostile browser', () => {
  /**
   * Each of these is an optional platform API failing in a way that used to
   * take the whole game down silently — no error, no visible cause, just a
   * board that stopped responding.
   */

  it('keeps playing when pointer capture is refused', () => {
    remount({ captureThrows: true });

    const puzzle = harness.game.currentPuzzle;
    const layout = harness.game.currentLayout;
    const path = solutionPath(puzzle, puzzle.validStarts[0]);

    press(harness.surface, 'pointerdown', layout.px[path[0]], layout.py[path[0]]);
    expect(harness.game.currentPhase).toBe('drawing');

    press(harness.surface, 'pointermove', layout.px[path[1]], layout.py[path[1]]);
    expect(harness.progress.at(-1)).toBe(puzzle.edges.length - 1);
  });

  it('accepts a new touch after capture was refused, instead of going deaf', () => {
    remount({ captureThrows: true });

    const puzzle = harness.game.currentPuzzle;
    const layout = harness.game.currentLayout;
    const start = puzzle.validStarts[0];

    // The original bug: `pointerId` was claimed before the throwing call, so it
    // was never released and every later touch was ignored as "already drawing".
    press(harness.surface, 'pointerdown', layout.px[start], layout.py[start], 1);
    press(harness.surface, 'pointerup', layout.px[start], layout.py[start], 1);
    expect(harness.game.currentPhase).toBe('idle');

    press(harness.surface, 'pointerdown', layout.px[start], layout.py[start], 2);
    expect(harness.game.currentPhase).toBe('drawing');
  });

  it('still moves the stroke when no coalesced samples are reported', () => {
    const puzzle = harness.game.currentPuzzle;
    const layout = harness.game.currentLayout;
    const path = solutionPath(puzzle, puzzle.validStarts[0]);

    press(harness.surface, 'pointerdown', layout.px[path[0]], layout.py[path[0]]);
    harness.surface.dispatchEvent(
      withEmptyCoalesced(pointerEvent('pointermove', layout.px[path[1]], layout.py[path[1]])),
    );

    // An empty list used to drop the move entirely, so the stroke never
    // followed the finger and the board looked frozen.
    expect(harness.progress.at(-1)).toBe(puzzle.edges.length - 1);
  });

  it('lays the board out again when the page becomes visible', () => {
    // A page that is hidden at load runs no rendering steps, so ResizeObserver
    // never fires and the board keeps its zero size forever.
    remount({}, { width: 0, height: 0 });
    expect(harness.game.currentLayout.width).toBeLessThanOrEqual(1);

    harness.target.resize(WIDTH, HEIGHT);
    document.dispatchEvent(new Event('visibilitychange'));

    expect(harness.game.currentLayout.width).toBe(WIDTH);
    expect(harness.game.currentLayout.height).toBe(HEIGHT);
  });
});

describe('Game — keyboard play', () => {
  function key(name: string): void {
    harness.surface.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));
  }

  it.each([1, 4, 11])('solves level %i with the keyboard', (level) => {
    harness.game.loadLevel(level);
    const puzzle = harness.game.currentPuzzle;
    const path = solutionPath(puzzle, puzzle.validStarts[0]);

    key('Enter');
    expect(harness.game.currentPhase).toBe('drawing');

    for (let i = 1; i < path.length; i++) {
      const from = puzzle.nodes[path[i - 1]];
      const to = puzzle.nodes[path[i]];
      const direction = DIRECTION_TO_KEY.get(`${to.gx - from.gx},${to.gy - from.gy}`);
      expect(direction).toBeDefined();
      key(direction as string);
    }

    expect(harness.game.currentPhase).toBe('solved');
    expect(harness.progress.at(-1)).toBe(0);
  });

  it('undoes the last line with Backspace', () => {
    const puzzle = harness.game.currentPuzzle;
    const path = solutionPath(puzzle, puzzle.validStarts[0]);
    const from = puzzle.nodes[path[0]];
    const to = puzzle.nodes[path[1]];

    key('Enter');
    key(DIRECTION_TO_KEY.get(`${to.gx - from.gx},${to.gy - from.gy}`) as string);
    expect(harness.progress.at(-1)).toBe(puzzle.edges.length - 1);

    key('Backspace');
    expect(harness.progress.at(-1)).toBe(puzzle.edges.length);
  });

  it('restarts on R', () => {
    key('Enter');
    expect(harness.game.currentPhase).toBe('drawing');
    key('r');
    expect(harness.game.currentPhase).toBe('idle');
  });

  it('leaves the page alone for shortcuts with a modifier', () => {
    harness.surface.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'r', ctrlKey: true, bubbles: true }),
    );
    expect(harness.game.currentPhase).toBe('idle');
  });
});
