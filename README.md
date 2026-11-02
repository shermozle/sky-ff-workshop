# Sky NZ · Amplitude Feature Flags workshop

90-minute workshop for a mixed technical/product audience. Ready-made static streaming app, 20-slide presenter deck, timed notes, participant guide and API examples.

## Preview

Serve `public/` with any static web server, for example:

```sh
python3 -m http.server 7430 --directory public --bind 127.0.0.1
```

Open http://127.0.0.1:7430/. Nothing requires a hosted backend or a build step. Practice mode also works when opening `public/app.html` directly. Use HTTP/HTTPS for live mode and clipboard support.

## Current state

- Target: Sky NZ org, dedicated project **74301**, **US** region.
- Supplied public Analytics and client deployment keys configured in `public/config.js`; deployment: `sky-workshop-web`. Practice remains the default.
- Live presenter flag evaluation returned HTTP 200 and `on` for all five viewers in explicit and identity-only modes. Five fictional profiles / 60 seed events were accepted by the US ingestion endpoint.
- High-engagement targeting passed for all five viewers in both explicit and identity-only modes. Live rollback, participant permissions and public deployment remain to be verified.
- Live setup and rehearsal steps: `public/setup.html`.

## Live setup

1. The web **client** deployment `sky-workshop-web` is configured.
2. Approved public keys are in `public/config.js`; keep secret and management keys outside the site.
3. Inspect the dry-run seed output with `node scripts/seed-users.cjs` (Node 20+, presenter machine only).
4. Once authorised, set `SKY_AMPLITUDE_PROJECT_ID=74301` and `SKY_AMPLITUDE_API_KEY` securely, then run `node scripts/seed-users.cjs --send`.
5. Verify stored profiles and identity-only targeting before the workshop.

Never put server deployment, management, or project secret keys in `public/`.

## Structure

- `public/`: complete GitHub Pages website, safe to stage after reviewing public browser configuration.
- `content/workshop.json`: single source for slide titles, content, speaker notes, times and section budgets.
- `content/deck-template.html`: workshop presenter machinery, copied from the hands-on-workshop skill template.
- `scripts/build-pack.py`: regenerates slides, notes and hub. Standard Python library only.
- `scripts/seed-users.cjs`: dry-run by default; sends synthetic profiles and events only with `--send` and environment guards.
- `tests/workshop.cjs`: browser contract tests and layout/link checks using Playwright, including the real vendored SDK with intercepted responses.

## Regenerate and verify

```sh
python3 scripts/build-pack.py
node scripts/seed-users.cjs
node --check public/app.js
# With Playwright installed/available on the local machine:
node tests/workshop.cjs
```

A Python or Node runtime is only needed for local preview/generation/testing or presenter seeding. GitHub Pages serves the generated files directly.

## Publishing

The prepared Pages source is `docs/` on `main`. It contains only the static website; source manifests, scripts and test artifacts are not served.

After editing `public/`, regenerate and stage:

```sh
python3 scripts/build-pack.py
python3 scripts/stage-pages.py
```

Commit both source and generated files. GitHub Pages should use **Deploy from a branch → main → /docs**. All links support a repository subpath. The deck derives the hub URL from its current location.

Proposed destination: `shermozle/sky-ff-workshop`. Publishing is pending confirmation of this repository name and public visibility.

Slides have keyboard navigation, full screen, section jump menu, section-aware timer and print-to-PDF styles. The app has visible practice/live status, default paths on missing/error results and URL-persisted synthetic identities. Runtime public keys are stored locally and intentionally excluded from copied scenario URLs.
