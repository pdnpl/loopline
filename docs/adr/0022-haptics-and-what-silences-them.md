# ADR-0022: Haptics, and the three things that silence them

- **Status:** Accepted
- **Date:** 2026-08-13
- **Deciders:** autonomous agent, from a report by @ravwtar

## Context

Reported: _"why does vibration not work on the phone — did you not plan for it,
or is there a bug?"_

Both, in different parts. The feature was there and guarded, the durations were
wrong, and one platform was never going to work at all.

## The three causes, separated

**1. iOS has never implemented the Vibration API.** `navigator.vibrate` is
undefined in Safari on iPhone, and always has been. The capability check meant
the game degraded silently rather than throwing, which is correct — but silent
degradation on a whole platform is something a reader should be told, not left
to discover.

**2. Android honours the system "vibrate on touch" setting.** With it off the
call succeeds, returns `true`, and produces nothing. There is no way to detect
this from script: a successful call and a silent motor are indistinguishable.

**3. The durations were too short, and cancelled each other.** This was ours.
The per-line tick was **6 ms**. A phone's vibration motor needs spin-up time, and
sub-10 ms requests are commonly rounded away by the hardware. Worse, a vibration
request **cancels whatever is currently playing** — so drawing at any speed
re-issued the 6 ms tick before the previous one could render. A stream of
cancellations that added up to silence, on the most frequent haptic in the game.

## Decision

**Durations long enough to render:**

| Event          | Was            | Now                |
| -------------- | -------------- | ------------------ |
| Line committed | 6 ms           | **15 ms**          |
| Restart        | 8 ms           | **22 ms**          |
| Run ended      | 26 ms          | **40 ms**          |
| Solved         | `[14, 40, 22]` | **`[22, 45, 34]`** |

**A tick never cuts short a tick already playing.** `haptic()` takes a minimum
gap; the per-line tick passes `HAPTIC_TICK_MS + 8`, so a pulse always completes.
The events that should always win — solve, fail, restart — pass `0` and are
allowed to replace whatever is running, which is the right precedence: finishing
a level should interrupt a line tick, never the reverse.

**The platform limits are documented** in the source, the README and here, so
"vibration does not work" resolves to a checklist rather than a bug hunt.

## Consequences

**Positive**

- The haptic that fires most often is now one the hardware can actually produce.
- Rapid drawing produces a steady tick rather than silence.
- Four regression tests: the tick's floor duration, the anti-cancel gap, the
  precedence of important events, and that a missing API is a no-op rather than
  a throw.

**Negative**

- 15 ms is a judgement, not a measurement — it cannot be verified from here, only
  on a device with a motor. It sits comfortably above the ~10 ms floor where
  hardware starts rounding, and comfortably below anything that would read as a
  buzz rather than a tick.
- Still nothing for iOS. The only iOS haptic route is a documented hack involving
  a labelled switch input, which fires on a real tap on a real control and cannot
  be driven from a game event.

## Alternatives considered

- **A haptics on/off setting.** A real preference, and worth adding if anyone
  finds the tick intrusive. Not added now: the report was that haptics were
  _missing_, and a toggle for a feature that does not fire is the wrong order.
- **Feature-detect and hide the whole thing on iOS.** There is nothing visible to
  hide — the game never mentions vibration.
- **Longer pulses everywhere.** A 15 ms tick thirty times a level is a texture;
  30 ms thirty times a level is a nuisance.
