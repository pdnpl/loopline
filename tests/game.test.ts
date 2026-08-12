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
} from './helpers/browser-stubs';
import type { FramePump } from './helpers/browser-stubs';

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
  deadEnds: boolean[];
}

let harness: Harness;

function setup(): Harness {
  stubResizeObserver();
  stubMatchMedia(false);
  const pump = stubAnimationFrame();

  const surface = document.createElement('div');
  const canvas = document.createElement('canvas');
  surface.append(canvas);
  document.body.append(surface);
  preparePointerTarget(surface, WIDTH, HEIGHT);

  const phases: Phase[] = [];
  const progress: number[] = [];
  const deadEnds: boolean[] = [];
  const game = new Game({
    canvas,
    surface,
    hooks: {
      onPhase: (phase) => phases.push(phase),
      onProgress: (remaining) => progress.push(remaining),
      onElapsed: () => undefined,
      onDeadEnd: (active) => deadEnds.push(active),
    },
  });
  game.start();

  return { game, surface, pump, phases, progress, deadEnds };
}

function press(target: HTMLElement, type: string, x: number, y: number, pointerId = 1): void {
  target.dispatchEvent(pointerEvent(type, x, y, pointerId));
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

  it('does not start the clock until the first line is drawn', () => {
    const layout = harness.game.currentLayout;
    const start = harness.game.currentPuzzle.validStarts[0];

    press(harness.surface, 'pointerdown', layout.px[start], layout.py[start]);
    harness.pump.advance(FRAME_MS * 30);
    expect(harness.game.elapsedMs).toBe(0);
  });
});

describe('Game — dead ends', () => {
  /**
   * Loads a level that has at least one dot which is *not* a valid Eulerian
   * start. A board whose degrees are all even has no such dot — every node is a
   * legal opening — so the level is chosen rather than hard-coded, and the
   * search fails loudly instead of silently skipping the assertions.
   */
  function loadLevelWithABadStart(): void {
    for (const level of [3, 4, 5, 6, 7, 8]) {
      harness.game.loadLevel(level);
      const puzzle = harness.game.currentPuzzle;
      if (puzzle.nodes.some((node) => !puzzle.validStarts.includes(node.id))) return;
    }
    throw new Error('no level in 3..8 has a dot that cannot open a solution');
  }

  /**
   * Any maximal walk from a dot that is not a valid Eulerian start must run out
   * of moves before it runs out of lines — that is exactly what "not a valid
   * start" means — so this always reaches a dead end.
   */
  function walkIntoDeadEnd(): void {
    const { game, surface } = harness;
    const puzzle = game.currentPuzzle;
    const layout = game.currentLayout;

    const start = puzzle.nodes.find((node) => !puzzle.validStarts.includes(node.id));
    if (start === undefined) throw new Error('every dot on this board can open a solution');
    const startId = start.id;

    press(surface, 'pointerdown', layout.px[startId], layout.py[startId]);

    const used = new Set<number>();
    let node = startId;
    for (let step = 0; step < puzzle.edges.length; step++) {
      const next = puzzle.adjacency[node].find((ref) => !used.has(ref.edgeId));
      if (next === undefined) return;
      used.add(next.edgeId);
      press(surface, 'pointermove', layout.px[next.to], layout.py[next.to]);
      node = next.to;
    }
  }

  it('reports a dead end without ending the run', () => {
    loadLevelWithABadStart();
    walkIntoDeadEnd();

    expect(harness.deadEnds.at(-1)).toBe(true);
    // A dead end is not a loss: the finger is still down and can drag back.
    expect(harness.game.currentPhase).toBe('drawing');
    expect(harness.progress.at(-1)).toBeGreaterThan(0);
  });

  it('clears the dead end once a line is taken back', () => {
    loadLevelWithABadStart();
    walkIntoDeadEnd();
    expect(harness.deadEnds.at(-1)).toBe(true);

    harness.surface.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }),
    );
    expect(harness.deadEnds.at(-1)).toBe(false);
  });

  it('reports each change once, not once per frame', () => {
    loadLevelWithABadStart();
    walkIntoDeadEnd();
    const seen = harness.deadEnds.length;

    harness.pump.advance(FRAME_MS * 10);
    expect(harness.deadEnds).toHaveLength(seen);
  });

  it('leaves the flag down on a solved board', () => {
    solveWithPointer(harness);
    expect(harness.game.currentPhase).toBe('solved');
    expect(harness.deadEnds.filter(Boolean)).toHaveLength(0);
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
