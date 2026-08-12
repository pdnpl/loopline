# ADR-0008: Deploy as an assets-only Cloudflare Worker

- **Status:** Accepted
- **Date:** 2026-08-12
- **Deciders:** autonomous agent

## Context

The deployment target was specified: Cloudflare Workers. The application has no
server-side component by design — no API, no accounts, no database. It is an
HTML file, a stylesheet, a JavaScript bundle and two small static assets.

Cloudflare offers several ways to host that, and they are not equivalent.

## Decision

Ship an **assets-only Worker**: a `wrangler.jsonc` with an `assets` binding
pointing at `./dist` and **no `main` entrypoint**.

```jsonc
{
  "name": "loopline",
  "compatibility_date": "2026-08-01",
  "assets": {
    "directory": "./dist",
    "not_found_handling": "single-page-application",
  },
}
```

With no `main`, Cloudflare serves the files straight from its edge cache. No
Worker script is invoked, so no Worker invocation is billed and no cold start
exists to worry about.

## Consequences

**Positive**

- Static assets are served from the edge with zero compute in the request path.
- One deployment command, `wrangler deploy`, with no build-output convention to
  match.
- Adding server-side logic later means adding a `main` entrypoint — the config
  does not have to be restructured.

**Negative**

- `not_found_handling: "single-page-application"` returns `index.html` with a
  200 for unknown paths. Correct for an app with no server routes; it would need
  revisiting if real routes were ever added.
- Assets-only Workers are a newer feature than Pages, so some third-party
  documentation still assumes the Pages shape.

## Alternatives considered

- **Cloudflare Pages.** Would work, and its Git integration is convenient. Passed
  over because the brief named Workers, because Workers Static Assets is where
  Cloudflare is investing, and because deploying from GitHub Actions gives the
  same automation without a second control plane to configure.
- **A Worker script that serves the assets.** Puts a compute invocation in front
  of every request to do what the platform already does for free.

## Related

- ADR-0010 (deployment automation)
