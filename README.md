# Loopline

**Draw every line in one unbroken stroke. Never the same line twice.**

A minimalist one-stroke puzzle for the browser. Put a finger on a dot, drag over
every line exactly once, and do not lift off. It is Euler's bridges of
Königsberg, sized for a coffee break.

- **No accounts, no server, no leaderboard.** Progress lives in your browser.
- **~15.5 kB gzipped**, nothing imported at runtime, no web fonts, no network
  requests after load.
- **Runs offline**, in the browser and as an Android app.
- **Infinite levels**, generated so that every one of them is provably solvable.
- **Polish and English**, dark and light, pointer and keyboard.

---

## Play

|                   |                                                                                                    |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| **Touch / mouse** | Press a dot and hold. Drag along the lines. Drag back to undo. Lift off and the run ends.          |
| **Keyboard**      | `Enter` start · arrows or `WASD` move · `Q` `E` `Z` `C` diagonals · `Backspace` undo · `R` restart |

Getting stuck is normal — not every dot is a legal opening. Fail three times on
a level and the game rings the dots a solution can actually start from.

**Haptics** fire on every line, on a run ending and on a solve — on Android. iOS
has never implemented the Vibration API, so an iPhone stays silent no matter
what, and Android honours the system "vibrate on touch" setting. See
[ADR-0022](docs/adr/0022-haptics-and-what-silences-them.md).

## Run it

```bash
npm install
npm run dev
```

Then open <http://localhost:5173>.

| Script              | What it does                               |
| ------------------- | ------------------------------------------ |
| `npm run dev`       | Vite dev server with hot reload            |
| `npm run build`     | Type-check, then build to `dist/`          |
| `npm run test`      | Vitest, 342 tests                          |
| `npm run lint`      | ESLint with type-aware rules               |
| `npm run typecheck` | `tsc --noEmit`                             |
| `npm run format`    | Prettier, write                            |
| `npm run verify`    | Everything CI runs, in the same order      |
| `npm run cf:dev`    | Build, then serve through Wrangler locally |
| `npm run deploy`    | Build, then `wrangler deploy`              |

## Android

The Android app is the web build inside a [Capacitor](https://capacitorjs.com)
shell — the same `dist/`, the same canvas, the same gestures, packaged into the
APK so the game works with the radio off. See
[ADR-0023](docs/adr/0023-android-as-a-capacitor-shell-built-locally.md).

**Nothing in `src/` is Android-specific.** The native project is a container.

```bash
npm run android:apk
```

The APK lands in `android/app/build/outputs/apk/debug/app-debug.apk`.

| Script                    | What it does                                |
| ------------------------- | ------------------------------------------- |
| `npm run android:sync`    | Build the web app, copy it into `android/`  |
| `npm run android:apk`     | The above, then a debug APK via Gradle      |
| `npm run android:install` | Install the built APK on an attached device |
| `npm run android:open`    | Open the project in Android Studio          |

**Requirements**, once, on the build machine:

| Need           | Version used here                                                |
| -------------- | ---------------------------------------------------------------- |
| JDK            | 21                                                               |
| Android SDK    | platform 36, build-tools 36.0.0, platform-tools                  |
| `ANDROID_HOME` | pointing at the SDK (or `sdk.dir` in `android/local.properties`) |

Android Studio is optional — the command-line tools are enough. Gradle
downloads itself on first build.

**Builds are local by design.** No GitHub workflow touches Android or iOS;
CI verifies and deploys the web app and nothing else.

## How it is put together

```
src/
  core/           the puzzle, with no idea a screen exists
    rng.ts        seeded mulberry32 — the same level everywhere, every time
    graph.ts      Eulerian trail theory, Hierholzer's algorithm
    generator.ts  builds boards by walking a trail (so they cannot be unsolvable)
    levels.ts     the difficulty curve, as a formula
  game/
    trail.ts      finger position -> drawn line. The heart of how it feels.
    game.ts       input, frame clock, orchestration
    render.ts     Canvas 2D renderer
    layout.ts     grid coordinates -> screen pixels
    particles.ts  fixed-capacity, allocation-free particle pool
    theme.ts      canvas palettes
    storage.ts    localStorage, guarded against every way it can fail
  ui/             DOM chrome: stats, buttons, overlays
  i18n/           thirty-odd strings in two languages
tests/            342 tests, including full pointer and keyboard playthroughs
docs/adr/         why any of this is the way it is
android/          generated Capacitor shell — a WebView holding dist/
scripts/          build helpers that have to work on more than one OS
```

The split that matters: **`core/` knows nothing about rendering**, which is why
the puzzle logic can be tested exhaustively without a browser, and why the tests
can verify that levels 1–60 all have a real Eulerian solution.

## Performance notes

The things that would have cost frames, and what was done instead:

- **No `shadowBlur` in the frame loop** — by far the most expensive 2D canvas
  operation. Glow comes from radial-gradient sprites rendered once and blitted.
  A test asserts no `shadow*` property is ever touched.
- **One clock.** Everything time-based is driven by the `requestAnimationFrame`
  timestamp. No CSS transition is ever read back or relied on for state.
- **Decoration on the compositor.** The animated background is CSS `transform`
  and `opacity` only, so it cannot contend with the game loop.
- **`getCoalescedEvents()`** replays the pointer samples the browser buffered
  between frames, so a fast swipe on a 120 Hz screen does not cut corners.
- **Batched drawing.** Every undrawn edge is one path and one `stroke()`.
- **Device pixel ratio capped at 2.5.** Past that the pixels are invisible and
  the fill rate is not.

## Deploy

Hosted as an [assets-only Cloudflare Worker](docs/adr/0008-cloudflare-workers-static-assets.md) —
static files served from the edge with no compute in the request path.

**Automatic.** Every merge to `main` deploys, once two repository secrets exist:

| Secret                  | Where to get it                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | Cloudflare dashboard → My Profile → API Tokens → _Edit Cloudflare Workers_ template |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → Workers & Pages → Account ID                                 |

Add them under **Settings → Secrets and variables → Actions**. Until they exist
the deploy job skips itself and CI still passes.

**Manual.**

```bash
npx wrangler login
npm run deploy
```

## Contributing

`main` is protected: no direct pushes, no force pushes, and CI must be green over
the merge result. See [CONTRIBUTING.md](CONTRIBUTING.md) and
[ADR-0010](docs/adr/0010-autonomous-pull-request-workflow.md).

## Decisions

Twenty-three architecture decision records live in [`docs/adr/`](docs/adr/README.md).
Start with [ADR-0006](docs/adr/0006-generate-puzzles-by-eulerian-walk.md) (why a
level can never be unsolvable) and
[ADR-0013](docs/adr/0013-stroke-model-and-fast-retry.md) (why the stroke feels
the way it does).

## Licence

[MIT](LICENSE)
