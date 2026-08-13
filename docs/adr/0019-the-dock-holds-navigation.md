# ADR-0019: The dock holds navigation, not a second retry button

- **Status:** Accepted
- **Date:** 2026-08-13
- **Deciders:** autonomous agent, on a design call from @ravwtar
- **Supersedes:** decision 1 of [ADR-0018](0018-a-label-is-a-promise.md)

## Context

ADR-0018 renamed the dock button from `Od nowa` to `Powtórz poziom`, so its label
would stop promising a full game reset. That fixed the promise. It did not ask
whether the button was worth having.

@ravwtar did: _"this button makes no sense, because every failure already starts
the level from the beginning anyway. I would expect a button for going back to a
specific level."_

That is correct, and it is the sharper diagnosis.

**Restarting a level is already covered, three times over.** Lifting off mid-run
raises the failure overlay, whose primary action — and a tap anywhere — retries.
Solving raises the solved overlay, which offers a replay. The `R` shortcut works
from anywhere. A player never has to reach for the dock to restart a level.

**And during a pointer run they cannot.** Reaching for the dock means lifting the
finger, which ends the run and raises the overlay that covers the dock. The
button is unreachable in exactly the state where restarting is the thing you
want.

So the most valuable piece of screen real estate the game has — the thumb zone —
held a control that duplicated an existing path and could not be pressed when it
mattered.

**Meanwhile the actual gap stayed open.** ADR-0018 added a reset to level 1 and
noted a level picker as "a feature, not a defect". That was the wrong call: a
game that stores progress per level, records a best time per level, and lets a
player stall indefinitely on one board needs a way to reach a specific level. The
alternative on offer — erase everything and replay from 1 — is a demolition,
not navigation.

## Decision

**The dock button opens a level picker.** `Poziomy` / `Levels`.

- A grid of every level from 1 up to the highest reached. Any of them is
  playable; nothing is locked behind the level you are stuck on.
- The current level is marked, and levels with a recorded best time are marked
  as solved, so the grid doubles as a progress view.
- Choosing a level loads it and closes the picker. Choosing a lower level does
  **not** lower the unlocked ceiling — going back to level 3 leaves level 8 still
  reachable.
- **`Zacznij grę od nowa` moves here**, next to the progress it erases, instead
  of sitting behind the help button. It keeps its two-press confirmation.

The chips stop their `pointerdown` from reaching the tap-anywhere veil, but do
not call `preventDefault` — that distinction is the whole of ADR-0018 decision 3,
and applies to every control inside the overlay.

## Consequences

**Positive**

- The thumb zone now holds the one thing that had no route at all.
- No level is a dead end; being unable to solve one costs nothing.
- Best times become worth chasing, because the levels holding them are reachable.
- The destructive reset sits with the data it destroys rather than in the help
  screen.

**Negative**

- The picker grows with progress. It scrolls, capped at 42vh, which is fine for
  the level counts a session realistically reaches and would want revisiting at
  a few hundred.
- No pointer-reachable restart during keyboard play any more. `R` covers it, is
  bound at the document, and is advertised on the help screen — and picking the
  current level in the grid restarts it too.

## Alternatives considered

- **Keep `Powtórz poziom` and add the picker elsewhere.** Two controls where one
  is redundant, and the redundant one keeps the better position.
- **Make the header's level number the picker's trigger.** A reasonable
  affordance, but it is small, top-of-screen and far from the thumb; the dock was
  already there and already wasted.
- **Remove the dock entirely** and give the space to the board. Tempting after
  ADR-0018, and it would have left the level gap open.
- **Lock levels above the highest solved.** Rejected: the player in the report
  had reached level 8 without solving it, and locking would have been the trap
  this record exists to remove.
