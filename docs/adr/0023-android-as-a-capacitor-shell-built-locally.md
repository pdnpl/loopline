# ADR-0023: Android as a Capacitor shell, built locally

- **Status:** Accepted
- **Date:** 2026-08-14
- **Deciders:** autonomous agent, on a brief from @ravwtar
- **Related:** [ADR-0002](0002-vanilla-typescript-over-a-framework.md), [ADR-0003](0003-canvas-2d-rendering.md), [ADR-0008](0008-cloudflare-workers-static-assets.md), [ADR-0010](0010-autonomous-pull-request-workflow.md)

## Context

The brief: ship Loopline to Google Play and the App Store as installable apps,
**with the look and the feel unchanged**, built entirely on local machines —
Android here on Windows, iOS later on a Mac. GitHub must not build either.
The app must work with no network access at all.

Two constraints do most of the deciding.

**"Unchanged look and feel" rules out every reimplementation.** Flutter, React
Native and Unity would each mean rewriting the renderer and the input model.
`trail.ts` is a tuned instrument — commit at 0.88, undo at 0.78, release at 0.04,
a 7 px direction deadzone ([ADR-0013](0013-stroke-model-and-fast-retry.md)) —
and `game.ts` replays coalesced pointer samples against a `requestAnimationFrame`
clock ([ADR-0005](0005-requestanimationframe-as-the-only-clock.md)). Porting
that means re-deriving it, and re-deriving it means changing how the game feels.
The only way to guarantee the feel survives is to **not touch the code that
produces it**.

**"Works offline" turns out to be free.** Loopline already makes no network
request after load: no web fonts ([ADR-0014](0014-no-web-fonts.md)), no CDN, no
analytics, progress in `localStorage`
([ADR-0011](0011-local-only-progress.md)), and levels _generated_ from a seed
rather than fetched ([ADR-0007](0007-deterministic-seeded-levels.md)). There is
nothing to make offline. There is only something to avoid breaking.

## Decision

**Wrap the existing build in Capacitor.** The native project is a WebView
filled with the contents of `dist/`, packaged inside the APK.

### 1. Capacitor, not the alternatives

| Option               | Verdict                                                                                                                                         |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Capacitor**        | **Chosen.** Same code, same canvas, same gestures. Generates a real Gradle project and a real Xcode project, both buildable offline and locally |
| Tauri 2 mobile       | Same system WebView underneath, so identical output — bought with a younger mobile toolchain and a Rust dependency. No gain                     |
| PWA / TWA            | Cheapest on Android, but Apple does not accept a TWA, and iOS PWAs get neither haptics nor durable storage                                      |
| Flutter / RN / Unity | A rewrite. Fails the one requirement that matters                                                                                               |

### 2. This first pass changes nothing in `src/`

Not one line. The web build is copied into the shell verbatim, which makes the
claim "it plays exactly as it does in the browser" verifiable rather than
hopeful: if the two ever diverge, the cause is the WebView, never our code.

The native refinements that a shipping app wants — safe-area insets around the
notch, `@capacitor/haptics` (which would finally give **iOS** a vibration,
something `navigator.vibrate` can never do —
[ADR-0022](0022-haptics-and-what-silences-them.md)), `@capacitor/preferences`
for storage the system cannot evict, and a portrait lock — are deliberately
**deferred to a second pass**. Each is a real change to `src/`, and mixing them
into the packaging step would confuse "the shell works" with "the changes work".

### 3. Builds are local; CI stays web-only

No workflow gains a JDK, an SDK or a Gradle step. `ci.yml` and `deploy.yml`
continue to do exactly what they did: verify the web build and publish it to
Cloudflare.

This is the brief, and it is also the better default. A mobile build needs a
signing keystore; putting one in GitHub Actions means putting a release signing
key in a secret store, which is a security decision with real consequences and
no benefit while releases are cut by hand.

### 4. `android/` and `ios/` are committed, separate, top-level

Each platform owns one directory, and both are tracked in git. Tracking them is
what makes `ios/` transferable — the Mac clones the repo rather than receiving a
zip. Capacitor's generated `android/.gitignore` already excludes what must not
be tracked: `build/`, `.gradle/`, `local.properties`, the copied
`app/src/main/assets/public/`, and the generated config files. **Nothing derived
from `dist/` is committed twice.**

`android/` and `ios/` are added to `.prettierignore` and to the ESLint ignore
list. They are generated code owned by two other toolchains; formatting them
would be formatting someone else's project.

### 5. `pl.voltis.loopline`

The application id is the reverse of a domain the author demonstrably controls.
It is **permanent from the first Play upload onward** — Google allows no change
of package name for a published app, ever. Worth objecting to now if it is
wrong; free to change until then.

### 6. `capacitor.config.json`, not `.ts`

A root-level `.ts` file falls under `eslint .` but outside `tsconfig.json`'s
`include`, so it would be parsed by the JavaScript parser and fail. JSON has no
such problem, and the config is six lines of literals with nothing to type-check.

### 7. The icon and the launch screen are ours, and they are vectors

Capacitor ships a working placeholder: its own logo, on white, as 26 PNGs
across five densities and two orientations. Shipping that would put another
project's brand on the home screen, so it is replaced — packaging, not source,
and therefore in scope for this pass.

Both are built from the wordmark already in `index.html`, as **vector
drawables**. One file replaces a density ladder and stays sharp at any size,
including the 192 px Play Store listing.

Two details worth recording, because both were nearly wrong:

- **The mark is scaled so it survives a circular mask.** In the 108×108
  adaptive canvas, a round launcher keeps a 33-unit radius from centre. At the
  obvious scale the mark's four ends land ~37 units out and get clipped. It is
  drawn at 3.3× instead, which puts the furthest point at ~30.
- **`drawable-v24/ic_launcher_foreground.xml` had to go.** The Android template
  leaves an Android-robot vector there, and `-v24` beats plain `drawable/` on
  every device this app supports — the new icon would have been built,
  packaged, and never once displayed.

The launch screen follows night mode via `values/` and `values-night/`, so a
light phone does not get a black flash before a light board. The icon
deliberately does **not**: an app icon that changes colour under the user is a
novelty, not a help.

### 8. The SDK lives in the user profile

A partial SDK already existed at `C:\Program Files (x86)\Android\android-sdk` —
a Visual Studio remnant with a platform but no `build-tools`, no
`platform-tools` and no `cmdline-tools`, in a location that needs
administrator rights to repair. It was left alone. A complete SDK was installed
at `%LOCALAPPDATA%\Android\Sdk` from Google's command-line tools: no
administrator, no Android Studio, and nothing shared with another tool that
might change it underneath us.

Android Studio is not required to build. It remains useful for an emulator and
for inspecting a layout, and it will find this SDK because `ANDROID_HOME` points
at it.

## Consequences

**Positive**

- The game on the phone is the game in the browser, by construction.
- Offline was already true and stays true: the assets are inside the APK and the
  app never asks the network for anything.
- One `npm run android:apk` produces an installable APK from a clean checkout.
- The web deployment is untouched. Cloudflare still serves the same `dist/`.
- `ios/` can be generated later and handed to a Mac through the repository.

**Negative**

- `@capacitor/core` is now a runtime dependency in `package.json`. It is never
  imported by `src/`, so the browser bundle is byte-identical and the "zero
  runtime dependencies" property of the _shipped web app_ holds — but the
  package.json no longer says so at a glance.
- Two more toolchains to keep current: Gradle/AGP and the Android SDK. Neither
  is exercised by CI, so drift will be found by a human, at build time.
- App startup is marginally slower than a fully native app while the WebView
  initialises. A splash screen covers it.
- Apple scrutinises apps that are "just a wrapped website". Loopline's defence
  is that it is fully functional with the radio off — which is true, and easy to
  demonstrate.

## Alternatives considered

- **Generate `android/` on demand and never commit it.** Smaller repository, and
  it is a defensible position because the directory _is_ derived. Rejected: the
  moment a native file is edited by hand — an icon, a manifest entry, a
  `build.gradle` tweak — it stops being derived, and the failure mode is silent
  loss of that edit.
- **Build the APK in GitHub Actions anyway, unsigned.** Would catch toolchain
  drift. Rejected: explicitly out of scope, and an unsigned artifact nobody
  installs is a slow check that proves little.
- **Do the native refinements in the same pass.** Faster in wall-clock terms and
  worse in every other way; see decision 2.
