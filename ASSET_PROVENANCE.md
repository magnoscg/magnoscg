# Asset provenance

This repository uses nine local images: the banner, two drawings and one image per project. Their origin and transformation are recorded here
so the public profile can be reviewed without relying on an undocumented binary.

## `assets/profile-banner.png`

- Asset: `assets/profile-banner.png`.
- Role: GitHub profile banner for Oscar Canton's professional engineering profile.
- Source type: first-party screen capture.
- Generator: none. No generative model was used.
- Captured: 2026-11-04.
- Reference asset: the English page of ogamlabs.com as published on 2026-11-04,
  `https://ogamlabs.com/en`.
- Reference dimensions: 3400x2000.
- Reference SHA-256: `51a7241b289731cd5d080bb4ee6bedfa672dc74dfbf9248e12311840e7766db1`.
- Capture method: headless Chrome at a 1700x1000 CSS viewport with device scale factor 2
  and scrollbars hidden.
- Framing: the hero headline, CSS rows 181 to 422 and columns 412 to 1288, centred on the
  page. The status pill and the headline are complete; the crop stops above the opening
  paragraph and the call-to-action buttons, so the banner names no employer and shows
  nothing that looks clickable but is not.
- Transformation: cropped to 1750x700 and resampled to 1280x512, then cut to rows 46 to 398
  of that image (1280x352) so the opening paragraph, which names the employer, is left out.
  Capturing at 2x and reducing by 1.37 keeps the headline legible at the width GitHub
  renders. No retouching, recolouring or composition was applied.
- Distributed dimensions: 1280x352.
- Distributed SHA-256: `695880e8efc5d94b057a83e755232168d16ddf02e4a4b310bf10aa8c167b1bf7`.
- Content declaration: no product UI, person, customer data, testimonial, or third-party
  logo is represented. The crop deliberately stops above the site's buttons and client
  strip, so the banner carries the status pill and the headline but no app screenshot.

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
  repository totals. The card itself carries no graph: the calendar next to it draws the
  rhythm, and the card carries only the numbers that calendar cannot show. No product UI,
  person or third-party logo is represented.

## `assets/github-calendar.svg`

- Asset: `assets/github-calendar.svg`.
- Role: the rolling 53-week contribution calendar, drawn above the prose so the account's
  rhythm is visible on arrival rather than below the pinned repositories, which is where
  GitHub places its own copy.
- Source type: contribution counts read from the GitHub GraphQL API for the `magnoscg`
  account, including private repositories, through the authenticated `gh` CLI.
- Generator: `scripts/build-calendar.mjs`, run against the GitHub GraphQL API on a weekly
  schedule. It draws the calendar as plain SVG rectangles and text; no generative model,
  template service or third-party image host is involved.
- Refresh: `.github/workflows/refresh-stats.yml` redraws and commits the calendar every
  Monday, and on demand through `workflow_dispatch`. `npm run calendar` does the same
  locally. The drawing states the date its days were counted and the validator refuses one
  without it.
- Colour scale: quartiles of the days that carry contributions, on GitHub's own five-step
  green scale, so the drawing reads the way the calendar it lifts does.
- Content declaration: one rectangle per day with its contribution count mapped to a shade,
  plus the totals and the count date. No repository name, commit message, product UI,
  person or third-party logo is represented.

## Project images

One image per project sits at the top of its entry in the README, so a reader sees the real product before reading about it. None of them is generated: no generative model was used, and every screen is a real capture. Their hashes are locked by the validator.

### `assets/projects/chollogas.png`

- Asset: `assets/projects/chollogas.png`.
- Source: three screenshots of the published app (map, list, station detail), as published on ogamlabs.com. The app is in Spanish.
- Transformation: screens placed side by side on a tinted background with rounded corners, at 1200x750. Screen contents are not altered.
- Distributed SHA-256: `bb38a41021a8e92906f1a68c2aa7ee1b179109f1a0b5c1340018d2fccbd8d295`.

### `assets/projects/hilo.png`

- Asset: `assets/projects/hilo.png`.
- Source: three English screenshots of the published app (round, solved puzzle, statistics), as published on ogamlabs.com.
- Transformation: screens placed side by side on a tinted background with rounded corners, at 1200x750. Screen contents are not altered.
- Distributed SHA-256: `f629000fc199dae5ce59ce3512b7fd69459bc9fc8d71b18746d48d47e4358a57`.

### `assets/projects/mulligan.png`

- Asset: `assets/projects/mulligan.png`.
- Source: two English screenshots of the published app (builder, deck analysis), as published on ogamlabs.com. The catalogue screenshot is left out because it is dominated by licensed card art; the builder shows one small card thumbnail.
- Transformation: screens placed on a tinted background with rounded corners, at 1800x640; the screens are cropped at the bottom. Screen contents are not altered.
- Distributed SHA-256: `3041be78550530abae9ececd261527a8e901a2495de8f7fa1b30f0c1f854b7f6`.

### `assets/projects/ios-architecture.png`

- Asset: `assets/projects/ios-architecture.png`.
- Source: `docs/images/architecture-list-dark.png` and `architecture-detail-dark.png` from `magnoscg/ios-architecture-reference`, documented in that repository.
- Transformation: screens placed side by side on a tinted background with rounded corners, at 1200x750. Screen contents are not altered.
- Distributed SHA-256: `86f99d0ec171055f9be43f6e3ccb4b82d86a2cee2293b6e60c02ede01747aa09`.

### `assets/projects/anvil.png`

- Asset: `assets/projects/anvil.png`.
- Source: `docs/images/anvil-init.png` from `magnoscg/anvil`, a capture of the real terminal interface documented in that repository.
- Transformation: placed on a tinted background with rounded corners and scaled up, at 1200x750. Screen contents are not altered.
- Distributed SHA-256: `a20f1b040f10f9cdd989995dc9e9c8e56e1875a0daa198a932a749e53ee2ee0a`.

### `assets/projects/agent-build.gif`

- Asset: `assets/projects/agent-build.gif`.
- Source: the promotional recording of the public demo at `https://magnoscg.github.io/agent-build/`, made on 2026-11-06 with version 1.0.3 of the snippet on screen.
- Transformation: cropped to the browser window, sped up 1.5 times, reduced to 760x430 at 12 frames per second with a 128-colour palette. Content is not altered.
- Distributed SHA-256: `cd555753a838d83d7960d245efa2b07c55f6389669e937d708c25f7427d64907`.

Until 2026-08-06 this banner was an AI-generated derivative of an OgamLabs social card. It
was replaced by a capture of the site itself: the profile no longer opens with synthetic
artwork, and the banner now changes only when the site does. It still is presentation, not
evidence of product functionality — product claims in the profile link to public
repositories, case studies, product sites, or App Store pages.

On 2026-11-04 the banner was recaptured when ogamlabs.com moved to a centred hero that names
three apps (CholloGas, Mulligan and Hilo). The site still names the employer; the banner
shows it exactly as published.
