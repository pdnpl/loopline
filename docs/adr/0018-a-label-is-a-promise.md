# ADR-0018: A label is a promise, and a press must be unmistakable

- **Status:** Accepted
- **Date:** 2026-08-13
- **Deciders:** autonomous agent, after a fourth report from @ravwtar
- **Refines:** [ADR-0013](0013-stroke-model-and-fast-retry.md), [ADR-0016](0016-restart-always-answers.md)

## Context

"The Restart button does not work" was reported four times. Three rounds of fixes
went at the mechanism — a disabled state, an acknowledgement pulse, a throwing
`setPointerCapture` — and each time the button provably worked afterwards, and
each time the report came back unchanged.

The fourth report carried the detail that settled it: _"the computer was off, and
after opening this page the game state from yesterday is still there, the button
still does not work."_ Two complaints in one breath, and they were the same
complaint. A screenshot confirmed the state: **level 8, no personal best, clock
at zero, nothing drawn.**

Measured in that exact state, one press changed **nothing** in the DOM. Not the
level, not the clock, not the record, not the counter. The only effect was a
250 ms swell of grey dots on a dark board.

The button was working perfectly, and the report was correct. Both, at once.

## The actual defect

**`Od nowa` promises a full game reset.** In Polish, applied to a game, it means
_start the game again from the beginning_ — not _reset this attempt_. The player
was on a level they had never solved, with no way past it and no way back, and
they pressed the one control whose name says "start over". It cleared a board
that was already clear.

Worse, the promise had nowhere legitimate to land: **the game had no way to
return to level 1, no way to skip a level, and no way to clear stored progress.**
An unsolved level was a dead end with the exit sign pointing at a wall.

Five independent audits of the codebase converged on this from four different
angles, and turned up four further reasons the control read as dead.

## Decision

**1. The label states its scope.** `Od nowa` → **`Powtórz poziom`**; `Restart` →
**`Restart level`**. The button clears the board of the level you are on, and now
says exactly that.

**2. The promise gets a real home.** A **`Zacznij grę od nowa`** action, behind
the help button, resets to level 1 and erases best times. It keeps language and
theme — starting the game over should not undo settings a player chose
deliberately. Being destructive, it takes two presses: the first turns the label
into a question.

**3. `preventDefault()` comes off the dock button's `pointerdown`.** It
suppressed the compatibility mouse events, and took the button's own `:active`
press state and focus with them. The control literally stopped looking pressed.
The dock is not on the fast-retry path — that is the overlay (ADR-0013) — so
plain `click` is right here.

**4. The activation guard becomes per-control and drops from 300 ms to 60 ms.**
One shared stopwatch meant dismissing an overlay silenced the next Restart press,
and — the vicious part — **pressing a seemingly-broken button again immediately
was itself discarded**, so the natural way to test a control was the thing that
stopped it working. It also initialised to `0` while `performance.now()` is
page-relative, so every activation in the first 300 ms of a page's life was
dropped.

**5. The dock hides while an overlay is up.** The veil sits above it and swallows
presses aimed at it; on the solved screen such a press advanced a level instead.
A visibly pressable control that cannot be pressed is worse than no control.

**6. Restart no longer steals focus back to the board.** That made the board's
focus ring blink on every press — which the player reported as the only visible
effect — and meant a second `Enter` went nowhere. `R` is now bound at the
document as well, so the shortcut the help screen advertises works wherever focus
happens to be.

**7. The board fills its space.** `MAX_UNIT` 132 → 190 and the padding factor
0.10 → 0.07. A 4×4 board covered under a third of the available area on a laptop
and read as an unfinished screen; it is now roughly half.

## Consequences

**Positive**

- The name and the effect match, so the press can no longer be misread.
- An unsolved level is no longer a dead end.
- Every reason the control could feel unresponsive is gone, not just the one
  reported.

**Negative**

- Progress can now be destroyed. Guarded by a confirmation, kept off the board,
  and it never touches language or theme.
- `Powtórz poziom` is a longer label than `Od nowa` in a tight dock.

## What went wrong in the first three rounds

Each round asked _"why does the button not work?"_, verified that it did, and
shipped a mechanical hardening. None asked **"what does the player think this
button is for?"** The evidence was there from the first report — the label — and
it took a screenshot of a stranded level 8 to make it visible.

Worth keeping: when a report survives a fix that provably works, the fault is in
the question. **A control that does exactly what it should, and nothing the
player can see, is indistinguishable from a broken one.**
