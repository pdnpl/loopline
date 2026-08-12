# ADR-0016: Restart always answers the press

- **Status:** Accepted
- **Date:** 2026-08-13
- **Deciders:** autonomous agent, prompted by a second bug report from @ravwtar
- **Supersedes:** decision 2 of [ADR-0015](0015-a-run-starts-at-the-first-line.md)

## Context

ADR-0015 dealt with a report that the dock's Restart button did nothing. Its
second decision was to **disable** the button while there is nothing drawn, on
the reasoning that a control which cannot do anything should look like it cannot
do anything. That record admitted the cost in its own consequences: "the dock
button is disabled for most of a touch player's session... That is honest rather
than good."

It was reported again. Honest was not good enough, and the reasoning had the
user model backwards.

**A greyed-out control does not read as "nothing to do". It reads as broken.**
Especially so here, where the disabled state is the one a touch player sees
almost the whole time — a pointer run cannot reach the dock, so for that player
the button is permanently grey and permanently useless. Every part of the fix
was correct except the part the player actually looks at.

## Decision

**The Restart button is never disabled.** Pressing it always runs, in every
state.

To make that truthful rather than merely permissive, a restart now **answers the
press**: every dot on the board pulses once, and the device gives a short haptic
tick. On a board with lines drawn, they clear as before. On an untouched board no
state changes — but the board visibly acknowledges that it was reset, so the
press is never met with silence.

The distinction ADR-0015 drew between "nothing drawn" and "a run in progress"
still holds everywhere else; its decisions 1 and 3 stand unchanged. Only the way
that distinction was surfaced on this one control is reversed.

## Rationale

Restarting an untouched board is idempotent and harmless. There is no state to
protect, so there is nothing for a disabled state to protect the player from — it
was guarding against a no-op, at the cost of making the interface look faulty.

Given a control whose action is harmless, "always allow it and confirm it ran"
beats "sometimes forbid it and explain why" every time. The confirmation is not
decoration: it is the difference between a button that did nothing and a button
that did nothing _visible_, which the player has no way to tell apart otherwise.

## Consequences

**Positive**

- Nothing in the interface is ever greyed out, so nothing can be mistaken for
  broken.
- Every press of every control produces a visible response.
- Less code: the enabled/disabled plumbing between `Game`, `main` and `Hud` is
  gone, along with the `:disabled` styling.

**Negative**

- Pressing Restart on an untouched board runs a reset that changes nothing. The
  cost is a pulse animation and one hook call.
- The pulse is a frame-loop effect, so it is invisible in a backgrounded tab.
  Irrelevant — so is the rest of the game.

## Alternatives considered

- **Keep it disabled** — the position this record reverses. Reported twice.
- **Remove the dock button entirely.** Tempting: for a touch player it is
  redundant with the failure overlay, which already retries on a tap anywhere.
  Rejected because it is the only pointer-reachable restart for keyboard play,
  and dropping it would leave `R` as the sole route — a shortcut a player has to
  have read and remembered.
- **Repurpose the slot when idle** (a hint button, say). Rejected: a control
  whose label changes under the thumb is a worse problem than the one being
  solved, and hints already appear on their own after three real failures.
