# ADR-0012: Bilingual UI and a keyboard-playable canvas

- **Status:** Accepted
- **Date:** 2026-08-12
- **Deciders:** autonomous agent, language scope confirmed by @ravwtar

## Context

The interface is to be available in Polish and English with a switch. The code
and documentation stay in English.

Separately, the board is a canvas (ADR-0003), and a canvas is opaque to assistive
technology: it exposes pixels, not objects. A game that can only be played by
dragging is also unplayable without a pointing device.

## Decision

**Language.** A hand-written dictionary in `src/i18n/index.ts`, keyed by message
name, with `pl` and `en` maps and a `{placeholder}` substitution helper.
The initial language is taken from `navigator.language`, and an explicit choice
is remembered. No i18n library: the game has roughly thirty strings, and any
library would outweigh the strings it manages.

**Accessibility.** The canvas draws the board; everything else is real DOM.

- **Keyboard play is a first-class input**, not an afterthought:
  arrows or `WASD` for orthogonal moves, `Q`/`E`/`Z`/`C` for diagonals,
  `Enter` to start on the focused dot, `Backspace` to undo, `R` to restart.
  Before the stroke starts, arrows move a focus ring between dots.
- An **ARIA live region** announces stroke start, completion time and run end.
- Every control is a real `<button>` with an `aria-label` that follows the
  selected language.
- `:focus-visible` rings are styled, never removed.
- `prefers-reduced-motion` disables particles, idle breathing and background
  drift, leaving gameplay intact.
- `prefers-color-scheme` is honoured, with a manual override.
- Touch targets are at least 36 px, and the primary actions are 48–52 px.

## Note on the lift-off rule

Lifting the finger ends a run (ADR-0013), because an unbroken stroke is the whole
game. Keyboard play has no equivalent gesture, so there is nothing to lift and
the rule simply does not apply there — `Backspace` undoes instead. The two input
modes are therefore not perfectly equivalent, which is the right call: an
accessible path that is impossible to use is not accessible.

## Consequences

**Positive**

- Playable without a pointing device, on every level including diagonal boards —
  verified end to end by tests that solve levels 1, 4 and 11 by key press.
- No translation dependency; adding a third language is one object literal, and
  a missing key is a TypeScript error rather than a runtime blank.

**Negative**

- The dictionary is duplicated by hand, so a new key must be added twice. The
  `Dictionary` type makes omissions fail the build.
- The canvas remains invisible to screen readers as a picture. The live region
  and keyboard model convey state instead of shape; a full textual description of
  the board is not attempted.

## Alternatives considered

- **An i18n library.** More bytes than the strings.
- **English only.** Rejected by the language choice.
- **Mirroring the board into hidden DOM nodes for screen readers.** Considerable
  complexity for a spatial puzzle that does not narrate well; keyboard play plus
  progress announcements was judged the better use of the same effort.
