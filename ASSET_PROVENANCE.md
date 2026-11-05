# Asset provenance

This repository uses three local images. Their origin and transformation are recorded here
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

Until 2026-08-06 this banner was an AI-generated derivative of an OgamLabs social card. It
was replaced by a capture of the site itself: the profile no longer opens with synthetic
artwork, and the banner now changes only when the site does. It still is presentation, not
evidence of product functionality — product claims in the profile link to public
repositories, case studies, product sites, or App Store pages.

On 2026-11-04 the banner was recaptured when ogamlabs.com moved to a centred hero that names
three apps (CholloGas, Mulligan and Hilo). The site still names the employer; the banner
shows it exactly as published.
