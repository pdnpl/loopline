# Contributing

## Branch rules

`main` is protected by a repository ruleset with **no bypass actors** — the rules
apply to administrators and automation too.

- No direct pushes, force pushes or branch deletion.
- Every change arrives through a pull request.
- The `ci` status check must pass over the merge result.
- The branch must be up to date with `main` before it can merge.
- Review threads must be resolved.

Required approvals are set to **0** on purpose, not by oversight. The project is
maintained by a single identity, and GitHub does not allow self-approval, so a
non-zero requirement would deadlock every pull request. The gate is CI instead of
a signature — the reasoning is in
[ADR-0010](docs/adr/0010-autonomous-pull-request-workflow.md). Raise it to 1 the
day a second maintainer appears.

## Workflow

```bash
git switch -c feat/short-description
# ... work ...
npm run verify          # exactly what CI runs, in the same order
git push -u origin feat/short-description
gh pr create --fill
```

Branch prefixes: `feat/`, `fix/`, `chore/`, `docs/`, `perf/`, `refactor/`.

Merge with **squash**, then delete the branch. `main` reads as one logical change
per line.

## Before you open a pull request

`npm run verify` runs, in order: Prettier check → ESLint → `tsc --noEmit` →
Vitest → production build. If it passes locally it will pass in CI; the workflow
runs the same steps on the same Node version pinned in `.nvmrc`.

## Standards

- **TypeScript strict.** No `any`, no non-null assertions — both are lint errors.
- **`core/` stays pure.** No DOM, no canvas, no browser globals in `src/core/`.
  That boundary is what makes the puzzle logic exhaustively testable.
- **Test what can break silently.** Puzzle generation, the stroke model and
  storage parsing all have failure modes a player would never report clearly.
- **Comment the "why".** The code says what it does; comments explain what a
  reader could not have worked out, especially tuned constants.

## Architecture decisions

Anything non-obvious gets an ADR in `docs/adr/`, numbered sequentially, following
the format in [ADR-0001](docs/adr/0001-record-architecture-decisions.md).
Records are immutable once accepted — reverse one by writing a new record that
supersedes it.

If a pull request contradicts an accepted ADR, it needs a new ADR alongside it.
