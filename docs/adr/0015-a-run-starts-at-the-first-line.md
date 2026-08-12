# ADR-0015: A run starts at the first line, not at the first touch

- **Status:** Accepted — decision 2 superseded by [ADR-0016](0016-restart-always-answers.md)
- **Date:** 2026-08-13
- **Deciders:** autonomous agent, prompted by a bug report from @ravwtar
- **Refines:** [ADR-0013](0013-stroke-model-and-fast-retry.md)

## Context

ADR-0013 states the rule plainly: lifting the finger ends the run. Taken
literally, that made three things wrong in play.

**Touching a dot to see what happens was punished.** Press a dot, change your
mind, let go — "You lifted off", a failed run, and a tick on the counter that
decides when to hint at the valid opening dots. Working out where a solution can
begin is the actual puzzle on most boards, and the game was charging for looking.

**The Restart button in the dock could never do anything.** It is reachable only
while the overlay is down, which means only before a stroke exists — and with
nothing drawn, pressing it clears nothing. During a pointer run it cannot be
reached at all, because reaching for it means lifting off, which ends the run
before the press lands. A player who pressed it saw a button that did nothing,
twice over. This is what was reported.

**A solved level could not be replayed.** The board tracks a best time per level,
but the solved screen only offered "Next level". The one number the game asks you
to chase was unchaseable.

## Decision

Distinguish **"nothing is drawn"** from **"a run is in progress"**, and make
every affordance follow that distinction.

1. **Lifting off with no committed line is a silent reset, not a failure.** The
   board returns to its opening state, the clock returns to zero, and the failure
   count is untouched. This also covers dragging every line back off again before
   letting go — if there is nothing drawn, there is nothing to lose.
2. **The dock's Restart button is disabled while nothing is drawn.** It enables
   itself on the first committed line. A control that cannot do anything should
   look like it cannot do anything.
3. **The solved screen gains a secondary action, "Beat this time".** It replays
   the level just finished instead of moving on.

The one-stroke rule itself is unchanged: once a line is drawn, lifting off still
ends the run. Only the definition of when a run has _begun_ is stated more
precisely.

## Consequences

**Positive**

- Exploring the board is free, which is how the puzzle is meant to be worked out.
- No control in the interface can be pressed to no effect.
- The best time is reachable, so the stopwatch has a point beyond decoration.
- The hint counter now measures real failures, so hints arrive when a player is
  genuinely stuck rather than after three exploratory taps.

**Negative**

- The dock button is disabled for most of a touch player's session, since a
  pointer run cannot reach it. That is honest rather than good: it is a control
  that mainly serves keyboard play, and it now says so.
- One more branch in the pointer-release path, covered by tests.

## Alternatives considered

- **Leave the rule literal and accept the dead button.** Rejected — this is the
  bug that was reported.
- **Hide the Restart button when it is unusable.** It is the only child of the
  dock, so hiding it collapses the row, resizes the board and re-runs layout
  mid-stroke. Disabling keeps the geometry still.
- **Let the finger lift without ending the run.** That would remove the only
  constraint the game has.
- **Put replay in the dock instead of on the solved screen.** The overlay covers
  the dock at exactly the moment replay is wanted.
