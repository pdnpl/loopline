# ADR-0024: Contrast is not a filter

- **Status:** Accepted
- **Date:** 2026-08-14
- **Deciders:** autonomous agent, from a report by @ravwtar
- **Related:** [ADR-0017](0017-optional-platform-apis-must-fail-soft.md), [ADR-0013](0013-stroke-model-and-fast-retry.md), [ADR-0023](0023-android-as-a-capacitor-shell-built-locally.md)

## Context

Reported from the Android build: _"when the Solved card appears the board shows
through too strongly. On the web the blur hides it completely and the buttons
are readable; on Android the blur is weak, board elements — the progress bar
among them — stay visible, and the card's buttons become unreadable. It is
annoying in both themes: you have to stare to work out what is active and what
is behind."_

Correct, and the cause was in the CSS rather than in the shell.

The overlay was built as a single translucent sheet:

```css
.overlay {
  background: var(--overlay-veil); /* 0.72 dark / 0.75 light */
  backdrop-filter: blur(18px) saturate(120%);
}
.overlay__card {
  /* no background at all */
}
```

**The card had no surface of its own.** Its text and buttons sat directly on the
veil, so all legibility came from 72% opacity plus the blur smearing whatever
remained into a flat wash. In a desktop browser that works and looks good. It
depends entirely on the filter actually running.

`backdrop-filter` is a hint. It is expensive, it forces a separate compositing
pass over live content, and an engine is free to weaken or drop it —
particularly an Android WebView, and especially without hardware acceleration.
When it does, 28% of a **sharp** board is left directly behind the words: dots,
the traced figure, and the progress bar sitting right under the primary button.

This is [ADR-0017](0017-optional-platform-apis-must-fail-soft.md) again, from an
angle that record did not anticipate. That one was about JavaScript APIs —
`navigator.vibrate`, `localStorage` — failing soft. A CSS filter is the same
class of thing: optional, environment-dependent, and here it was **load-bearing
for legibility**. When it degraded, the interface did not degrade gracefully;
it became unreadable.

## Decision

**Legibility is built from opacity and a surface. The filter is gone.**

1. **The card carries its own opaque background.** `--panel`: `#0f1320` dark,
   `#ffffff` light, with a border and a shadow. Nothing behind it can affect the
   contrast of a word or a button, on any engine.
2. **The veil goes nearly opaque on its own** — 0.72 → **0.86** dark, 0.75 →
   **0.88** light. It no longer needs a filter's help to push the board back.
3. **`backdrop-filter` is removed from `.overlay` entirely.** At 0.86 it was
   contributing almost nothing visible, while costing a compositing pass over
   live content on the one screen that sits on the fast-retry path
   ([ADR-0013](0013-stroke-model-and-fast-retry.md)).

The header keeps its own `backdrop-filter`. It sits over the page gradient, not
over the board, so if it degrades nothing becomes unreadable — which is exactly
the test.

## Why not simply raise the blur, or make the veil fully opaque

**Raising the blur** treats the symptom. The filter can be weakened or skipped;
a stronger value that is ignored is still ignored.

**A fully opaque veil** would work and was rejected for one reason: on the
solved screen the completed figure behind the card is the reward. It is worth
keeping visible. With an opaque card the figure becomes context instead of
competition, which is what the report was really asking for — a clear answer to
_what is active and what is behind_.

## Consequences

**Positive**

- The overlay reads identically in a browser, in an Android WebView, and in an
  iOS WKWebView later, because nothing about it is conditional.
- One GPU compositing pass removed from the retry loop.
- Figure and ground are now settled by an edge — a border and a shadow — rather
  than by a gradient of confusion.

**Negative**

- The frosted-glass look is gone. It was attractive on desktop; it was also the
  bug.
- The card is visually heavier, and the intro overlay grows by its padding.
  Measured at 411 dp: the tallest card, the three-step instructions, still
  clears the top of the viewport comfortably.

## What to take from this

The rule is not "avoid `backdrop-filter`". It is that **a decorative effect must
never be the only thing separating text from what is behind it.** If removing
the effect makes the interface unreadable, the effect was doing structural work
and the structure was missing.
