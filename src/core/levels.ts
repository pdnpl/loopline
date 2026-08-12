/**
 * The difficulty curve.
 *
 * Levels are a formula, not a hand-authored list, so the game never runs out.
 * Three dials move together: how many edges to draw, how much board they are
 * spread over, and whether diagonals are in play.
 */

import { generatePuzzle } from './generator';
import type { GeneratorOptions } from './generator';
import type { Puzzle } from './types';

export interface LevelSpec extends GeneratorOptions {
  level: number;
}

/** Level at which diagonal connections join the mix. */
const DIAGONALS_FROM = 7;

/** Board size tiers: `[maxLevel, cols, rows]`, last entry is the ceiling. */
const GRID_TIERS: ReadonlyArray<readonly [number, number, number]> = [
  [3, 3, 3],
  [6, 4, 3],
  [10, 4, 4],
  [15, 5, 4],
  [21, 5, 5],
  [Infinity, 6, 5],
];

export function levelSpec(level: number): LevelSpec {
  const n = Math.max(1, Math.floor(level));

  // One extra edge per level, flattening out at 30 — beyond that a board stops
  // getting harder and just gets tedious.
  const targetEdges = Math.min(30, 4 + n);

  const tier = GRID_TIERS.find(([maxLevel]) => n <= maxLevel) ?? GRID_TIERS[GRID_TIERS.length - 1];

  const minBranchNodes = n <= 2 ? 0 : n <= 5 ? 1 : n <= 12 ? 2 : 3;

  return {
    level: n,
    cols: tier[1],
    rows: tier[2],
    targetEdges,
    allowDiagonals: n >= DIAGONALS_FROM,
    minBranchNodes,
  };
}

const cache = new Map<number, Puzzle>();

/** Board for a level. Generation is deterministic, so the cache is just speed. */
export function getPuzzle(level: number): Puzzle {
  const n = Math.max(1, Math.floor(level));
  const cached = cache.get(n);
  if (cached !== undefined) return cached;

  const spec = levelSpec(n);
  const puzzle = generatePuzzle(n, spec);
  cache.set(n, puzzle);
  return puzzle;
}
