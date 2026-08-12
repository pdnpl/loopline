/**
 * Canvas renderer.
 *
 * Performance rules this file follows, in order of how much they matter on a
 * mid-range phone:
 *
 * 1. No `shadowBlur` in the frame loop. It is the single most expensive 2D
 *    canvas operation. Glow comes from radial-gradient sprites rendered once
 *    and blitted with `drawImage`.
 * 2. Batch by state. Every undrawn edge is one path and one `stroke()`; changing
 *    `strokeStyle` per edge would cost more than the pixels do.
 * 3. Sprites are rebuilt only when the board size or theme changes, never per
 *    frame.
 * 4. The page background lives in CSS, so the canvas stays transparent and the
 *    compositor handles the decorative layer off the main thread.
 */

import type { Puzzle } from '../core/types';
import { withAlpha } from './color';
import type { Layout } from './layout';
import type { Particles } from './particles';
import type { Palette, ThemeName } from './theme';
import { palette } from './theme';
import type { Trail } from './trail';

export interface FrameInput {
  puzzle: Puzzle;
  layout: Layout;
  trail: Trail;
  particles: Particles;
  /** Seconds since the game started — drives idle motion only. */
  time: number;
  /** Per-node highlight that decays after the stroke touches it, `0..1`. */
  nodePulse: Float32Array;
  /** Dots to ring as possible starting points. Empty when no hint is due. */
  hintNodes: readonly number[];
  /** Every edge leaving the current dot is already drawn. */
  deadEnd: boolean;
  /** Solved-sweep progress, `0..1`. Zero when not celebrating. */
  celebration: number;
  reducedMotion: boolean;
  tipX: number;
  tipY: number;
}

const TAU = Math.PI * 2;
/** Beyond this the extra pixels are invisible and the fill rate is not. */
const MAX_DPR = 2.5;
/** Sprite half-size as a multiple of the dot radius; leaves room for the glow. */
const GLOW_SCALE = 4.2;
const PARTICLE_SPRITE_HALF = 10;

interface Surface {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

function createSurface(width: number, height: number): Surface {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('2D canvas context is unavailable');
  return { canvas, ctx };
}

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private colors: Palette = palette('dark');
  private theme: ThemeName = 'dark';
  private dpr = 1;

  private idleDot: HTMLCanvasElement | null = null;
  private visitedDot: HTMLCanvasElement | null = null;
  private particleDot: HTMLCanvasElement | null = null;
  private dotHalf = 0;
  private spriteKey = '';

  private visited = new Uint8Array(0);

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
    if (ctx === null) throw new Error('2D canvas context is unavailable');
    this.ctx = ctx;
  }

  setTheme(theme: ThemeName): void {
    if (theme === this.theme) return;
    this.theme = theme;
    this.colors = palette(theme);
    this.spriteKey = '';
  }

  /** Sizes the backing store to the device pixel ratio and resets the transform. */
  resize(cssWidth: number, cssHeight: number): void {
    const dpr = Math.min(MAX_DPR, Math.max(1, globalThis.devicePixelRatio || 1));
    const width = Math.max(1, Math.round(cssWidth * dpr));
    const height = Math.max(1, Math.round(cssHeight * dpr));

    if (this.canvas.width !== width || this.canvas.height !== height || this.dpr !== dpr) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.dpr = dpr;
      this.spriteKey = '';
    }
    this.canvas.style.width = `${cssWidth}px`;
    this.canvas.style.height = `${cssHeight}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  draw(frame: FrameInput): void {
    const { ctx } = this;
    const { layout, trail } = frame;

    this.ensureSprites(layout.nodeRadius);
    ctx.clearRect(0, 0, layout.width, layout.height);

    this.drawUndrawnEdges(frame);
    this.drawStroke(frame);
    this.drawHints(frame);
    this.drawNodes(frame);
    if (trail.nodes.length > 0) this.drawHead(frame);
    this.drawParticles(frame);
  }

  // -- sprites -------------------------------------------------------------

  private ensureSprites(nodeRadius: number): void {
    const key = `${this.theme}:${nodeRadius.toFixed(2)}:${this.dpr.toFixed(2)}`;
    if (key === this.spriteKey) return;
    this.spriteKey = key;

    this.dotHalf = Math.max(3, nodeRadius * GLOW_SCALE);
    this.idleDot = this.makeDot(this.colors.nodeIdle, this.colors.nodeIdleGlow, nodeRadius);
    this.visitedDot = this.makeDot(
      this.colors.nodeVisited,
      this.colors.nodeVisitedGlow,
      nodeRadius,
    );
    this.particleDot = this.makeBlob(this.colors.particle);
  }

  private makeDot(core: string, glow: string, radius: number): HTMLCanvasElement {
    const half = this.dotHalf;
    const { canvas, ctx } = createSurface(
      Math.ceil(half * 2 * this.dpr),
      Math.ceil(half * 2 * this.dpr),
    );
    ctx.scale(this.dpr, this.dpr);

    const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
    gradient.addColorStop(0, withAlpha(glow, 1));
    gradient.addColorStop(0.32, withAlpha(glow, 0.42));
    gradient.addColorStop(1, withAlpha(glow, 0));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, half * 2, half * 2);

    ctx.beginPath();
    ctx.arc(half, half, radius, 0, TAU);
    ctx.fillStyle = core;
    ctx.fill();

    return canvas;
  }

  private makeBlob(color: string): HTMLCanvasElement {
    const half = PARTICLE_SPRITE_HALF;
    const { canvas, ctx } = createSurface(
      Math.ceil(half * 2 * this.dpr),
      Math.ceil(half * 2 * this.dpr),
    );
    ctx.scale(this.dpr, this.dpr);

    const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
    gradient.addColorStop(0, withAlpha(color, 0.95));
    gradient.addColorStop(0.45, withAlpha(color, 0.35));
    gradient.addColorStop(1, withAlpha(color, 0));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, half * 2, half * 2);

    return canvas;
  }

  // -- layers --------------------------------------------------------------

  private drawUndrawnEdges(frame: FrameInput): void {
    const { ctx } = this;
    const { puzzle, layout, trail } = frame;
    const { px, py } = layout;

    ctx.beginPath();
    for (const edge of puzzle.edges) {
      // The edge being drawn keeps its ghost so the player can see where the
      // rest of it goes.
      if (trail.used[edge.id] === 1 && edge.id !== trail.activeEdge) continue;
      ctx.moveTo(px[edge.a], py[edge.a]);
      ctx.lineTo(px[edge.b], py[edge.b]);
    }
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.5, layout.strokeWidth * 0.17);
    ctx.strokeStyle = this.colors.edgeGhost;
    ctx.stroke();
  }

  private drawStroke(frame: FrameInput): void {
    const { ctx, colors } = this;
    const { trail, layout, tipX, tipY } = frame;
    if (trail.nodes.length === 0) return;
    if (trail.nodes.length === 1 && trail.activeEdge < 0) return;

    const { px, py } = layout;
    const path = new Path2D();
    const startX = px[trail.nodes[0]];
    const startY = py[trail.nodes[0]];
    path.moveTo(startX, startY);

    let length = 0;
    let previousX = startX;
    let previousY = startY;
    for (let i = 1; i < trail.nodes.length; i++) {
      const x = px[trail.nodes[i]];
      const y = py[trail.nodes[i]];
      path.lineTo(x, y);
      length += Math.hypot(x - previousX, y - previousY);
      previousX = x;
      previousY = y;
    }
    if (trail.activeEdge >= 0) {
      path.lineTo(tipX, tipY);
      length += Math.hypot(tipX - previousX, tipY - previousY);
    }

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.save();
    if (colors.additiveGlow) ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = colors.strokeGlow;
    ctx.lineWidth = layout.strokeWidth * 2.4;
    ctx.stroke(path);
    ctx.restore();

    ctx.strokeStyle = this.strokeGradient(startX, startY, tipX, tipY);
    ctx.lineWidth = layout.strokeWidth;
    ctx.stroke(path);

    if (colors.additiveGlow) {
      // A thin bright core reads as a lit filament rather than a flat ribbon.
      ctx.strokeStyle = withAlpha(colors.head, 0.22);
      ctx.lineWidth = layout.strokeWidth * 0.3;
      ctx.stroke(path);
    }

    if (frame.celebration > 0 && length > 0) {
      ctx.save();
      if (colors.additiveGlow) ctx.globalCompositeOperation = 'lighter';
      const window = length * 0.16;
      ctx.setLineDash([window, length + window]);
      ctx.lineDashOffset = window - frame.celebration * (length + window * 2);
      ctx.strokeStyle = withAlpha(colors.head, 0.75 * (1 - frame.celebration * 0.35));
      ctx.lineWidth = layout.strokeWidth * 1.25;
      ctx.stroke(path);
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  private strokeGradient(x0: number, y0: number, x1: number, y1: number): string | CanvasGradient {
    // A zero-length linear gradient paints nothing, so fall back to flat colour.
    if (Math.abs(x1 - x0) < 0.5 && Math.abs(y1 - y0) < 0.5) return this.colors.strokeMid;
    const gradient = this.ctx.createLinearGradient(x0, y0, x1, y1);
    gradient.addColorStop(0, this.colors.strokeStart);
    gradient.addColorStop(0.55, this.colors.strokeMid);
    gradient.addColorStop(1, this.colors.strokeEnd);
    return gradient;
  }

  private drawHints(frame: FrameInput): void {
    if (frame.hintNodes.length === 0) return;
    const { ctx } = this;
    const { layout } = frame;
    const wave = frame.reducedMotion ? 0.6 : 0.45 + Math.sin(frame.time * 3) * 0.3;

    ctx.beginPath();
    for (const node of frame.hintNodes) {
      ctx.moveTo(layout.px[node] + layout.nodeRadius * 2.8, layout.py[node]);
      ctx.arc(layout.px[node], layout.py[node], layout.nodeRadius * 2.8, 0, TAU);
    }
    ctx.strokeStyle = withAlpha(this.colors.hint, wave);
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  private drawNodes(frame: FrameInput): void {
    const { ctx } = this;
    const { puzzle, layout, trail, nodePulse } = frame;
    const idle = this.idleDot;
    const visitedSprite = this.visitedDot;
    if (idle === null || visitedSprite === null) return;

    if (this.visited.length !== puzzle.nodes.length) {
      this.visited = new Uint8Array(puzzle.nodes.length);
    }
    this.visited.fill(0);
    for (const node of trail.nodes) this.visited[node] = 1;

    const half = this.dotHalf;
    for (const node of puzzle.nodes) {
      const breathe = frame.reducedMotion ? 0 : Math.sin(frame.time * 1.5 + node.id * 0.9) * 0.045;
      const scale = 1 + breathe + nodePulse[node.id] * 0.6;
      const sprite = this.visited[node.id] === 1 ? visitedSprite : idle;
      const size = half * 2 * scale;
      ctx.drawImage(
        sprite,
        layout.px[node.id] - half * scale,
        layout.py[node.id] - half * scale,
        size,
        size,
      );
    }
  }

  private drawHead(frame: FrameInput): void {
    const { ctx, colors } = this;
    const { layout, tipX, tipY } = frame;
    const radius = layout.strokeWidth * 0.42;

    if (frame.deadEnd) {
      const wave = frame.reducedMotion ? 1 : 1 + Math.sin(frame.time * 9) * 0.18;
      ctx.beginPath();
      ctx.arc(tipX, tipY, radius * 2.4 * wave, 0, TAU);
      ctx.strokeStyle = withAlpha(colors.deadEnd, 0.9);
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(tipX, tipY, radius, 0, TAU);
    ctx.fillStyle = colors.head;
    ctx.fill();
  }

  private drawParticles(frame: FrameInput): void {
    const sprite = this.particleDot;
    if (sprite === null || frame.particles.count === 0) return;

    const { ctx } = this;
    const particles = frame.particles;
    ctx.save();
    if (this.colors.additiveGlow) ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < particles.count; i++) {
      const remaining = particles.life[i] / particles.maxLife[i];
      ctx.globalAlpha = remaining * remaining;
      const size = particles.size[i] * (0.55 + remaining * 0.9);
      ctx.drawImage(sprite, particles.x[i] - size, particles.y[i] - size, size * 2, size * 2);
    }
    ctx.restore();
  }
}
