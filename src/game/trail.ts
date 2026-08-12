/**
 * The stroke the player is drawing.
 *
 * Deliberately free of DOM and canvas so the whole interaction model can be
 * unit tested by feeding it pointer coordinates.
 *
 * The tip follows the finger *along an edge* rather than snapping between dots:
 * the pointer is projected onto the candidate edge and the edge is committed
 * once the projection passes `COMMIT_AT`. Dragging back retracts the same way,
 * which is what makes an undo possible without ever lifting the finger.
 */

import type { Puzzle, Vec2 } from '../core/types';

export interface Trail {
  /** Dots visited so far, in order. Empty until the player touches down. */
  nodes: number[];
  /** Committed edge ids. Always `nodes.length - 1` entries. */
  edges: number[];
  /** `1` when the edge is committed *or* currently being drawn. */
  used: Uint8Array;
  /** Edge being drawn right now, or `-1`. */
  activeEdge: number;
  /** Far end of the active edge. */
  activeTo: number;
  /** How far along the active edge the tip sits, `0..1`. */
  activeProgress: number;
}

export interface TrailEvents {
  /** Edges that joined the stroke during this update. */
  committed: number[];
  /** Edges that left the stroke during this update. */
  undone: number[];
}

/** Fraction of an edge the tip must pass before the edge counts as drawn. */
export const COMMIT_AT = 0.88;
/**
 * How far back down an edge the finger must come before it is retracted.
 *
 * The gap between this and `COMMIT_AT` is deliberate hysteresis. Without it, a
 * finger resting just short of a dot would sit exactly on the boundary — the
 * edge commits, the pointer is now "behind" the new dot, the retract rule fires,
 * and the stroke flickers between the two states every frame.
 */
export const UNDO_AT = 0.78;
/** Below this the edge is let go, so a small wobble does not lock you in. */
export const RELEASE_AT = 0.04;
/** Direction tolerance when choosing an edge — about 70 degrees either side. */
export const MIN_DIRECTION_MATCH = 0.35;
/** Pointer travel (px) before we start looking for an edge at all. */
export const DIRECTION_DEADZONE = 7;

/** Safety net: one pointer sample can chain several edges, but not forever. */
const MAX_STEPS_PER_SAMPLE = 12;

export function createTrail(puzzle: Puzzle): Trail {
  return {
    nodes: [],
    edges: [],
    used: new Uint8Array(puzzle.edges.length),
    activeEdge: -1,
    activeTo: -1,
    activeProgress: 0,
  };
}

export function resetTrail(trail: Trail): void {
  trail.nodes.length = 0;
  trail.edges.length = 0;
  trail.used.fill(0);
  trail.activeEdge = -1;
  trail.activeTo = -1;
  trail.activeProgress = 0;
}

export function createEvents(): TrailEvents {
  return { committed: [], undone: [] };
}

export function clearEvents(events: TrailEvents): void {
  events.committed.length = 0;
  events.undone.length = 0;
}

export function hasStarted(trail: Trail): boolean {
  return trail.nodes.length > 0;
}

export function isComplete(trail: Trail, puzzle: Puzzle): boolean {
  return trail.edges.length === puzzle.edges.length;
}

export function edgesRemaining(trail: Trail, puzzle: Puzzle): number {
  return puzzle.edges.length - trail.edges.length;
}

export function currentNode(trail: Trail): number {
  return trail.nodes.length === 0 ? -1 : trail.nodes[trail.nodes.length - 1];
}

/** True when no undrawn edge leaves the current dot — the player must back up. */
export function isDeadEnd(trail: Trail, puzzle: Puzzle): boolean {
  const node = currentNode(trail);
  if (node < 0) return false;
  for (const ref of puzzle.adjacency[node]) {
    if (trail.used[ref.edgeId] === 0) return false;
  }
  return true;
}

/** Nearest dot to a point, or `-1` when nothing is within `radius`. */
export function nodeAt(
  puzzle: Puzzle,
  px: Float32Array,
  py: Float32Array,
  x: number,
  y: number,
  radius: number,
): number {
  let best = -1;
  let bestDistance = radius * radius;
  for (const node of puzzle.nodes) {
    const dx = px[node.id] - x;
    const dy = py[node.id] - y;
    const distance = dx * dx + dy * dy;
    if (distance <= bestDistance) {
      bestDistance = distance;
      best = node.id;
    }
  }
  return best;
}

export function startAt(trail: Trail, node: number): void {
  resetTrail(trail);
  trail.nodes.push(node);
}

/** Where the visible end of the stroke currently sits. */
export function tipPosition(trail: Trail, px: Float32Array, py: Float32Array, out: Vec2): Vec2 {
  const node = currentNode(trail);
  if (node < 0) {
    out.x = 0;
    out.y = 0;
    return out;
  }
  if (trail.activeEdge < 0) {
    out.x = px[node];
    out.y = py[node];
    return out;
  }
  out.x = px[node] + (px[trail.activeTo] - px[node]) * trail.activeProgress;
  out.y = py[node] + (py[trail.activeTo] - py[node]) * trail.activeProgress;
  return out;
}

/** Clamped projection of a point onto a segment, expressed as `0..1` along it. */
function projectOnSegment(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  x: number,
  y: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return 0;
  const t = ((x - ax) * dx + (y - ay) * dy) / lengthSquared;
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/**
 * Moves the stroke to follow a pointer sample. Mutates `trail` and appends to
 * `events`; the caller clears `events` once per frame.
 */
export function advance(
  trail: Trail,
  puzzle: Puzzle,
  px: Float32Array,
  py: Float32Array,
  pointerX: number,
  pointerY: number,
  events: TrailEvents,
): void {
  if (trail.nodes.length === 0) return;

  for (let step = 0; step < MAX_STEPS_PER_SAMPLE; step++) {
    const from = currentNode(trail);

    if (trail.activeEdge >= 0) {
      const t = projectOnSegment(
        px[from],
        py[from],
        px[trail.activeTo],
        py[trail.activeTo],
        pointerX,
        pointerY,
      );

      if (t >= COMMIT_AT) {
        trail.nodes.push(trail.activeTo);
        trail.edges.push(trail.activeEdge);
        events.committed.push(trail.activeEdge);
        trail.activeEdge = -1;
        trail.activeTo = -1;
        trail.activeProgress = 0;
        continue;
      }

      if (t <= RELEASE_AT) {
        trail.used[trail.activeEdge] = 0;
        trail.activeEdge = -1;
        trail.activeTo = -1;
        trail.activeProgress = 0;
        continue;
      }

      trail.activeProgress = t;
      return;
    }

    const vx = pointerX - px[from];
    const vy = pointerY - py[from];
    const length = Math.hypot(vx, vy);
    if (length < DIRECTION_DEADZONE) return;

    let bestMatch = MIN_DIRECTION_MATCH;
    let bestEdge = -1;
    let bestTo = -1;
    let bestIsUndo = false;

    for (const ref of puzzle.adjacency[from]) {
      if (trail.used[ref.edgeId] === 1) continue;
      const dx = px[ref.to] - px[from];
      const dy = py[ref.to] - py[from];
      const match = (vx * dx + vy * dy) / (length * Math.hypot(dx, dy));
      if (match > bestMatch) {
        bestMatch = match;
        bestEdge = ref.edgeId;
        bestTo = ref.to;
        bestIsUndo = false;
      }
    }

    // Walking back over the last edge retracts it. Only the most recent edge
    // qualifies, so the stroke can never fork.
    if (trail.edges.length > 0) {
      const previous = trail.nodes[trail.nodes.length - 2];
      const backTrack = projectOnSegment(
        px[previous],
        py[previous],
        px[from],
        py[from],
        pointerX,
        pointerY,
      );
      const dx = px[previous] - px[from];
      const dy = py[previous] - py[from];
      const match = (vx * dx + vy * dy) / (length * Math.hypot(dx, dy));
      if (backTrack < UNDO_AT && match > bestMatch) {
        bestEdge = trail.edges[trail.edges.length - 1];
        bestTo = previous;
        bestIsUndo = true;
      }
    }

    if (bestEdge < 0) return;

    if (bestIsUndo) {
      // The retracting edge stays marked used while it is being pulled back, so
      // it cannot also be picked as a fresh move.
      trail.nodes.pop();
      trail.edges.pop();
      events.undone.push(bestEdge);
      trail.activeEdge = bestEdge;
      trail.activeTo = from;
      trail.activeProgress = 1;
      continue;
    }

    trail.used[bestEdge] = 1;
    trail.activeEdge = bestEdge;
    trail.activeTo = bestTo;
    trail.activeProgress = 0;
  }
}
