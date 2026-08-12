import { describe, expect, it } from 'vitest';
import {
  buildAdjacency,
  degrees,
  eulerStartNodes,
  findEulerTrail,
  hasEulerTrail,
  isConnected,
  oddDegreeNodes,
} from '../src/core/graph';
import type { PuzzleEdge } from '../src/core/types';

function edges(...pairs: ReadonlyArray<readonly [number, number]>): PuzzleEdge[] {
  return pairs.map(([a, b], id) => ({ id, a, b }));
}

describe('adjacency and degrees', () => {
  it('records both directions of every edge', () => {
    const adjacency = buildAdjacency(3, edges([0, 1], [1, 2]));
    expect(adjacency[0].map((ref) => ref.to)).toEqual([1]);
    expect(adjacency[1].map((ref) => ref.to)).toEqual([0, 2]);
    expect(adjacency[2].map((ref) => ref.to)).toEqual([1]);
  });

  it('counts degrees', () => {
    expect([...degrees(3, edges([0, 1], [1, 2]))]).toEqual([1, 2, 1]);
  });
});

describe('isConnected', () => {
  it('accepts a connected graph', () => {
    expect(isConnected(3, edges([0, 1], [1, 2]))).toBe(true);
  });

  it('rejects two separate components', () => {
    expect(isConnected(4, edges([0, 1], [2, 3]))).toBe(false);
  });

  it('ignores nodes that carry no edges', () => {
    expect(isConnected(5, edges([0, 1], [1, 2]))).toBe(true);
  });
});

describe('Eulerian trails', () => {
  it('finds a trail across a triangle (no odd vertices)', () => {
    const triangle = edges([0, 1], [1, 2], [2, 0]);
    expect(oddDegreeNodes(3, triangle)).toEqual([]);
    expect(eulerStartNodes(3, triangle)).toEqual([0, 1, 2]);

    const trail = findEulerTrail(3, triangle, 0);
    expect(trail).not.toBeNull();
    expect(trail).toHaveLength(3);
    expect(new Set(trail)).toEqual(new Set([0, 1, 2]));
  });

  it('starts at an odd vertex when exactly two exist', () => {
    // A path 0-1-2: the two ends are odd, the middle is even.
    const path = edges([0, 1], [1, 2]);
    expect(eulerStartNodes(3, path)).toEqual([0, 2]);
    expect(findEulerTrail(3, path, 0)).toEqual([0, 1]);
    expect(findEulerTrail(3, path, 1)).toBeNull();
  });

  it('rejects the bridges of Königsberg', () => {
    // Four land masses, seven bridges, every vertex of odd degree.
    const koenigsberg = edges([0, 1], [0, 1], [0, 2], [0, 2], [0, 3], [1, 3], [2, 3]);
    expect(oddDegreeNodes(4, koenigsberg)).toHaveLength(4);
    expect(hasEulerTrail(4, koenigsberg)).toBe(false);
    expect(findEulerTrail(4, koenigsberg, 0)).toBeNull();
  });

  it('rejects a disconnected graph even when every degree is even', () => {
    const twoTriangles = edges([0, 1], [1, 2], [2, 0], [3, 4], [4, 5], [5, 3]);
    expect(oddDegreeNodes(6, twoTriangles)).toEqual([]);
    expect(hasEulerTrail(6, twoTriangles)).toBe(false);
  });

  it('handles a figure-of-eight, where one vertex is visited twice', () => {
    const eight = edges([0, 1], [1, 2], [2, 0], [0, 3], [3, 4], [4, 0]);
    const trail = findEulerTrail(5, eight, 0);
    expect(trail).not.toBeNull();
    expect(trail).toHaveLength(6);
    expect(new Set(trail).size).toBe(6);
  });

  it('returns an empty trail for an empty graph', () => {
    expect(findEulerTrail(0, [], 0)).toEqual([]);
    expect(eulerStartNodes(0, [])).toEqual([]);
  });
});
