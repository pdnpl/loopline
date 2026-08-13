# ADR-0017: Optional platform APIs must fail soft

- **Status:** Accepted
- **Date:** 2026-08-13
- **Deciders:** autonomous agent, from a bug report by @ravwtar
- **Related:** [ADR-0004](0004-pointer-events-for-input.md), [ADR-0005](0005-requestanimationframe-as-the-only-clock.md)

## Context

Reported: the board stopped responding — the Restart button visibly reacted, but
the game would not start again.

Driving the real page from a console handle turned up three separate defects,
and they were all the same mistake wearing different clothes: **an optional
browser API was treated as guaranteed, and its failure took the whole game down
silently.** No error surfaced, nothing logged, the board simply stopped
answering.

**`setPointerCapture()` throws.** It rejects a pointer that is no longer active
by the time the handler runs — a fast tap, a pointer cancelled by the system, a
detached element. `onPointerDown` assigned `this.pointerId` _before_ calling it,
so a throw escaped the handler with the pointer id still claimed. Every later
touch then hit the `if (this.pointerId !== -1) return` guard and was discarded as
"already drawing". One throw, and pointer input was dead for the rest of the
session. This is the reported bug.

**`getCoalescedEvents()` returns an empty list.** Specified for untrusted events,
and it is also what browsers restricting high-frequency input return. The code
used it as the sole source of pointer samples, so an empty list meant zero
samples processed and the stroke never followed the finger at all.

**`ResizeObserver` does not fire while the page is hidden.** Its callbacks are
delivered as part of the rendering steps, and a hidden page runs none. A board
first laid out while the tab was in the background — restored session, opened in
a background tab, prerendered — kept that zero size permanently, because the one
thing that would have corrected it was the observer that never ran.

## Decision

**Every optional platform API gets a defined behaviour when it fails, and that
behaviour keeps the game playable.**

| API                                           | Failure                  | Fallback                                                              |
| --------------------------------------------- | ------------------------ | --------------------------------------------------------------------- |
| `setPointerCapture`                           | throws                   | catch and play on; the stroke simply is not tracked outside the board |
| `releasePointerCapture` / `hasPointerCapture` | throws                   | catch; the pointer is already gone, which was the goal                |
| `getCoalescedEvents`                          | returns `[]`             | use the event itself, the sample it stands for                        |
| `ResizeObserver`                              | never fires while hidden | also recompute on `visibilitychange` and `pageshow`                   |

Two supporting rules, both of which the original code broke:

1. **Set up state before calling anything that can throw.** The capture call now
   runs last, after the run is fully started, so a throw cannot leave the game
   half-initialised.
2. **Never leave a claim behind on a failure path.** `pointerId` marks input as
   owned; anything that claims it must guarantee release.

## Consequences

**Positive**

- No single browser quirk can silently brick input.
- Degradation is now visible in the right place: without capture a stroke ends
  when the finger leaves the board, which is a small behavioural difference, not
  a dead game.
- Four regression tests under "surviving a hostile browser" drive each failure
  deliberately — capture refused, empty coalesced list, hidden-at-load layout.

**Negative**

- Three `catch` blocks that do nothing. They read as sloppy and are not: each one
  has a comment saying which failure it absorbs and why ignoring it is correct.
- The fallbacks cannot be exercised by ordinary use, so only the tests keep them
  honest.

## Note on how this was found

None of the three was visible from reading the code, and the existing unit tests
passed throughout — they used a stub whose `setPointerCapture` never threw and
whose events carried no `getCoalescedEvents` at all, so they exercised the happy
path of both APIs and nothing else.

They were found by driving the actual page: `src/main.ts` exposes
`window.loopline` behind `import.meta.env.DEV`, so the game can be stepped
through from a console on a real board. The guard is statically false in a
production build and the handle is dropped at bundle time — verified against
`dist/`.

The lesson worth keeping: **a test stub that only models the API working is a
test that the API works.** The stub now takes a `captureThrows` option and a
`withEmptyCoalesced` wrapper, because the failure modes are the part that needed
covering.
