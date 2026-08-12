# ADR-0013: The stroke model — projection, hysteresis, and a retry under the thumb

- **Status:** Accepted
- **Date:** 2026-08-12
- **Deciders:** autonomous agent

## Context

Everything the game feels like lives in one function: how a finger position turns
into a drawn line. Three questions had to be settled, and each has a wrong answer
that feels bad rather than one that is incorrect.

1. Does the line snap between dots, or follow the finger?
2. Can a move be taken back?
3. What happens when the finger lifts before the figure is finished?

The brief added a fourth, about the moment after a loss: adults playing a quick
game want the next attempt in a fraction of a second, with the retry control
already under the thumb.

## Decision

**The tip follows the finger along an edge.** On each pointer sample, the pointer
is projected onto the candidate edge and the tip is drawn at that projection. The
edge commits at 88 % of its length. The line therefore grows continuously out of
the dot rather than appearing all at once, and the player can see a move being
considered before it is made.

Edge selection is by direction, not distance: among unused edges leaving the
current dot, the one whose direction best matches the finger's, above a ~70°
tolerance. Grid neighbours are 45° apart, so this is forgiving without being
ambiguous.

**Dragging back undoes.** Pulling back along the last committed line retracts it.
The stroke stays unbroken — nothing was lifted — so this does not violate the
one-stroke rule; it just means the rule is enforced on the finger, not on the
player's memory.

**Lifting the finger ends the run.** That is the game. `pointerup`,
`pointercancel` and `lostpointercapture` all count.

## The hysteresis, and the bug it prevents

Commit and undo cannot share a threshold. The first implementation committed an
edge at 88 % and allowed undo whenever the finger pointed backwards — so a finger
resting just past a dot sat exactly on the boundary: the edge commits, the
pointer is now behind the new dot, the undo rule fires, the edge un-commits, and
the stroke flickers between the two states on every frame.

Undo therefore requires the finger to come back to **78 %** of the edge. The gap
between 78 % and 88 % is a dead band in which neither rule fires. In practice it
means about a fifth of a line of deliberate backward travel before a move is
taken back — enough that it never happens by accident.

There is a regression test named after this.

## Fast retry

- Runs end **immediately**: completion is detected mid-drag, so a solved board
  does not wait for the finger to lift.
- The failure overlay's primary action sits in the **lower third** of the screen,
  where a thumb already is, rather than centred.
- The overlay reacts to **`pointerdown`, not `click`** — on contact, not release.
- **Tapping anywhere** on the overlay retries; the button is for those who want a
  target, not a requirement.
- A persistent Restart button sits in the same thumb zone during play.
- Restart reuses the same board and resets the clock. No confirmation dialog.

## Consequences

**Positive**

- The stroke feels analogue rather than grid-snapped.
- Undo removes the frustration of a single misdrag without weakening the rule.
- Getting from a failed run to the next attempt is one touch, anywhere.

**Negative**

- Undo makes the game more forgiving than a strict reading of "one stroke". A
  deliberate trade: the constraint that matters is not lifting the finger.
- The thresholds (88 %, 78 %, 70°, 7 px deadzone) are tuned by judgement. They
  are named exported constants so they can be re-tuned without hunting.

## Alternatives considered

- **Snap between dots on proximity.** Simpler, and it feels like a menu rather
  than a drawing.
- **No undo.** Purer, and it turns one slip into a full restart — which pushes
  hard against the fast-retry goal from the other side.
- **Lifting pauses instead of ending.** Removes the only real constraint the
  game has.
