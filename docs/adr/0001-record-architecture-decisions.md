# ADR-0001: Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-08-12
- **Deciders:** autonomous agent, ratified by @ravwtar

## Context

Loopline is built and maintained largely without a human in the loop. Decisions
that feel obvious while the code is being written — why Canvas and not SVG, why
Pointer Events and not `touchstart`, why the level generator can never emit an
unsolvable board — are exactly the ones a future reader will want to overturn
first, and exactly the ones with the least surviving context.

## Decision

Every non-obvious technical decision is recorded as a numbered, immutable
Architecture Decision Record in `docs/adr/`, following Michael Nygard's format.

- Files are named `NNNN-kebab-case-title.md`, numbered sequentially.
- A record is never edited once accepted, apart from its status line.
- Reversing a decision means writing a new ADR that supersedes the old one; the
  superseded record gets `Status: Superseded by ADR-XXXX`.
- Statuses in use: `Proposed`, `Accepted`, `Superseded by ADR-XXXX`, `Deprecated`.

## Consequences

**Positive**

- The reasoning behind the codebase survives independently of any one session.
- A pull request that contradicts an accepted ADR is visibly a bigger change
  than a code diff alone would suggest.

**Negative**

- Small overhead per decision, and a standing risk that records drift out of
  date. The immutability rule is what keeps that from becoming quiet fiction:
  records are historical statements, not living documentation.

## Alternatives considered

- **Comments in code only.** Good for local "why", useless for cross-cutting
  choices that no single file owns.
- **A wiki.** Detached from the repository, so it goes stale without review.
