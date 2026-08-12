/**
 * Graph theory behind the puzzle.
 *
 * "Draw the whole figure in one stroke without retracing" is exactly the
 * Eulerian trail problem Euler solved for the bridges of Königsberg in 1736:
 * a connected graph has a trail using every edge exactly once iff it has
 * zero or two vertices of odd degree.
 */

import type { EdgeRef, PuzzleEdge } from './types';

export function buildAdjacency(nodeCount: number, edges: readonly PuzzleEdge[]): EdgeRef[][] {
  const adjacency: EdgeRef[][] = Array.from({ length: nodeCount }, () => []);
  for (const edge of edges) {
    adjacency[edge.a].push({ edgeId: edge.id, to: edge.b });
    adjacency[edge.b].push({ edgeId: edge.id, to: edge.a });
  }
  return adjacency;
}

export function degrees(nodeCount: number, edges: readonly PuzzleEdge[]): Int32Array {
  const deg = new Int32Array(nodeCount);
  for (const edge of edges) {
    deg[edge.a]++;
    deg[edge.b]++;
  }
  return deg;
}

/**
 * True when every node that has at least one edge is reachable from every
 * other. Isolated nodes are ignored — they carry no edges to draw.
 */
export function isConnected(nodeCount: number, edges: readonly PuzzleEdge[]): boolean {
  if (edges.length === 0) return true;

  const adjacency = buildAdjacency(nodeCount, edges);
  const seen = new Uint8Array(nodeCount);
  const stack: number[] = [edges[0].a];
  seen[edges[0].a] = 1;
  let reached = 1;

  while (stack.length > 0) {
    const node = stack.pop() as number;
    for (const ref of adjacency[node]) {
      if (seen[ref.to] === 0) {
        seen[ref.to] = 1;
        reached++;
        stack.push(ref.to);
      }
    }
  }

  const deg = degrees(nodeCount, edges);
  let withEdges = 0;
  for (let i = 0; i < nodeCount; i++) if (deg[i] > 0) withEdges++;
  return reached === withEdges;
}

export function oddDegreeNodes(nodeCount: number, edges: readonly PuzzleEdge[]): number[] {
  const deg = degrees(nodeCount, edges);
  const odd: number[] = [];
  for (let i = 0; i < nodeCount; i++) if (deg[i] % 2 === 1) odd.push(i);
  return odd;
}

/**
 * Every node an Eulerian trail may start from.
 *
 * - two odd-degree nodes → the trail must start at one of them;
 * - no odd-degree nodes  → the graph has a closed circuit, any node works;
 * - anything else        → no trail exists.
 */
export function eulerStartNodes(nodeCount: number, edges: readonly PuzzleEdge[]): number[] {
  if (edges.length === 0) return [];
  if (!isConnected(nodeCount, edges)) return [];

  const odd = oddDegreeNodes(nodeCount, edges);
  if (odd.length === 2) return odd;
  if (odd.length > 0) return [];

  const deg = degrees(nodeCount, edges);
  const starts: number[] = [];
  for (let i = 0; i < nodeCount; i++) if (deg[i] > 0) starts.push(i);
  return starts;
}

export function hasEulerTrail(nodeCount: number, edges: readonly PuzzleEdge[]): boolean {
  return eulerStartNodes(nodeCount, edges).length > 0;
}

/**
 * Hierholzer's algorithm, iterative so deep boards cannot blow the stack.
 * Returns the edge ids in traversal order, or `null` when no trail exists
 * from `start`.
 */
export function findEulerTrail(
  nodeCount: number,
  edges: readonly PuzzleEdge[],
  start: number,
): number[] | null {
  if (edges.length === 0) return [];
  if (!eulerStartNodes(nodeCount, edges).includes(start)) return null;

  const adjacency = buildAdjacency(nodeCount, edges);
  // Per-node cursor into its adjacency list, so each edge is examined once.
  const cursor = new Int32Array(nodeCount);
  const used = new Uint8Array(edges.length);

  const nodeStack: number[] = [start];
  const edgeStack: number[] = [];
  const trail: number[] = [];

  while (nodeStack.length > 0) {
    const node = nodeStack[nodeStack.length - 1];
    const list = adjacency[node];

    while (cursor[node] < list.length && used[list[cursor[node]].edgeId] === 1) {
      cursor[node]++;
    }

    if (cursor[node] === list.length) {
      nodeStack.pop();
      const edgeId = edgeStack.pop();
      if (edgeId !== undefined) trail.push(edgeId);
      continue;
    }

    const ref = list[cursor[node]];
    used[ref.edgeId] = 1;
    nodeStack.push(ref.to);
    edgeStack.push(ref.edgeId);
  }

  if (trail.length !== edges.length) return null;
  return trail.reverse();
}
