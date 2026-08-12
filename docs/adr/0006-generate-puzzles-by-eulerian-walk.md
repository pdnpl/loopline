# ADR-0006: Generate boards by walking a trail, never by repairing a graph

- **Status:** Accepted
- **Date:** 2026-08-12
- **Deciders:** autonomous agent

## Context

The puzzle is Euler's: draw a figure in one stroke, using every line exactly
once. Such a trail exists in a connected graph if and only if it has zero or
exactly two vertices of odd degree — the result Euler proved in 1736 for the
seven bridges of Königsberg.

An unsolvable level is the worst possible bug in this game. The player has no
way to tell "I cannot see it" from "it cannot be done", so the failure is
invisible, unreportable and corrosive to trust.

The obvious generator — scatter edges on a grid, then check the parity condition
and patch it up by adding or removing edges — is where that bug comes from. The
repair step can break connectivity, the connectivity fix can break parity, and
the loop between them is where a bad board slips out.

## Decision

Build the board **by walking it**.

Start on a random grid dot and repeatedly step to a neighbour along an edge not
yet used, until the target edge count is reached. The set of edges walked over
_is_ the board.

That walk is itself an Eulerian trail over the graph it just produced, so the
board is solvable by construction. Connectivity is likewise automatic: every
edge was reached from the previous one.

There is no validation step that can be wrong, because there is no validation
step.

## Implementation notes

- **Steering.** Each candidate step is weighted by how many unused exits the
  neighbour still has, so the walk avoids painting itself into a corner before
  reaching the edge target.
- **Retries.** If a walk strands itself early, the generator retries with a new
  attempt seed. After 30 failed attempts it relaxes the edge target by one, so a
  hostile seed degrades to a slightly smaller board rather than failing.
- **Diagonals occupy a cell.** At most one diagonal per grid cell, so the two
  diagonals of a square can never cross — visually messy, and ambiguous to draw
  through.
- **Trim and renumber.** The walked board is cropped to its bounding box, so a
  small figure is not stranded in the corner of a large grid.
- **Quality floor.** Boards must contain a minimum number of junctions (dots with
  three or more lines). Without junctions there are no decisions, and it is a
  drawing exercise rather than a puzzle.
- **Belt and braces.** The generator still runs Hierholzer's algorithm over the
  finished board and rejects it if no trail is found. That check should be
  unreachable; it exists to catch a regression in the trimming step, not a
  regression in the theory.

## Consequences

**Positive**

- No level can ever ship unsolvable. The test suite verifies levels 1–60 by
  finding an actual Eulerian trail from every valid starting dot.
- The generator is short and has no repair loop to reason about.

**Negative**

- Difficulty is steered indirectly, through edge count, grid size, diagonals and
  junction count, rather than dialled in exactly.
- A walk can strand itself, so generation is a retry loop rather than a single
  pass. It costs under a millisecond per level.

## Alternatives considered

- **Random graph plus parity repair.** The approach this ADR exists to reject.
- **Hand-authored levels.** Highest quality per board, but finite, and it moves
  the "is this solvable?" risk onto a human.

## Related

- ADR-0007 (determinism and the difficulty curve)
