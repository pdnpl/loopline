# ADR-0005: `requestAnimationFrame` is the only clock; CSS animates decoration only

- **Status:** Accepted
- **Date:** 2026-08-12
- **Deciders:** autonomous agent

## Context

The brief called out a real failure mode: CSS transitions are not a reliable
basis for anything time-critical. They can be dropped, throttled or coalesced by
the compositor, they are not observable from JavaScript without hacks, and their
timing is not aligned with anything the game can reason about.

At the same time, refusing CSS animation entirely would be the wrong lesson.
Compositor-driven CSS is the _cheapest_ way to animate decoration, precisely
because it runs off the main thread and therefore cannot steal frame budget from
the game.

## Decision

Split animation by whether it affects state.

**`requestAnimationFrame` owns everything the game reasons about:**

- the stopwatch,
- particle physics,
- node pulse decay,
- the completion sweep,
- idle breathing on the dots.

Every one of these is advanced by a delta derived from the `rAF` timestamp. No
`setInterval`, no `setTimeout`, no reading back a CSS transition.

**CSS owns decoration that no logic depends on:** background drift, overlay
fade-in, card entry, button hover and press feedback. All of it is `transform`
and `opacity` only, so it stays on the compositor.

## Implementation notes

- The frame delta is clamped **twice**, on purpose:
  - `min(0.05 s)` for animation, so one long frame cannot teleport particles;
  - `min(0.25 s)` for the stopwatch, which should tolerate a hitch without
    losing time.
- Because `rAF` stops when the tab is hidden, a backgrounded tab pauses the
  clock automatically. That is the desired behaviour and needs no
  `visibilitychange` handler.
- The stopwatch starts on the **first committed line**, not on touch-down, so
  hesitating before the opening move costs nothing.
- `prefers-reduced-motion` disables particles, idle breathing and background
  drift; gameplay is unaffected.

## Consequences

**Positive**

- Timing is frame-aligned by construction at 60 Hz and 120 Hz alike.
- Decorative work cannot contend with gameplay work for the main thread.
- Deterministic and testable: the test suite drives the loop with a manual frame
  pump and asserts on elapsed time.

**Negative**

- The stopwatch accumulates a float per frame rather than subtracting two
  timestamps, so it drifts by a fraction of a millisecond over a run. Irrelevant
  at the two-decimal precision shown, and it is what makes background pausing
  fall out for free.

## Alternatives considered

- **`performance.now()` differences.** No drift, but it keeps counting while the
  tab is hidden, so leaving the page mid-level would ruin the time.
- **Web Animations API for gameplay.** Same observability problem as CSS
  transitions.
