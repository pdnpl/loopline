# ADR-0021: Progress is a shape, not a sentence

- **Status:** Accepted
- **Date:** 2026-08-13
- **Deciders:** autonomous agent, on a call from @ravwtar

## Context

The board carried a counter reading `5 linii zostało` / `5 lines left`.

Reported as: _"the user does not know which lines are meant — what is left?
Maybe it is really information about how many dots are left rather than lines.
Right now it is confusing."_

The wording was literally accurate — five edges of the figure were still
undrawn — and that is exactly the problem. It required the player to already
model the figure as a set of individually countable segments. Nothing in the game
teaches that. The player sees one continuous figure to trace, so a count of
"lines" invites the question _lines of what?_, and any answer needs vocabulary
the game never introduced.

## The suggested alternative is wrong, and worth recording

Counting **dots** instead would be a factual error, not a wording change.

A dot may be passed through many times; the win condition is edges, not vertices.
In a connected graph, tracing every edge visits every dot — but the reverse does
not hold, and it fails early: on a board with junctions a player typically
touches every dot long before drawing every line. A "dots left" counter would
therefore reach zero while the figure was visibly unfinished. It would not be
confusing, it would be lying.

## Decision

**Replace the sentence with a bar.**

- A slim track under the board fills as the figure is traced.
- A small `4/28` sits beside it for precision.
- **No noun appears on screen.** There is nothing left to misread.
- The words move to where they are needed and can afford to be explicit: the
  element is a `role="progressbar"` with `aria-label`, `aria-valuenow`,
  `aria-valuemax` and an `aria-valuetext` of _"narysowano 4 z 28 linii"_. A
  screen reader gets a full sentence in context; the sighted player gets a shape.

A bar is the right form because the question the player actually has is _"am I
close?"_, which is proportional. A count answers a question they were not
asking, in a unit they were not given.

The fill is a `transform: scaleX()` with a 160 ms transition — decoration that
softens a discrete step, never read back, in line with
[ADR-0005](0005-requestanimationframe-as-the-only-clock.md).

## Consequences

**Positive**

- Self-teaching: the fill grows as you draw, so the mapping needs no explanation.
- Language-independent on screen, which suits a bilingual UI
  ([ADR-0012](0012-accessibility-and-bilingual-ui.md)) — one less string to get
  right in two languages.
- `transform` on a 3 px bar is compositor work, cheaper than re-laying-out text.
- Better for assistive tech than before: a real progress role with a value,
  where there used to be two anonymous spans.

**Negative**

- A bar is less precise at a glance than a number, which is why the fraction
  stays. Two elements where there was one, though neither carries words.
- `4/28` is still, strictly, a fraction of something unnamed. Judged acceptable:
  a numerator over a denominator beneath a puzzle reads as progress without
  prompting the "of what?" that a noun invites.

## Alternatives considered

- **Keep a count, reword it** (`5 odcinków`, `pozostało: 5`). Trades one piece of
  unfamiliar vocabulary for another; "odcinek" is more precise and less familiar.
- **Count dots.** Wrong, as above.
- **Remove the readout entirely.** The undrawn lines are visible on the board, so
  this is defensible. Rejected because "one line to go" is worth knowing at a
  glance, and near the end the faint remainder is easy to miss.
- **Bar with no number.** Cleaner, but loses exactly the endgame precision that
  makes the readout worth having.

---

## Addendum, same day: weight, width and the frame

Follow-up feedback: _"enlarge the bar, make it the style and thickness of the
lines connecting the dots, roughly two thirds the width of the top panel — it is
very thin and almost invisible now. Move it away from the frame, make the
numerals as big as in the Levels button. And let us finally settle what that
frame is for — sometimes it is there, sometimes it disappears."_

**The bar.** 3 px was a hairline sitting on the board's edge. It is now 10 px
with rounded ends, filled with the canvas stroke's own three colour stops, so it
reads as the line you are tracing laid out flat rather than as generic chrome.
Width is `66%` of the board — the same box as the header above it. The numerals
move from 11 px to **16 px**, matching `.btn`, and from `--text-faint` to
`--text-dim`. Bottom offset 2 px → 18 px.

The fill animates `width` rather than `transform: scaleX()`. Scaling squashes the
rounded caps into ellipses — invisible on a 3 px hairline, obvious at 10 px. The
bar changes a handful of times per level, not per frame, so the layout cost is
nothing.

**The frame is now deliberate.** It was the board's `:focus-visible` outline,
which is why it appeared and vanished on focus heuristics with no relation to
game state — an accident being read as a feature. The board now carries a
permanent `box-shadow: inset 0 0 0 1px var(--border)`, matching the header and
dock panels so the three read as one system, and keyboard focus is a thicker
accent outline that is clearly a different thing.

An inset shadow rather than a `border` on purpose: the canvas is positioned
against this element's box and `computeLayout` reads its rect, so a real border
would put a pixel between the layout coordinates and the painted pixels.

It stays on the board rather than wrapping the whole game, as the report
wondered: the header and dock already have their own borders, and a frame around
everything would double up on them.
