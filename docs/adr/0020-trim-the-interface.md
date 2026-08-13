# ADR-0020: Trim the interface to what it can honour

- **Status:** Accepted
- **Date:** 2026-08-13
- **Deciders:** autonomous agent, on three calls from @ravwtar
- **Related:** [ADR-0019](0019-the-dock-holds-navigation.md), [ADR-0013](0013-stroke-model-and-fast-retry.md)

## Context

Three pieces of feedback after the level picker shipped, each pointing at
something the interface said that it could not honour.

## 1. The picker's `Close` button

Reported as _"makes no sense — and by the way it does not work, but do not fix
it, remove it; tapping a level closes it anyway."_

It did not work, and the reason was worse than a dead button: `onOverlayAction`
in `main.ts` handled `intro` and `failed` and let everything else fall through to
`goToLevel(currentLevel + 1)`. The `levels` kind was added without a branch, so
**closing the picker skipped a level** — and so did tapping the veil, which
routes to the same handler.

**Decision: remove the button, and give `levels` its own branch that closes.**
Choosing a level closes the picker; tapping anywhere else closes it. A third
control doing what those two already do is clutter, and the one that existed was
actively lying about what it did.

## 2. The dead-end indicator

Reported as _"not generated correctly, and not needed either — delete the display
and all the logic around it."_

Introduced in an earlier round to explain why a stroke had stalled. In practice
a dead end is a transient state the player passes through while deciding, so the
counter slot flickered between "12 lines left" and "Dead end" during ordinary
play — noise attached to a moment that needs none.

**Decision: remove the feature entirely** — the text, the red counter state, the
ring the renderer drew at the tip, the `onDeadEnd` hook, the `deadEnd` palette
entry, the `isDeadEnd` predicate, and the tests for all of it. The information
was already available: the undrawn lines are visible on the board, and dragging
back is the same gesture whether or not anything labelled it.

## 3. The whole game sliding under the finger on a phone

Reported as _"on a phone with a small screen the game does not scale, the whole
game just moves under the finger."_

Measured at 360 px wide: **the header's contents were 399 px in a 332 px box.**
The wordmark, three stats and three pill buttons did not fit, so the header
overflowed, the document became horizontally scrollable, and every drag that did
not start on the board panned the entire page. The board itself was scaling
correctly the whole time — the diagnosis in the report was the symptom, and the
cause was one row above it.

**Decision, in three parts:**

- **The header fits.** Below 440 px the wordmark drops to just the mark, the
  stat gaps and pills tighten; below 360 px the brand goes entirely. Measured
  339 px in 339 px.
- **The app shell is pinned.** `position: fixed; inset: 0` so mobile browser
  chrome appearing and disappearing cannot shift the game.
- **Chrome does not start gestures.** `touch-action: none` on the header and the
  dock, joining the board.

### Why `touch-action: none` is not on `body`

That was the first attempt and it is wrong. The effective touch-action is the
**intersection** of an element's value with every ancestor's, so `none` on the
body would have cancelled the level picker's own `touch-action: pan-y` and left
the grid unscrollable on touch — trading a fixed bug for a new one on exactly
the screens this was meant to help. Scoping it to the non-scrolling chrome gets
the same result without reaching across a scroll container.

## Consequences

**Positive**

- Nothing in the interface claims to do something it does not.
- The page cannot scroll in either axis at 360 px; verified, along with the
  picker keeping `pan-y`.
- Less code: one hook, one predicate, one palette entry, one CSS state and a
  block of tests gone.

**Negative**

- A player who stalls gets no explanation beyond the board itself. Judged the
  better trade: the explanation was flickering and unreliable.
- The brand mark disappears below 360 px. Acceptable — the game is the product,
  and at that width every pixel of header is taken from the board.
