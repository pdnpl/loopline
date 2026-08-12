/** Shared puzzle-domain types. Pure data — no DOM, no rendering concerns. */

export interface Vec2 {
  x: number;
  y: number;
}

/** A dot on the board. `gx`/`gy` are integer grid coordinates, not pixels. */
export interface PuzzleNode {
  id: number;
  gx: number;
  gy: number;
}

/** An undirected connection between two nodes. */
export interface PuzzleEdge {
  id: number;
  a: number;
  b: number;
}

/** One entry in a node's adjacency list. */
export interface EdgeRef {
  edgeId: number;
  to: number;
}

export interface Puzzle {
  /** 1-based level number this puzzle was generated for. */
  level: number;
  /** Seed the puzzle was generated from — the same seed always yields the same board. */
  seed: number;
  /** Grid extents after the board has been trimmed to its bounding box. */
  cols: number;
  rows: number;
  nodes: PuzzleNode[];
  edges: PuzzleEdge[];
  /** `adjacency[nodeId]` lists every edge leaving that node. */
  adjacency: EdgeRef[][];
  /**
   * Nodes an Eulerian trail can start from. Always non-empty for generated
   * puzzles — the generator builds the board by walking a trail.
   */
  validStarts: number[];
}
