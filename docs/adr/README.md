# Architecture Decision Records

Why the code looks the way it does. Format and rules: [ADR-0001](0001-record-architecture-decisions.md).

Records are immutable once accepted. To reverse one, write a new record and mark
the old one `Superseded by ADR-XXXX`.

| #                                                       | Decision                                            | Status                                   |
| ------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------- |
| [0001](0001-record-architecture-decisions.md)           | Record architecture decisions                       | Accepted                                 |
| [0002](0002-vanilla-typescript-over-a-framework.md)     | Vanilla TypeScript over a UI framework              | Accepted                                 |
| [0003](0003-canvas-2d-rendering.md)                     | Render the board with Canvas 2D                     | Accepted                                 |
| [0004](0004-pointer-events-for-input.md)                | Pointer Events with `touch-action: none`            | Accepted                                 |
| [0005](0005-requestanimationframe-as-the-only-clock.md) | `requestAnimationFrame` is the only clock           | Accepted                                 |
| [0006](0006-generate-puzzles-by-eulerian-walk.md)       | Generate boards by walking a trail                  | Accepted                                 |
| [0007](0007-deterministic-seeded-levels.md)             | Deterministic seeded levels, formula-based curve    | Accepted                                 |
| [0008](0008-cloudflare-workers-static-assets.md)        | Assets-only Cloudflare Worker                       | Accepted                                 |
| [0009](0009-public-repository-and-rulesets.md)          | Public repository, protected by a ruleset           | Accepted                                 |
| [0010](0010-autonomous-pull-request-workflow.md)        | Autonomous PR workflow with CI as the gate          | Accepted                                 |
| [0011](0011-local-only-progress.md)                     | Progress in `localStorage`, and nowhere else        | Accepted                                 |
| [0012](0012-accessibility-and-bilingual-ui.md)          | Bilingual UI and a keyboard-playable canvas         | Accepted                                 |
| [0013](0013-stroke-model-and-fast-retry.md)             | Stroke model, hysteresis, fast retry                | Accepted                                 |
| [0014](0014-no-web-fonts.md)                            | No web fonts                                        | Accepted                                 |
| [0015](0015-a-run-starts-at-the-first-line.md)          | A run starts at the first line, not the first touch | Accepted (decision 2 superseded by 0016) |
| [0016](0016-restart-always-answers.md)                  | Restart always answers the press                    | Accepted                                 |
