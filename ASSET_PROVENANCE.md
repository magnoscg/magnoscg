# Asset provenance

This repository uses two local images. Their origin and transformation are recorded here
so the public profile can be reviewed without relying on an undocumented binary.

## `assets/profile-banner.png`

- Asset: `assets/profile-banner.png`.
- Role: GitHub profile banner for Oscar Canton's professional engineering profile.
- Source type: first-party screen capture.
- Generator: none. No generative model was used.
- Captured: 2026-08-06.
- Reference asset: the English page of ogamlabs.com at release `1.5.0`, served from its
  locally built deployment artifact.
- Reference dimensions: 3400x2000.
- Reference SHA-256: `3fd87a13f9d3dc6f550e869b1e7bc5eb85c0d27958ea074f45c030b7f42291fe`.
- Capture method: headless Chrome at a 1700x1000 CSS viewport with device scale factor 2
  and scrollbars hidden.
- Framing: the hero band, CSS rows 108 to 628, centred on the page and stopping above the
  proof strip, so the headline, the opening paragraphs, the calls to action and the stack
  row are complete.
- Transformation: cropped to 2600x1040 and resampled to 1280x512. Capturing at 2x and
  reducing by 2.03 keeps the body copy legible at the width GitHub renders. No retouching,
  recolouring or composition was applied.
- Distributed dimensions: 1280x512.
- Distributed SHA-256: `03354a6381f514fe9f4da70b916b401dbbb59158c150a5e7ed453b4428d17d08`.
- Content declaration: no product UI, person, customer data, testimonial, or third-party
  logo is represented. The crop deliberately stops above the site's proof strip, so the
  banner carries the headline and the opening paragraphs but no app screenshot.

## `assets/github-activity.svg`

- Asset: `assets/github-activity.svg`.
- Role: activity card under the banner, so a reader sees the account's age and its
  contribution rhythm without leaving the page.
- Source type: numbers read from the GitHub GraphQL API for the `magnoscg` account,
  including private repositories, through the authenticated `gh` CLI.
- Generator: `scripts/build-stats.mjs`, run against the GitHub GraphQL API on a weekly
  schedule. It draws the card as plain SVG shapes and text; no generative model, template
  service or third-party image host is involved.
- Refresh: `.github/workflows/refresh-stats.yml` recounts and commits the card every Monday,
  and on demand through `workflow_dispatch`. `npm run stats` does the same locally. The card
  states the date its numbers were counted and the validator refuses one without it.
- Content declaration: contribution counts, active days, streak length, pull request and
  repository totals. No graph is drawn: GitHub renders its own contribution calendar under
  the README, so the card carries only the numbers that calendar cannot show. No product UI,
  person or third-party logo is represented.

Until 2026-08-06 this banner was an AI-generated derivative of an OgamLabs social card. It
was replaced by a capture of the site itself: the profile no longer opens with synthetic
artwork, and the banner now changes only when the site does. It still is presentation, not
evidence of product functionality — product claims in the profile link to public
repositories, case studies, product sites, or App Store pages.
