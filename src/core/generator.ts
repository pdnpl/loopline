/**
 * Puzzle generation.
 *
 * Boards are built *by walking a trail*, not by scattering edges and hoping.
 * We start on a random dot and repeatedly step to a neighbour along an edge we
 * have not used yet; the set of edges we walked over is, by construction, a
 * connected graph with a known Eulerian trail. Every generated board is
 * therefore solvable — there is no post-hoc repair step and no unsolvable level
 * can ever ship.
 */

import { buildAdjacency, eulerStartNodes, findEulerTrail, degrees } from './graph';
import { levelSeed, mulberry32, randInt, weightedPick } from './rng';
import type { Puzzle, PuzzleEdge, PuzzleNode } from './types';

export interface GeneratorOptions {
  cols: number;
  rows: number;
  targetEdges: number;
  allowDiagonals: boolean;
  /** Minimum number of dots with 3+ edges. Junctions are what make it a puzzle. */
  minBranchNodes: number;
}

const ORTHOGONAL: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

const DIAGONAL: ReadonlyArray<readonly [number, number]> = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

const MAX_ATTEMPTS = 120;

interface WalkEdge {
  a: number;
  b: number;
}

interface WalkResult {
  edges: WalkEdge[];
}

function edgeKey(a: number, b: number): number {
  return a < b ? a * 100000 + b : b * 100000 + a;
}

/**
 * A diagonal occupies the grid cell identified by its lower-left corner.
 * Allowing only one diagonal per cell keeps the two diagonals of a cell from
 * crossing, which would be both ugly and ambiguous to draw through.
 */
function diagonalCellKey(x1: number, y1: number, x2: number, y2: number): number {
  return Math.min(x1, x2) * 100000 + Math.min(y1, y2);
}

function walk(
  options: GeneratorOptions,
  rng: () => number,
  offsets: ReadonlyArray<readonly [number, number]>,
): WalkResult | null {
  const { cols, rows, targetEdges } = options;
  const usedEdges = new Set<number>();
  const usedDiagonalCells = new Set<number>();
  const edges: WalkEdge[] = [];

  const nodeId = (x: number, y: number): number => y * cols + x;
  const inBounds = (x: number, y: number): boolean => x >= 0 && x < cols && y >= 0 && y < rows;

  interface Step {
    x: number;
    y: number;
    id: number;
    diagonalCell: number;
  }

  const stepsFrom = (x: number, y: number): Step[] => {
    const from = nodeId(x, y);
    const out: Step[] = [];
    for (const [dx, dy] of offsets) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(nx, ny)) continue;

      const to = nodeId(nx, ny);
      if (usedEdges.has(edgeKey(from, to))) continue;

      const isDiagonal = dx !== 0 && dy !== 0;
      const cell = isDiagonal ? diagonalCellKey(x, y, nx, ny) : -1;
      if (isDiagonal && usedDiagonalCells.has(cell)) continue;

      out.push({ x: nx, y: ny, id: to, diagonalCell: cell });
    }
    return out;
  };

  let cx = randInt(rng, 0, cols - 1);
  let cy = randInt(rng, 0, rows - 1);

  while (edges.length < targetEdges) {
    const options_ = stepsFrom(cx, cy);
    if (options_.length === 0) break;

    // Prefer steps that keep the walk alive: a neighbour with more unused exits
    // is less likely to strand us in a dead end before we hit the edge target.
    const weights = options_.map((step) => 1 + stepsFrom(step.x, step.y).length);
    const chosen = weightedPick(rng, options_, weights);

    const from = nodeId(cx, cy);
    usedEdges.add(edgeKey(from, chosen.id));
    if (chosen.diagonalCell >= 0) usedDiagonalCells.add(chosen.diagonalCell);
    edges.push({ a: from, b: chosen.id });

    cx = chosen.x;
    cy = chosen.y;
  }

  if (edges.length < targetEdges) return null;
  return { edges };
}

/** Trims the walked board to its bounding box and renumbers the surviving dots. */
function compact(
  walked: WalkEdge[],
  sourceCols: number,
  level: number,
  seed: number,
): Puzzle | null {
  const touched = new Set<number>();
  for (const edge of walked) {
    touched.add(edge.a);
    touched.add(edge.b);
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const raw of touched) {
    const x = raw % sourceCols;
    const y = Math.floor(raw / sourceCols);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  const cols = maxX - minX + 1;
  const rows = maxY - minY + 1;
  if (cols < 2 || rows < 2) return null;

  // Row-major ordering keeps ids stable and makes debugging boards readable.
  const ordered = [...touched].sort((l, r) => {
    const ly = Math.floor(l / sourceCols);
    const ry = Math.floor(r / sourceCols);
    return ly === ry ? (l % sourceCols) - (r % sourceCols) : ly - ry;
  });

  const remap = new Map<number, number>();
  const nodes: PuzzleNode[] = ordered.map((raw, index) => {
    remap.set(raw, index);
    return {
      id: index,
      gx: (raw % sourceCols) - minX,
      gy: Math.floor(raw / sourceCols) - minY,
    };
  });

  const edges: PuzzleEdge[] = walked.map((edge, index) => ({
    id: index,
    a: remap.get(edge.a) as number,
    b: remap.get(edge.b) as number,
  }));

  const validStarts = eulerStartNodes(nodes.length, edges);
  if (validStarts.length === 0) return null;

  return {
    level,
    seed,
    cols,
    rows,
    nodes,
    edges,
    adjacency: buildAdjacency(nodes.length, edges),
    validStarts,
  };
}

function countBranchNodes(puzzle: Puzzle): number {
  const deg = degrees(puzzle.nodes.length, puzzle.edges);
  let count = 0;
  for (let i = 0; i < deg.length; i++) if (deg[i] >= 3) count++;
  return count;
}

/**
 * Generates the board for a level. Deterministic: the same level number always
 * produces the same board on every device.
 *
 * @throws if no acceptable board could be built — impossible for the shipped
 *   difficulty curve, and covered by tests, but better loud than silently wrong.
 */
export function generatePuzzle(level: number, options: GeneratorOptions): Puzzle {
  const offsets = options.allowDiagonals ? [...ORTHOGONAL, ...DIAGONAL] : ORTHOGONAL;

  // Later attempts relax the edge target rather than give up, so an unlucky
  // seed degrades to a slightly smaller board instead of failing.
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const relaxation = Math.floor(attempt / 30);
    const targetEdges = Math.max(4, options.targetEdges - relaxation);
    const seed = levelSeed(level, attempt);
    const rng = mulberry32(seed);

    const result = walk({ ...options, targetEdges }, rng, offsets);
    if (result === null) continue;

    const puzzle = compact(result.edges, options.cols, level, seed);
    if (puzzle === null) continue;
    if (countBranchNodes(puzzle) < options.minBranchNodes) continue;

    // Belt and braces: the walk guarantees a trail, so this only ever catches
    // a regression in the compaction step.
    if (findEulerTrail(puzzle.nodes.length, puzzle.edges, puzzle.validStarts[0]) === null) continue;

    return puzzle;
  }

  throw new Error(`Could not generate a puzzle for level ${level}`);
}
