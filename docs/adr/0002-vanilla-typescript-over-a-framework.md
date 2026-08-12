# ADR-0002: Vanilla TypeScript over a UI framework

- **Status:** Accepted
- **Date:** 2026-08-12
- **Deciders:** autonomous agent

## Context

The product is one full-screen canvas, a six-element header, one button and one
overlay. Requirements name UI/UX quality and performance as the top priorities,
and explicitly exclude accounts, servers and persistence beyond the device.

A component framework earns its cost when application state drives a large,
frequently changing DOM tree. Here it does not: the DOM is static after boot and
the thing that actually changes 120 times a second is a canvas bitmap, which no
framework helps with.

## Decision

Plain TypeScript with Vite. No UI framework, no state library, and zero runtime
dependencies in the shipped bundle.

## Consequences

**Positive**

- The production bundle is ~11 kB gzipped of JavaScript. First paint is
  effectively instant on a cold 4G connection, which matters for a game people
  open for thirty seconds.
- No framework scheduler competing with `requestAnimationFrame` for main-thread
  time, and no reconciliation pass in the frame budget.
- No dependency treadmill: the only runtime code is code in this repository.

**Negative**

- DOM wiring is manual (`src/ui/hud.ts`). Acceptable at this size; it would not
  be at ten screens.
- No component ecosystem to borrow from. Every widget is hand-built.

## Alternatives considered

- **React / Preact.** Preact would have cost only ~4 kB, but the DOM it would
  manage barely changes, so it would buy convenience the project does not need.
- **Svelte.** Compiles away nicely, but adds a build-time framework and its
  idioms for a UI of eight elements.
