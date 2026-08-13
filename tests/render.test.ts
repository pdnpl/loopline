// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getPuzzle } from '../src/core/levels';
import { computeLayout } from '../src/game/layout';
import { Particles } from '../src/game/particles';
import { Renderer } from '../src/game/render';
import type { FrameInput } from '../src/game/render';
import { advance, createEvents, createTrail, startAt, tipPosition } from '../src/game/trail';
import type { Trail } from '../src/game/trail';
import { stubCanvas } from './helpers/browser-stubs';
import type { CanvasStub } from './helpers/browser-stubs';

const WIDTH = 400;
const HEIGHT = 640;

let canvasStub: CanvasStub;

beforeAll(() => {
  canvasStub = stubCanvas();
});

function scene(level = 4) {
  const puzzle = getPuzzle(level);
  const layout = computeLayout(puzzle, WIDTH, HEIGHT, 40);
  const trail = createTrail(puzzle);
  return { puzzle, layout, trail };
}

function frame(overrides: Partial<FrameInput> & Pick<FrameInput, 'puzzle' | 'layout' | 'trail'>) {
  const tip = tipPosition(overrides.trail, overrides.layout.px, overrides.layout.py, {
    x: 0,
    y: 0,
  });
  return {
    particles: new Particles(32),
    time: 1.25,
    nodePulse: new Float32Array(overrides.puzzle.nodes.length),
    hintNodes: [],
    celebration: 0,
    reducedMotion: false,
    tipX: tip.x,
    tipY: tip.y,
    ...overrides,
  } satisfies FrameInput;
}

/** Drags along a real Eulerian solution so the trail reaches a realistic state. */
function drawSteps(trail: Trail, board: ReturnType<typeof scene>, steps: number): void {
  const events = createEvents();
  let node = board.puzzle.validStarts[0];
  startAt(trail, node);

  for (let i = 0; i < steps; i++) {
    const next = board.puzzle.adjacency[node].find((ref) => trail.used[ref.edgeId] === 0);
    if (next === undefined) return;
    advance(
      trail,
      board.puzzle,
      board.layout.px,
      board.layout.py,
      board.layout.px[next.to],
      board.layout.py[next.to],
      events,
    );
    node = next.to;
  }
}

describe('Renderer', () => {
  beforeEach(() => {
    canvasStub.reset();
  });

  it('draws an untouched board without a stroke', () => {
    const board = scene();
    const renderer = new Renderer(document.createElement('canvas'));
    renderer.resize(WIDTH, HEIGHT);

    expect(() => {
      renderer.draw(frame(board));
    }).not.toThrow();

    expect(canvasStub.countOf('clearRect')).toBe(1);
    // Undrawn edges are one batched path, and every dot is a sprite blit.
    expect(canvasStub.countOf('stroke')).toBe(1);
    expect(canvasStub.countOf('drawImage')).toBe(board.puzzle.nodes.length);
  });

  it('builds glow sprites once and reuses them across frames', () => {
    const board = scene();
    const renderer = new Renderer(document.createElement('canvas'));
    renderer.resize(WIDTH, HEIGHT);

    renderer.draw(frame(board));
    const afterFirst = canvasStub.countOf('createRadialGradient');
    expect(afterFirst).toBe(3);

    for (let i = 0; i < 10; i++) renderer.draw(frame(board));
    expect(canvasStub.countOf('createRadialGradient')).toBe(afterFirst);
  });

  it('never uses shadowBlur, the slowest 2D canvas feature', () => {
    const board = scene();
    const renderer = new Renderer(document.createElement('canvas'));
    renderer.resize(WIDTH, HEIGHT);
    drawSteps(board.trail, board, 5);
    renderer.draw(frame({ ...board, celebration: 0.5 }));

    const usedShadow = canvasStub.calls.some((call) => String(call.name).startsWith('shadow'));
    expect(usedShadow).toBe(false);
  });

  it('falls back to a flat colour when the stroke has no length yet', () => {
    const board = scene();
    const renderer = new Renderer(document.createElement('canvas'));
    renderer.resize(WIDTH, HEIGHT);

    startAt(board.trail, board.puzzle.validStarts[0]);
    board.trail.activeEdge = board.puzzle.adjacency[board.puzzle.validStarts[0]][0].edgeId;
    board.trail.activeTo = board.puzzle.adjacency[board.puzzle.validStarts[0]][0].to;
    board.trail.activeProgress = 0;

    renderer.draw(frame(board));
    // A zero-length linear gradient paints nothing, so it must not be created.
    expect(canvasStub.countOf('createLinearGradient')).toBe(0);
  });

  it('paints a gradient stroke once the tip has moved', () => {
    const board = scene();
    const renderer = new Renderer(document.createElement('canvas'));
    renderer.resize(WIDTH, HEIGHT);
    drawSteps(board.trail, board, 4);

    renderer.draw(frame(board));
    expect(canvasStub.countOf('createLinearGradient')).toBe(1);
    expect(canvasStub.countOf('stroke')).toBeGreaterThan(1);
  });

  it('renders every visual state without throwing', () => {
    const renderer = new Renderer(document.createElement('canvas'));
    renderer.resize(WIDTH, HEIGHT);

    for (const level of [1, 7, 18, 33]) {
      for (const theme of ['dark', 'light'] as const) {
        renderer.setTheme(theme);
        for (const reducedMotion of [false, true]) {
          const board = scene(level);
          const particles = new Particles(64);
          particles.burst(10, 10, 8, 120, 0.5, 4, 0.3);
          particles.update(0.1);

          drawSteps(board.trail, board, level);
          const pulses = new Float32Array(board.puzzle.nodes.length).fill(0.7);

          expect(() => {
            renderer.draw(
              frame({
                ...board,
                particles,
                nodePulse: pulses,
                hintNodes: board.puzzle.validStarts,
                celebration: 0.4,
                reducedMotion,
              }),
            );
          }).not.toThrow();
        }
      }
    }
  });

  it('rebuilds sprites when the theme changes but not when it is re-set', () => {
    const board = scene();
    const renderer = new Renderer(document.createElement('canvas'));
    renderer.resize(WIDTH, HEIGHT);
    renderer.draw(frame(board));

    canvasStub.reset();
    renderer.setTheme('dark');
    renderer.draw(frame(board));
    expect(canvasStub.countOf('createRadialGradient')).toBe(0);

    renderer.setTheme('light');
    renderer.draw(frame(board));
    expect(canvasStub.countOf('createRadialGradient')).toBe(3);
  });
});
