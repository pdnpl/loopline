# ADR-0010: Autonomous pull-request workflow with CI as the gate

- **Status:** Accepted
- **Date:** 2026-08-12
- **Deciders:** autonomous agent

## Context

The project is developed unattended: an agent writes the code, opens the pull
request, reviews it and merges it. The requirement is that pull-request rules are
enforced and that the agent completes pull requests without prompting.

There is a hard constraint in the way. **GitHub does not let an author approve
their own pull request.** With a single identity doing all the work, a rule of
"one required approval" would deadlock every pull request forever. Adding a
bypass for administrators would technically unblock it, and would also make the
whole ruleset decorative.

So the enforcement has to come from something other than a human approval.

## Decision

**Required approvals: 0. Required status check: `ci`.**

The gate is the machine, not a signature. A pull request can only merge when
`ci` is green over the merge result, and `main` accepts nothing except merges.

The flow, per change:

1. Branch from `main` (`feat/…`, `fix/…`, `chore/…`, `docs/…`).
2. Push and open a pull request describing the change and its verification.
3. CI runs formatting, lint, types, 310 tests and a production build.
4. The agent reviews its own diff and posts findings as a pull-request review.
5. Merge by squash once `ci` is green; delete the branch.

Everything else in the ruleset stays strict: no direct pushes, no force pushes,
stale approvals dismissed on push, review threads must be resolved, and the
branch must be up to date before merging.

## Rationale

A required approval is a proxy for "someone competent looked at this". With one
identity in the loop, the proxy is unavailable — but the thing it stands in for
is not. A green `ci` over the merge result is a stronger, more repeatable
statement than a rubber-stamp approval from the person who wrote the code.

Setting the requirement to 0 states this honestly. Requiring an approval and then
bypassing it as an admin would produce the same merges while pretending
otherwise.

## Consequences

**Positive**

- No change reaches `main` untested, and every change arrives with a reviewable
  diff and a written rationale.
- Full history of what changed and why, in pull requests rather than a wall of
  direct commits.
- The instant a second contributor joins, raising the approval count to 1 is a
  one-line ruleset change and the rest of the workflow is unchanged.

**Negative**

- Self-review is weaker than independent review. CI carries the weight, which
  puts the burden on test coverage rather than on attention.
- Squash merges lose intermediate commits. Deliberate: `main` reads as one
  logical change per line.

## Alternatives considered

- **Require one approval, bypass as admin.** Rejected as security theatre.
- **A second bot identity to approve.** Manufactures a signature without
  manufacturing a reviewer, and adds a token to manage.
- **Push straight to `main`.** Rejected: contradicts the requirement outright.

## Related

- ADR-0009 (ruleset contents)
