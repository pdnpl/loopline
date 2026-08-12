# ADR-0014: No web fonts

- **Status:** Accepted
- **Date:** 2026-08-12
- **Deciders:** autonomous agent

## Context

A minimalist, premium-feeling interface usually implies a chosen typeface. The
game's text is a wordmark, three stat labels, three numbers and an overlay — a
few dozen glyphs, but they carry most of the perceived polish.

A self-hosted variable font subset costs roughly 15–25 kB, which is larger than
the entire rest of the application (~15.5 kB gzipped), and introduces a font
loading state: either invisible text for up to three seconds, or a visible reflow
when the real font arrives.

## Decision

Use the system font stack, with typography tuned rather than chosen:

```
system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif
```

Polish comes from the settings instead of the file: negative letter-spacing on
headings, uppercase tracked micro-labels, `font-variant-numeric: tabular-nums` on
every number so the stopwatch does not jitter as digits change width, and
`font-synthesis-weight: none` so no platform fakes a weight it does not have.

## Consequences

**Positive**

- Zero font bytes, zero font requests, no invisible-text or reflow state. Text is
  correct in the first paint.
- Native rendering on every platform — San Francisco on Apple, Segoe UI Variable
  on Windows, Roboto on Android.
- Polish diacritics render correctly everywhere, which a badly subset webfont can
  get wrong.

**Negative**

- The wordmark is not distinctive; brand identity rests on the logo mark, colour
  and motion instead.
- Metrics differ per platform, so layout must tolerate a few pixels of variance.
  Everything text-related uses flexbox and `clamp()`, so it does.

## Alternatives considered

- **Self-hosted variable font subset.** The quality option, at more than double
  the total payload for a game whose appeal includes opening instantly.
- **Google Fonts CDN.** Adds a third-party origin, an extra connection on the
  critical path, and a privacy consideration to a project that otherwise makes no
  outbound requests at all (ADR-0011).
