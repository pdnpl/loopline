/** Maps grid coordinates onto the canvas and scales every visual to the board. */

import type { Puzzle } from '../core/types';

export interface Layout {
  /** Screen x of each node, indexed by node id (CSS pixels). */
  px: Float32Array;
  /** Screen y of each node, indexed by node id (CSS pixels). */
  py: Float32Array;
  /** Distance between two neighbouring grid dots. */
  unit: number;
  nodeRadius: number;
  strokeWidth: number;
  /** How close a touch has to land to count as "on" a dot. */
  hitRadius: number;
  width: number;
  height: number;
}

/**
 * Keeps a small board from ballooning on a desktop monitor — but not so tightly
 * that the puzzle becomes an island. At 132 a 4x4 board filled under a third of
 * the available area on a laptop, which reads as an unfinished screen.
 */
const MAX_UNIT = 190;
const MIN_UNIT = 34;

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function computeLayout(
  puzzle: Puzzle,
  width: number,
  height: number,
  padding: number,
): Layout {
  const spanX = Math.max(1, puzzle.cols - 1);
  const spanY = Math.max(1, puzzle.rows - 1);

  const available = Math.max(0, Math.min(width, height) - padding * 2);
  const unit = clamp(
    Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanY),
    MIN_UNIT,
    Math.max(MIN_UNIT, Math.min(MAX_UNIT, available)),
  );

  const originX = (width - unit * spanX) / 2;
  const originY = (height - unit * spanY) / 2;

  const px = new Float32Array(puzzle.nodes.length);
  const py = new Float32Array(puzzle.nodes.length);
  for (const node of puzzle.nodes) {
    px[node.id] = originX + node.gx * unit;
    py[node.id] = originY + node.gy * unit;
  }

  return {
    px,
    py,
    unit,
    nodeRadius: clamp(unit * 0.085, 4.5, 11),
    strokeWidth: clamp(unit * 0.135, 6, 17),
    // Fitts's law beats geometric precision: a forgiving target is worth more
    // than a pixel-accurate one, especially with a thumb.
    hitRadius: Math.max(unit * 0.45, 28),
    width,
    height,
  };
}
