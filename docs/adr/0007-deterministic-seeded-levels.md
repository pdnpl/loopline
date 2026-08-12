# ADR-0007: Deterministic seeded levels and a formula-based difficulty curve

- **Status:** Accepted
- **Date:** 2026-08-12
- **Deciders:** autonomous agent

## Context

Levels are generated at runtime (ADR-0006). Two things follow from that and need
deciding: whether level 7 is the same board on every device, and where the
sequence stops.

`Math.random()` would make level 7 a different board on every load. That breaks
personal best times — a record is meaningless if the board behind it changes —
and it makes the generator untestable, because a test that passes on one run
tells you nothing about the next.

## Decision

**Determinism.** All randomness flows through a seeded `mulberry32` generator.
A level's seed is `xmur3("loopline:v1:level-N:attempt-K")`. Level N is therefore
the same board on every device, every browser and every test run.

**Curve as formula, not list.** Difficulty is computed from the level number:

| Dial              | Rule                                                        |
| ----------------- | ----------------------------------------------------------- |
| Lines to draw     | `min(30, 4 + level)` — one more per level, flattening at 30 |
| Grid size         | Steps 3×3 → 4×3 → 4×4 → 5×4 → 5×5 → 6×5 as levels climb     |
| Diagonals         | From level 7                                                |
| Minimum junctions | 0 → 1 → 2 → 3 across the first dozen levels                 |

The game therefore never runs out of levels.

## Rationale for the ceiling

Past about 30 lines a board stops getting harder and starts getting tedious: the
difficulty comes from holding the whole figure in your head, and beyond that
point the limit is patience rather than insight. Levels above 26 keep growing
the grid and the junction count while holding the line count, so the boards get
sparser and more ambiguous rather than merely longer.

## Consequences

**Positive**

- Best times are comparable, because the board is fixed.
- The generator is testable: the suite asserts that levels 1–60 are solvable,
  connected, free of duplicate and crossing edges, and byte-identical across two
  generations.
- The `v1` namespace in the seed string means the curve can be re-tuned later
  under `v2` without silently invalidating stored records.

**Negative**

- Every player sees the same boards, so solutions can be shared. For a
  brain-training puzzle with no leaderboard, that is not a threat.
- The curve is tuned by reasoning rather than telemetry, since the game collects
  none (ADR-0011).

## Alternatives considered

- **Unseeded random.** Rejected: no stable records, no repeatable tests.
- **A fixed hand-authored list.** Finite, and it makes the "unsolvable level"
  risk a human review problem.
