# ADR-0003: Render the board with Canvas 2D

- **Status:** Accepted
- **Date:** 2026-08-12
- **Deciders:** autonomous agent

## Context

The board is at most ~30 dots and ~30 lines, plus a stroke that follows the
finger, a particle burst on each move and a sweep animation on completion.
Everything redraws every frame while a stroke is in progress.

Three options were realistic: animate SVG or DOM nodes, draw to a 2D canvas, or
go to WebGL.

## Decision

A single transparent `<canvas>` with the 2D context, redrawn in full on every
frame from one `requestAnimationFrame` loop.

The scene is small enough that full redraw beats any dirty-rectangle bookkeeping,
and it removes a whole class of stale-pixel bugs.

## Consequences

**Positive**

- One code path for every visual, with exact control over sub-pixel positions —
  which is what makes the stroke tip track the finger smoothly instead of
  snapping between dots.
- No layout or style recalculation per frame. Moving 30 SVG nodes would dirty
  layout 30 times.
- Trivially scalable to the device pixel ratio.

**Negative**

- Canvas draws pixels, not accessible objects. Mitigated by keeping all text and
  controls in real DOM and adding keyboard play plus an ARIA live region
  (see ADR-0012).
- Colours cannot be read from CSS custom properties, so the canvas palette is
  duplicated in `src/game/theme.ts` and must be kept in step with `styles.css`.

## Alternatives considered

- **SVG.** Accessible and declarative, but per-frame attribute updates on dozens
  of nodes push layout and paint work into the frame budget, and the stroke would
  still need a `<path>` rebuilt every frame.
- **WebGL.** Enormous headroom the project cannot use. It would add shader
  plumbing, a context-loss failure mode and a larger bundle to draw thirty lines.

## Implementation notes

Performance rules the renderer holds itself to, documented at the top of
`src/game/render.ts`:

1. **No `shadowBlur` in the frame loop.** It is the most expensive 2D canvas
   operation by a wide margin. Glow comes from radial-gradient sprites rendered
   once into offscreen canvases and blitted with `drawImage`. A test asserts no
   `shadow*` property is ever touched.
2. **Batch by draw state.** All undrawn edges are one path and one `stroke()`.
3. **Rebuild sprites only on resize or theme change**, keyed by a cache string.
4. **Cap the device pixel ratio at 2.5.** Beyond that the extra pixels are
   invisible and the fill rate is not.
