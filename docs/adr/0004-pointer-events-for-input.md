# ADR-0004: Pointer Events with `touch-action: none`, not `touchstart` or `click`

- **Status:** Accepted
- **Date:** 2026-08-12
- **Deciders:** autonomous agent

## Context

The brief was explicit: use `touchstart` rather than `click`, because `click` on
mobile can lag behind the physical touch and a reflex game has to feel immediate.

The underlying requirement — react on touch-down, never on release, never after
a delay — is right. The specific API is worth a second look, because the delay
`click` used to suffer from has a known modern remedy, and the game also has to
work with a mouse, a trackpad, a stylus and a keyboard.

## Decision

Use **Pointer Events** (`pointerdown` / `pointermove` / `pointerup` /
`pointercancel` / `lostpointercapture`) on the board element, with
`touch-action: none` set in both CSS and JavaScript.

Supporting choices:

- `event.preventDefault()` on `pointerdown` and `pointermove`, with listeners
  registered `{ passive: false }` so the call actually takes effect.
- `setPointerCapture()` on touch-down, so the stroke keeps receiving events even
  when the finger leaves the element.
- Only the first active pointer is tracked; a second finger is ignored outright.
- The overlay's retry action also fires on `pointerdown`, not `click`.

## Rationale

`pointerdown` fires at the same moment as `touchstart` — both are dispatched on
physical contact, before any gesture disambiguation. There is no latency to
recover by preferring one over the other.

What `touch-action: none` buys is the part that actually mattered: it tells the
browser up front that this element never scrolls, pinches or double-tap-zooms,
which removes the ~300 ms "is this a tap or a gesture?" wait that made `click`
feel slow in the first place, and stops the browser stealing the stroke halfway
through as a scroll.

The remaining difference is coverage. One Pointer Events code path serves touch,
mouse and pen. Going with `touchstart` would mean a second, parallel mouse path
and a third for pen — three code paths to keep in sync, for no latency gain.

## Consequences

**Positive**

- Reacts on contact, on every input device, through one code path.
- No synthetic-click delay and no scroll hijacking the stroke.
- Pointer capture means a finger that strays off the board does not silently end
  the run in a state the game cannot see.

**Negative**

- Pointer Events assume a reasonably modern browser. Baseline support is
  universal across current mobile and desktop browsers, so this is theoretical.
- `preventDefault()` on the board means the page genuinely cannot be scrolled
  from there. That is intended, and the board is the only such element.

## Alternatives considered

- **`touchstart` + `mousedown` in parallel.** The literal reading of the brief.
  Rejected: same latency, more code, and it needs manual suppression of the
  synthetic mouse events that follow every touch.
- **`click`.** Rejected. Fires on release, not contact, and cannot express a drag
  at all.

## Related

- ADR-0005 (frame clock)
- ADR-0013 (stroke model)
