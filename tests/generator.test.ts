import { describe, expect, it } from 'vitest';
import { generatePuzzle } from '../src/core/generator';
import { findEulerTrail, isConnected } from '../src/core/graph';
import { getPuzzle, levelSpec } from '../src/core/levels';
import type { Puzzle } from '../src/core/types';

const LEVELS = Array.from({ length: 60 }, (_, index) => index + 1);

function edgeKey(puzzle: Puzzle, edgeId: number): string {
  const edge = puzzle.edges[edgeId];
  const [lo, hi] = edge.a < edge.b ? [edge.a, edge.b] : [edge.b, edge.a];
  return `${lo}-${hi}`;
}

describe('level specs', () => {
  it('grows monotonically and never asks for more than the ceiling', () => {
    let previous = 0;
    for (const level of LEVELS) {
      const spec = levelSpec(level);
      expect(spec.targetEdges).toBeGreaterThanOrEqual(previous);
      expect(spec.targetEdges).toBeLessThanOrEqual(30);
      previous = spec.targetEdges;
    }
  });

  it('clamps nonsense level numbers instead of throwing', () => {
    expect(levelSpec(0).level).toBe(1);
    expect(levelSpec(-5).level).toBe(1);
    expect(levelSpec(2.7).level).toBe(2);
  });
});

describe('generated boards', () => {
  it.each(LEVELS)('level %i is solvable in one stroke', (level) => {
    const puzzle = getPuzzle(level);

    expect(puzzle.edges.length).toBeGreaterThanOrEqual(4);
    expect(puzzle.nodes.length).toBeGreaterThanOrEqual(3);
    expect(isConnected(puzzle.nodes.length, puzzle.edges)).toBe(true);
    expect(puzzle.validStarts.length).toBeGreaterThan(0);

    for (const start of puzzle.validStarts) {
      const trail = findEulerTrail(puzzle.nodes.length, puzzle.edges, start);
      expect(trail).not.toBeNull();
      expect(trail).toHaveLength(puzzle.edges.length);
    }
  });

  it.each(LEVELS)('level %i has no duplicate or self edges', (level) => {
    const puzzle = getPuzzle(level);
    const seen = new Set<string>();
    for (const edge of puzzle.edges) {
      expect(edge.a).not.toBe(edge.b);
      const key = edgeKey(puzzle, edge.id);
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it.each(LEVELS)('level %i places every dot on a distinct grid cell', (level) => {
    const puzzle = getPuzzle(level);
    const cells = new Set(puzzle.nodes.map((node) => `${node.gx},${node.gy}`));
    expect(cells.size).toBe(puzzle.nodes.length);

    for (const node of puzzle.nodes) {
      expect(node.gx).toBeGreaterThanOrEqual(0);
      expect(node.gy).toBeGreaterThanOrEqual(0);
      expect(node.gx).toBeLessThan(puzzle.cols);
      expect(node.gy).toBeLessThan(puzzle.rows);
    }
  });

  it.each(LEVELS)('level %i never crosses two diagonals in one cell', (level) => {
    const puzzle = getPuzzle(level);
    const occupied = new Set<string>();

    for (const edge of puzzle.edges) {
      const a = puzzle.nodes[edge.a];
      const b = puzzle.nodes[edge.b];
      const dx = Math.abs(a.gx - b.gx);
      const dy = Math.abs(a.gy - b.gy);

      // Every edge joins immediate neighbours, orthogonally or diagonally.
      expect(dx).toBeLessThanOrEqual(1);
      expect(dy).toBeLessThanOrEqual(1);

      if (dx === 1 && dy === 1) {
        const cell = `${Math.min(a.gx, b.gx)},${Math.min(a.gy, b.gy)}`;
        expect(occupied.has(cell)).toBe(false);
        occupied.add(cell);
      }
    }
  });

  it('is deterministic — the same level always yields the same board', () => {
    for (const level of [1, 5, 12, 27]) {
      const spec = levelSpec(level);
      const first = generatePuzzle(level, spec);
      const second = generatePuzzle(level, spec);
      expect(second).toEqual(first);
    }
  });

  it('keeps diagonals out of the early levels', () => {
    for (const level of [1, 2, 3, 4, 5, 6]) {
      const puzzle = getPuzzle(level);
      const hasDiagonal = puzzle.edges.some((edge) => {
        const a = puzzle.nodes[edge.a];
        const b = puzzle.nodes[edge.b];
        return a.gx !== b.gx && a.gy !== b.gy;
      });
      expect(hasDiagonal).toBe(false);
    }
  });

  it('introduces junctions once the tutorial levels are over', () => {
    for (const level of [6, 10, 20, 40]) {
      const puzzle = getPuzzle(level);
      const degree = new Map<number, number>();
      for (const edge of puzzle.edges) {
        degree.set(edge.a, (degree.get(edge.a) ?? 0) + 1);
        degree.set(edge.b, (degree.get(edge.b) ?? 0) + 1);
      }
      const junctions = [...degree.values()].filter((value) => value >= 3).length;
      expect(junctions).toBeGreaterThanOrEqual(levelSpec(level).minBranchNodes);
    }
  });
});
