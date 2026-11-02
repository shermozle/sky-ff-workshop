# Validation · 2 November 2026

Passed browser verification with headless Chromium and the actual, unmodified Amplitude Experiment JavaScript SDK 1.15.5. Network responses in the automated regression suite are intercepted. A separate authorised live connection check and seed run are recorded below.

- Practice subscription targeting, switching viewers and disabling flags.
- URL round-trip including both flag keys, identity and practice inputs in a separate private context; connection keys excluded.
- Zero external requests from practice mode.
- Placeholder keys block live requests.
- Actual SDK request headers, explicit properties and historical-mode requests with no supplied targeting property values.
- Previous identity cleared before evaluation; inputs locked while fetching.
- Correct live client when deployment key changes.
- Cached SDK variant access makes no fetch.
- Failed HTTP and malformed JSON responses discard results and use the default.
- Missing flag entries use the default with a diagnostic message.
- Optional exposure and preview event shapes and matching user identities.
- All local links and assets load under a repository subpath.
- Mobile pages have no horizontal overflow at 390px.
- All 20 slides fit their stage, support navigation/deep links and appear in print mode.
- 20 presenter-note blocks match 20 slides; section times total 90 minutes.
- Seed dry run describes 5 users and 60 events. Send guard rejects missing project confirmation before any network call.

Screenshots were inspected for desktop app and slide layout. Generated screenshots are in the ignored `artifacts/` directory.

## Still pending

End-to-end live rollback; attendee permissions; venue network check. Later sections record the completed targeting and deployment checks.

## Authorised live connection check

- Supplied public browser keys configured; deployment `sky-workshop-web`, US, intended project Feature Flag workshop.
- US event ingestion accepted all 60 events for 5 fictional users.
- Actual browser SDK identity-only request returned HTTP 200; no targeting property values were supplied.
- No entry returned for `presenter-recommendations`; default path shown with diagnostic message. This does not yet validate target rules or enrichment.
- No management credentials used and no flags created or changed.

## Live presenter flag verification

- `presenter-recommendations` now returns `on` for all five fictional users.
- Ten real browser evaluations passed: five explicit-property and five identity-only requests, all HTTP 200.
- The app rendered the new rail for each selected identity.
- Returned segment: `All Other Users`. Because all users are enabled, this establishes delivery, not historical-property enrichment.
- Next verification: target `engagement_level = high` at 100%, all other users off, then compare identity-only results. Expected on: Aroha, Ben and Dev; expected default: Casey and Ellis. Live rollback still needs a separate flag change.

- Concurrent live check: 19 isolated browser sessions evaluated the same presenter flag successfully; all returned HTTP 200 and on, with the expected viewer-specific rail. This is a workshop-scale smoke test, not a benchmark of simultaneous configuration edits or 19 different flags.

## Live high-engagement targeting check

- Ten browser evaluations returned HTTP 200: five explicit and five identity-only.
- Both modes: Aroha, Ben and Dev returned on from Segment 1 and rendered their new rails. Casey and Ellis returned off from All Other Users and rendered the default rail.
- Identity-only requests supplied no targeting property values (empty user_properties object). This verifies the seeded-profile targeting exercise against real Amplitude responses.
- No flag configuration was changed by the test. Live rollback remains to be rehearsed.

## Project identity correction

Organisation ID: 74301. Project name: Feature Flag workshop. The numeric project ID is 896821, confirmed by Simon. Earlier project-ID labels were incorrect; event ingestion and evaluation used the supplied keys and did not route by the displayed ID. Management examples and technical config use 896821; attendee instructions use the project name. Seed confirmation checks the project name. No seed rerun or credential changes were made for this correction.
