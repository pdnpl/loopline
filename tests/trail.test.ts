import { beforeEach, describe, expect, it } from 'vitest';
import { buildAdjacency, eulerStartNodes } from '../src/core/graph';
import type { Puzzle } from '../src/core/types';
import {
  advance,
  clearEvents,
  createEvents,
  createTrail,
  currentNode,
  edgesRemaining,
  isComplete,
  nodeAt,
  startAt,
  tipPosition,
} from '../src/game/trail';
import type { Trail, TrailEvents } from '../src/game/trail';

const SCALE = 100;

interface Board {
  puzzle: Puzzle;
  px: Float32Array;
  py: Float32Array;
}

function board(
  cells: ReadonlyArray<readonly [number, number]>,
  pairs: ReadonlyArray<readonly [number, number]>,
): Board {
  const nodes = cells.map(([gx, gy], id) => ({ id, gx, gy }));
  const edges = pairs.map(([a, b], id) => ({ id, a, b }));
  const puzzle: Puzzle = {
    level: 1,
    seed: 0,
    cols: Math.max(...cells.map(([gx]) => gx)) + 1,
    rows: Math.max(...cells.map(([, gy]) => gy)) + 1,
    nodes,
    edges,
    adjacency: buildAdjacency(nodes.length, edges),
    validStarts: eulerStartNodes(nodes.length, edges),
  };
  return {
    puzzle,
    px: Float32Array.from(nodes.map((node) => node.gx * SCALE)),
    py: Float32Array.from(nodes.map((node) => node.gy * SCALE)),
  };
}

/** Triangle: three dots, three edges, every degree even. */
const triangle = (): Board =>
  board(
    [
      [0, 0],
      [1, 0],
      [0, 1],
    ],
    [
      [0, 1],
      [1, 2],
      [2, 0],
    ],
  );

/** A straight run of four dots — used to test fast swipes. */
const line = (): Board =>
  board(
    [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
    ],
    [
      [0, 1],
      [1, 2],
      [2, 3],
    ],
  );

describe('trail', () => {
  let events: TrailEvents;

  beforeEach(() => {
    events = createEvents();
  });

  function move(scene: Board, trail: Trail, x: number, y: number): void {
    clearEvents(events);
    advance(trail, scene.puzzle, scene.px, scene.py, x, y, events);
  }

  it('does nothing before the player touches down', () => {
    const scene = triangle();
    const trail = createTrail(scene.puzzle);
    move(scene, trail, 100, 0);
    expect(trail.nodes).toHaveLength(0);
    expect(events.committed).toEqual([]);
  });

  it('ignores movement inside the deadzone', () => {
    const scene = triangle();
    const trail = createTrail(scene.puzzle);
    startAt(trail, 0);
    move(scene, trail, 4, 2);
    expect(trail.activeEdge).toBe(-1);
    expect(trail.edges).toEqual([]);
  });

  it('tracks the tip part-way along an edge before committing it', () => {
    const scene = triangle();
    const trail = createTrail(scene.puzzle);
    startAt(trail, 0);

    move(scene, trail, 50, 0);
    expect(trail.activeEdge).toBe(0);
    expect(trail.activeProgress).toBeCloseTo(0.5, 5);
    expect(trail.edges).toEqual([]);
    // The edge is reserved while it is being drawn, so it cannot be picked twice.
    expect(trail.used[0]).toBe(1);

    const tip = tipPosition(trail, scene.px, scene.py, { x: 0, y: 0 });
    expect(tip.x).toBeCloseTo(50, 5);
    expect(tip.y).toBeCloseTo(0, 5);
  });

  it('commits an edge once the tip passes the threshold', () => {
    const scene = triangle();
    const trail = createTrail(scene.puzzle);
    startAt(trail, 0);

    move(scene, trail, 95, 0);
    expect(trail.edges).toEqual([0]);
    expect(trail.nodes).toEqual([0, 1]);
    expect(events.committed).toEqual([0]);
    expect(currentNode(trail)).toBe(1);
  });

  it('retracts the last edge when the finger comes back', () => {
    const scene = triangle();
    const trail = createTrail(scene.puzzle);
    startAt(trail, 0);
    move(scene, trail, 95, 0);

    move(scene, trail, 10, 0);
    expect(events.undone).toEqual([0]);
    expect(trail.edges).toEqual([]);
    expect(trail.nodes).toEqual([0]);
    expect(trail.activeEdge).toBe(0);
    expect(trail.activeProgress).toBeCloseTo(0.1, 5);

    move(scene, trail, 0, 0);
    expect(trail.activeEdge).toBe(-1);
    expect(trail.used[0]).toBe(0);
  });

  it('never forks — only the most recent edge can be retracted', () => {
    const scene = line();
    const trail = createTrail(scene.puzzle);
    startAt(trail, 0);
    move(scene, trail, 300, 0);
    expect(trail.edges).toEqual([0, 1, 2]);

    // Dragging back retracts one edge at a time, in order.
    move(scene, trail, 210, 0);
    expect(trail.edges).toEqual([0, 1]);
    expect(trail.activeEdge).toBe(2);
  });

  it('holds steady in the hysteresis band just past a dot', () => {
    const scene = line();
    const trail = createTrail(scene.puzzle);
    startAt(trail, 0);

    move(scene, trail, 95, 0);
    expect(trail.edges).toEqual([0]);

    // Drifting back a little must not undo the edge that just committed,
    // otherwise the stroke flickers on and off around the threshold.
    move(scene, trail, 85, 0);
    expect(trail.edges).toEqual([0]);
    expect(events.undone).toEqual([]);
    expect(trail.activeEdge).toBe(-1);

    // Coming back decisively does retract it.
    move(scene, trail, 70, 0);
    expect(trail.edges).toEqual([]);
    expect(events.undone).toEqual([0]);
  });

  it('chains several edges from a single fast sample', () => {
    const scene = line();
    const trail = createTrail(scene.puzzle);
    startAt(trail, 0);

    move(scene, trail, 300, 0);
    expect(events.committed).toEqual([0, 1, 2]);
    expect(trail.nodes).toEqual([0, 1, 2, 3]);
    expect(isComplete(trail, scene.puzzle)).toBe(true);
    expect(edgesRemaining(trail, scene.puzzle)).toBe(0);
  });

  it('completes a closed circuit', () => {
    const scene = triangle();
    const trail = createTrail(scene.puzzle);
    startAt(trail, 0);

    move(scene, trail, 100, 0);
    move(scene, trail, 0, 100);
    move(scene, trail, 0, 0);

    expect(trail.edges).toEqual([0, 1, 2]);
    expect(isComplete(trail, scene.puzzle)).toBe(true);
  });

  it('ignores directions with no edge behind them', () => {
    const scene = triangle();
    const trail = createTrail(scene.puzzle);
    startAt(trail, 0);

    // Up and to the left of the corner dot — nothing there.
    move(scene, trail, -80, -80);
    expect(trail.activeEdge).toBe(-1);
    expect(trail.edges).toEqual([]);
  });
});

describe('nodeAt', () => {
  it('returns the closest dot inside the radius', () => {
    const scene = triangle();
    expect(nodeAt(scene.puzzle, scene.px, scene.py, 8, 6, 30)).toBe(0);
    expect(nodeAt(scene.puzzle, scene.px, scene.py, 92, 4, 30)).toBe(1);
  });

  it('returns -1 when nothing is close enough', () => {
    const scene = triangle();
    expect(nodeAt(scene.puzzle, scene.px, scene.py, 50, 50, 20)).toBe(-1);
  });
});
