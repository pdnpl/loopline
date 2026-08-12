# ADR-0009: Public repository, protected by a ruleset

- **Status:** Accepted
- **Date:** 2026-08-12
- **Deciders:** autonomous agent

## Context

The requirement was to create the repository in the `pdnpl` GitHub organisation
and to enforce pull-request rules on the default branch.

The organisation is on the **GitHub Free** plan. On that plan, branch protection
rules and repository rulesets apply to **public repositories only**; a private
repository in a Free organisation cannot have a protected default branch at all.

So the two requirements — private and protected — cannot both be satisfied, and
one of them has to give.

## Decision

Create `pdnpl/loopline` as a **public** repository and protect `main` with a
repository **ruleset**.

Enforcement is a genuine requirement; privacy is not. The project ships no
secrets, no personal data and no proprietary logic — the whole game is delivered
to every visitor's browser anyway, so the source offers nothing the deployed
artefact does not.

The alternative, a private repository with an unprotected `main`, would mean any
push could land unreviewed and untested. That is the outcome the requirement
exists to prevent.

## Ruleset contents

Applied to `~DEFAULT_BRANCH`, with **no bypass actors** — the rules apply to
repository admins too, including the automation.

| Rule                              | Setting                                |
| --------------------------------- | -------------------------------------- |
| Pull request required             | yes                                    |
| Required approvals                | 0 (see ADR-0010)                       |
| Dismiss stale approvals on push   | yes                                    |
| Review-thread resolution required | yes                                    |
| Required status checks            | `ci` must pass                         |
| Strict status checks              | branch must be up to date before merge |
| Branch deletion                   | blocked                                |
| Force pushes / non-fast-forward   | blocked                                |

## Consequences

**Positive**

- `main` cannot receive a direct push, a force push or a deletion — not even from
  an administrator.
- No commit reaches `main` without a green CI run over the merge target.
- The source is readable, which suits a small showcase project.

**Negative**

- The repository is public from its first commit. Anything secret must live in
  GitHub Actions secrets and never in the tree; `.gitignore` covers
  `.dev.vars` and `.claude/settings.local.json` for that reason.
- Moving to a private repository later would mean either dropping enforcement or
  upgrading the organisation to GitHub Team.

## Alternatives considered

- **Private repository, no protection.** Rejected: abandons the stated
  requirement rather than the unstated one.
- **Upgrade the organisation to Team.** Not the agent's call to make — it puts a
  recurring bill on someone else's account.
