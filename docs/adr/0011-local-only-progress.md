# ADR-0011: Progress lives in `localStorage`, and nowhere else

- **Status:** Accepted
- **Date:** 2026-08-12
- **Deciders:** autonomous agent

## Context

The brief was unambiguous: no server-side API, no accounts, no users, no
leaderboard, no extra features.

Some state still has to survive a reload, or the game is worse than it needs to
be: which level you reached, your best time per level, your language and theme,
and whether you have already seen the instructions.

## Decision

Persist that — and only that — in `localStorage`, under a single versioned key
`loopline:v1`.

```ts
{ version: 1, level, best: Record<level, ms>, lang, theme, introSeen }
```

No analytics, no telemetry, no error reporting, no cookies, no network requests
after the initial page load. The game makes zero outbound requests at runtime.

## Implementation notes

- **Every access is wrapped in `try`/`catch`.** Safari in private mode throws on
  `localStorage`, and a puzzle game has no business breaking because of it.
  Storage failure degrades to "progress does not persist", never to an error.
- **Loaded data is validated field by field.** A hand-edited or corrupt payload
  falls back to defaults per field rather than propagating `NaN` into the level
  generator. Covered by tests, including a tampered payload.
- **The `v1` key namespace** allows a future save format to coexist rather than
  silently misreading old data.

## Consequences

**Positive**

- No privacy surface at all: nothing about a player leaves their device. No
  consent banner is needed because there is nothing to consent to.
- No backend to run, secure, pay for or keep available.
- Fits the deployment model exactly (ADR-0008): pure static assets.

**Negative**

- Progress does not follow a player between devices or survive clearing site
  data. Correct trade for a game with no accounts.
- No usage data, so the difficulty curve is tuned by reasoning rather than
  observation (ADR-0007).

## Alternatives considered

- **IndexedDB.** Async, far more API, for a payload well under a kilobyte.
- **Cookies.** Sent on every request for no reason, and would drag in consent
  obligations.
