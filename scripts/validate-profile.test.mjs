import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { validateProfile } from './validate-profile.mjs';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const PROJECT_IMAGE_FILES = Object.freeze([
  'chollogas.png',
  'hilo.png',
  'mulligan.png',
  'ios-architecture.png',
  'anvil.png',
  'agent-build.gif',
]);

async function makeFixture(t) {
  const fixture = await mkdtemp(join(tmpdir(), 'magnoscg-profile-'));
  await mkdir(join(fixture, 'assets'));
  await mkdir(join(fixture, '.github/workflows'), { recursive: true });
  await copyFile(join(PROJECT_ROOT, 'README.md'), join(fixture, 'README.md'));
  await copyFile(
    join(PROJECT_ROOT, 'ASSET_PROVENANCE.md'),
    join(fixture, 'ASSET_PROVENANCE.md'),
  );
  await copyFile(
    join(PROJECT_ROOT, 'assets/profile-banner.png'),
    join(fixture, 'assets/profile-banner.png'),
  );
  await copyFile(
    join(PROJECT_ROOT, 'assets/github-activity.svg'),
    join(fixture, 'assets/github-activity.svg'),
  );
  await copyFile(
    join(PROJECT_ROOT, 'assets/github-calendar.svg'),
    join(fixture, 'assets/github-calendar.svg'),
  );
  await mkdir(join(fixture, 'assets/projects'));
  for (const image of PROJECT_IMAGE_FILES) {
    await copyFile(
      join(PROJECT_ROOT, 'assets/projects', image),
      join(fixture, 'assets/projects', image),
    );
  }
  for (const workflow of ['profile-check.yml', 'refresh-stats.yml']) {
    await copyFile(
      join(PROJECT_ROOT, '.github/workflows', workflow),
      join(fixture, '.github/workflows', workflow),
    );
  }
  t.after(() => rm(fixture, { recursive: true, force: true }));
  return fixture;
}

test('the current profile satisfies its public-proof invariants', async () => {
  const result = await validateProfile(PROJECT_ROOT);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.banner, {
    width: 1280,
    height: 352,
    sha256: '695880e8efc5d94b057a83e755232168d16ddf02e4a4b310bf10aa8c167b1bf7',
  });
});

test('externally hosted images are rejected', async (t) => {
  const fixture = await makeFixture(t);
  const readmePath = join(fixture, 'README.md');
  const markdown = await readFile(readmePath, 'utf8');
  await writeFile(readmePath, `${markdown}\n![Tracker](https://example.com/pixel.png)\n`);

  const result = await validateProfile(fixture);
  assert(result.errors.some((error) => error.includes('externally hosted image')));
});

test('the profile image cannot be swapped for another local file', async (t) => {
  const fixture = await makeFixture(t);
  const readmePath = join(fixture, 'README.md');
  const markdown = await readFile(readmePath, 'utf8');
  await writeFile(
    readmePath,
    markdown.replace('assets/profile-banner.png', 'assets/other-banner.png'),
  );

  const result = await validateProfile(fixture);
  assert(result.errors.some((error) => error.includes('profile image must be')));
});

test('the activity card cannot be swapped for another local file', async (t) => {
  const fixture = await makeFixture(t);
  const readmePath = join(fixture, 'README.md');
  const markdown = await readFile(readmePath, 'utf8');
  await writeFile(
    readmePath,
    markdown.replace('assets/github-activity.svg', 'assets/other-card.svg'),
  );
  const result = await validateProfile(fixture);

  assert(result.errors.some((error) => error.includes('activity image must be')));
});

test('a fourth image is rejected', async (t) => {
  const fixture = await makeFixture(t);
  const readmePath = join(fixture, 'README.md');
  const markdown = await readFile(readmePath, 'utf8');
  await writeFile(readmePath, `${markdown}\n![Extra](assets/profile-banner.png)\n`);
  const result = await validateProfile(fixture);

  assert(result.errors.some((error) => error.includes('exactly nine local images')));
});

test('the calendar cannot be swapped for another local file', async (t) => {
  const fixture = await makeFixture(t);
  const readmePath = join(fixture, 'README.md');
  const markdown = await readFile(readmePath, 'utf8');
  await writeFile(
    readmePath,
    markdown.replace('assets/github-calendar.svg', 'assets/other-calendar.svg'),
  );
  const result = await validateProfile(fixture);

  assert(result.errors.some((error) => error.includes('calendar image must be')));
});

test('the calendar must carry its counting date', async (t) => {
  const fixture = await makeFixture(t);
  const calendarPath = join(fixture, 'assets/github-calendar.svg');
  const svg = await readFile(calendarPath, 'utf8');
  await writeFile(calendarPath, svg.replace(/Counted by the GitHub API on \d{4}-\d{2}-\d{2}/, 'Counted'));
  const result = await validateProfile(fixture);

  assert(result.errors.some((error) => error.includes('github-calendar.svg: must state the date')));
});

test('the activity card rejects scripts and remote references', async (t) => {
  const fixture = await makeFixture(t);
  const cardPath = join(fixture, 'assets/github-activity.svg');
  const svg = await readFile(cardPath, 'utf8');
  await writeFile(
    cardPath,
    svg.replace('</svg>', '<script>alert(1)</script><image href="https://example.com/x.png"/></svg>'),
  );
  const result = await validateProfile(fixture);

  assert(result.errors.some((error) => error.includes('active or embedded content')));
  assert(result.errors.some((error) => error.includes('remote references')));
});

test('the activity card must carry its counting date', async (t) => {
  const fixture = await makeFixture(t);
  const cardPath = join(fixture, 'assets/github-activity.svg');
  const svg = await readFile(cardPath, 'utf8');
  await writeFile(cardPath, svg.replace(/Counted by the GitHub API on \d{4}-\d{2}-\d{2}/, 'Counted'));
  const result = await validateProfile(fixture);

  assert(result.errors.some((error) => error.includes('counting date') || error.includes('date its numbers')));
});

test('relative path traversal is rejected', async (t) => {
  const fixture = await makeFixture(t);
  const readmePath = join(fixture, 'README.md');
  const markdown = await readFile(readmePath, 'utf8');
  await writeFile(readmePath, `${markdown}\n[Private file](../notes.md)\n`);

  const result = await validateProfile(fixture);
  assert(result.errors.some((error) => error.includes('unsafe or unsupported reference')));
});

test('in-development products cannot lose their status labels', async (t) => {
  const fixture = await makeFixture(t);
  const readmePath = join(fixture, 'README.md');
  const markdown = await readFile(readmePath, 'utf8');
  await writeFile(
    readmePath,
    markdown.replace('A public edition is in preparation.', 'Available now.'),
  );

  const result = await validateProfile(fixture);
  assert(result.errors.some((error) => error.includes('PRDPlanner needs')));
});

test('Hilo cannot regress to a pre-release status', async (t) => {
  const fixture = await makeFixture(t);
  const readmePath = join(fixture, 'README.md');
  const markdown = await readFile(readmePath, 'utf8');
  await writeFile(readmePath, markdown.replace('published SwiftUI', 'pre-release SwiftUI'));

  const result = await validateProfile(fixture);
  assert(result.errors.some((error) => error.includes('Hilo must remain')));
});

test('Anvil public evidence cannot drift away from its verified totals', async (t) => {
  const fixture = await makeFixture(t);
  const readmePath = join(fixture, 'README.md');
  const markdown = await readFile(readmePath, 'utf8');
  await writeFile(readmePath, markdown.replace('465 automated tests', '464 automated tests'));

  const result = await validateProfile(fixture);
  assert(result.errors.some((error) => error.includes('465 automated tests')));
});

test('the superseded SPM-module claim cannot come back', async (t) => {
  const fixture = await makeFixture(t);
  const readmePath = join(fixture, 'README.md');
  const markdown = await readFile(readmePath, 'utf8');
  await writeFile(
    readmePath,
    `${markdown}\nFour Swift Package modules make Clean Architecture dependency\ndirection visible at compile time.\n`,
  );

  const result = await validateProfile(fixture);
  assert(result.errors.some((error) => error.includes('Four Swift Package modules')));
  assert(result.errors.some((error) => error.includes('dependency direction visible at compile time')));
});

test('the superseded 15-test count cannot come back', async (t) => {
  const fixture = await makeFixture(t);
  const readmePath = join(fixture, 'README.md');
  const markdown = await readFile(readmePath, 'utf8');
  await writeFile(readmePath, `${markdown}\nBacked by 15 Swift Testing checks.\n`);

  const result = await validateProfile(fixture);
  assert(result.errors.some((error) => error.includes('15 Swift Testing checks')));
});

test('a superseded claim is caught whatever its casing', async (t) => {
  const fixture = await makeFixture(t);
  const readmePath = join(fixture, 'README.md');
  const markdown = await readFile(readmePath, 'utf8');
  await writeFile(readmePath, `${markdown}\nfour swift package modules.\n`);

  const result = await validateProfile(fixture);
  assert(result.errors.some((error) => error.includes('Four Swift Package modules')));
});

test('the Swift architecture proof cannot drift from its verified test total', async (t) => {
  const fixture = await makeFixture(t);
  const readmePath = join(fixture, 'README.md');
  const markdown = await readFile(readmePath, 'utf8');
  await writeFile(
    readmePath,
    markdown.replace('253 Swift Testing cases', '252 Swift Testing cases'),
  );

  const result = await validateProfile(fixture);
  assert(result.errors.some((error) => error.includes('253 Swift Testing cases across 33 suites')));
});

test('the CV remains disconnected while it is under revision', async (t) => {
  const fixture = await makeFixture(t);
  const readmePath = join(fixture, 'README.md');
  const markdown = await readFile(readmePath, 'utf8');
  await writeFile(readmePath, `${markdown}\n[CV](assets/oscar-canton-cv.pdf)\n`);

  const result = await validateProfile(fixture);
  assert(result.errors.some((error) => error.includes('CV must stay disconnected')));
});

test('the published CholloGas case study remains connected', async (t) => {
  const fixture = await makeFixture(t);
  const readmePath = join(fixture, 'README.md');
  const markdown = await readFile(readmePath, 'utf8');
  await writeFile(
    readmePath,
    markdown.replace(
      '[Engineering case study](https://github.com/magnoscg/chollogas-case-study)',
      '[Engineering case study](https://github.com/magnoscg)',
    ),
  );

  const result = await validateProfile(fixture);
  assert(result.errors.some((error) => (
    error.includes('missing required public link https://github.com/magnoscg/chollogas-case-study')
  )));
});

test('the banner dimensions cannot drift', async (t) => {
  const fixture = await makeFixture(t);
  const bannerPath = join(fixture, 'assets/profile-banner.png');
  const banner = await readFile(bannerPath);
  banner.writeUInt32BE(1279, 16);
  await writeFile(bannerPath, banner);

  const result = await validateProfile(fixture);
  assert(result.errors.some((error) => error.includes('expected 1280x352')));
});

test('the banner bytes cannot drift while dimensions stay unchanged', async (t) => {
  const fixture = await makeFixture(t);
  const bannerPath = join(fixture, 'assets/profile-banner.png');
  const banner = await readFile(bannerPath);
  banner[banner.length - 1] ^= 0x01;
  await writeFile(bannerPath, banner);

  const result = await validateProfile(fixture);
  assert(result.errors.some((error) => error.includes('SHA-256 must be')));
});

test('banner provenance is required and hash-bound', async (t) => {
  const fixture = await makeFixture(t);
  const provenancePath = join(fixture, 'ASSET_PROVENANCE.md');
  const provenance = await readFile(provenancePath, 'utf8');
  await writeFile(
    provenancePath,
    provenance.replace(
      '695880e8efc5d94b057a83e755232168d16ddf02e4a4b310bf10aa8c167b1bf7',
      '0000000000000000000000000000000000000000000000000000000000000000',
    ),
  );

  const result = await validateProfile(fixture);
  assert(result.errors.some((error) => error.includes('ASSET_PROVENANCE.md: missing')));
});

test('checkout credentials must stay disabled explicitly', async (t) => {
  const fixture = await makeFixture(t);
  const workflowPath = join(fixture, '.github/workflows/profile-check.yml');
  const workflow = await readFile(workflowPath, 'utf8');
  await writeFile(
    workflowPath,
    workflow.replace('        with:\n          persist-credentials: false\n', ''),
  );

  const result = await validateProfile(fixture);
  assert(result.errors.some((error) => error.includes('persist-credentials: false')));
});

test('workflow write permissions and pull_request_target are rejected', async (t) => {
  const fixture = await makeFixture(t);
  const workflowPath = join(fixture, '.github/workflows/profile-check.yml');
  const workflow = await readFile(workflowPath, 'utf8');
  await writeFile(
    workflowPath,
    workflow
      .replace('pull_request:', 'pull_request_target:')
      .replace('contents: read', 'contents: write'),
  );

  const result = await validateProfile(fixture);
  assert(result.errors.some((error) => error.includes('pull_request_target is not allowed')));
  assert(result.errors.some((error) => error.includes('write permission is not allowed')));
});

test('workflow actions must be allowlisted and pinned to approved SHAs', async (t) => {
  const fixture = await makeFixture(t);
  const workflowPath = join(fixture, '.github/workflows/profile-check.yml');
  const workflow = await readFile(workflowPath, 'utf8');
  await writeFile(
    workflowPath,
    workflow.replace(
      'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1',
      'example/checkout@v7',
    ),
  );

  const result = await validateProfile(fixture);
  assert(result.errors.some((error) => error.includes('pinned to a full commit SHA')));
});

test('a pinned but unapproved workflow action is rejected', async (t) => {
  const fixture = await makeFixture(t);
  const workflowPath = join(fixture, '.github/workflows/profile-check.yml');
  const workflow = await readFile(workflowPath, 'utf8');
  await writeFile(
    workflowPath,
    workflow.replace('actions/checkout@', 'example/checkout@'),
  );

  const result = await validateProfile(fixture);
  assert(result.errors.some((error) => error.includes('action is not allowlisted')));
});

test('the workflow must run both profile checks', async (t) => {
  const fixture = await makeFixture(t);
  const workflowPath = join(fixture, '.github/workflows/profile-check.yml');
  const workflow = await readFile(workflowPath, 'utf8');
  await writeFile(workflowPath, workflow.replace('run: npm run validate', 'run: npm test'));

  const result = await validateProfile(fixture);
  assert(result.errors.some((error) => error.includes('missing required command "npm run validate"')));
});

test('a workflow outside the allowlist is rejected', async (t) => {
  const fixture = await makeFixture(t);
  await writeFile(
    join(fixture, '.github/workflows/deploy.yml'),
    'name: Deploy\non: push\n',
  );

  const result = await validateProfile(fixture);
  assert(result.errors.some((error) => error.includes('deploy.yml: workflow is not allowlisted')));
});

test('the refresh workflow must exist', async (t) => {
  const fixture = await makeFixture(t);
  await rm(join(fixture, '.github/workflows/refresh-stats.yml'));

  const result = await validateProfile(fixture);
  assert(result.errors.some((error) => error.includes('refresh-stats.yml: file is missing')));
});

test('the refresh workflow cannot widen its write permissions', async (t) => {
  const fixture = await makeFixture(t);
  const workflowPath = join(fixture, '.github/workflows/refresh-stats.yml');
  const workflow = await readFile(workflowPath, 'utf8');
  await writeFile(workflowPath, workflow.replace('      contents: write', '      packages: write'));

  const result = await validateProfile(fixture);
  assert(result.errors.some((error) => error.includes('write permission is not allowed (packages)')));
});

test('the refresh workflow cannot skip its own validation before committing', async (t) => {
  const fixture = await makeFixture(t);
  const workflowPath = join(fixture, '.github/workflows/refresh-stats.yml');
  const workflow = await readFile(workflowPath, 'utf8');
  await writeFile(workflowPath, workflow.replace('run: npm run validate', 'run: true'));

  const result = await validateProfile(fixture);
  assert(result.errors.some((error) => (
    error.includes('refresh-stats.yml: missing required command "npm run validate"')
  )));
});

test('every workflow is held to the action allowlist, not just the check one', async (t) => {
  const fixture = await makeFixture(t);
  const workflowPath = join(fixture, '.github/workflows/refresh-stats.yml');
  const workflow = await readFile(workflowPath, 'utf8');
  await writeFile(workflowPath, workflow.replace('actions/checkout@', 'example/checkout@'));

  const result = await validateProfile(fixture);
  assert(result.errors.some((error) => (
    error.includes('refresh-stats.yml: action is not allowlisted')
  )));
});

test('a project demoted from a heading to bold text loses its label', async (t) => {
  const fixture = await makeFixture(t);
  const readmePath = join(fixture, 'README.md');
  const markdown = await readFile(readmePath, 'utf8');
  await writeFile(readmePath, markdown.replace('### PRDPlanner', '**PRDPlanner**'));

  const result = await validateProfile(fixture);
  assert(result.errors.some((error) => error.includes('PRDPlanner needs its')));
});

test('a project image cannot change without updating its locked hash', async (t) => {
  const fixture = await makeFixture(t);
  await writeFile(join(fixture, 'assets/projects/hilo.png'), 'not the reviewed image');

  const result = await validateProfile(fixture);

  assert(result.errors.some((error) => (
    error.startsWith('assets/projects/hilo.png: SHA-256 must be')
  )));
});

test('a missing project image is reported', async (t) => {
  const fixture = await makeFixture(t);
  await rm(join(fixture, 'assets/projects/agent-build.gif'));

  const result = await validateProfile(fixture);

  assert(result.errors.includes('assets/projects/agent-build.gif: file is missing or unreadable'));
});

test('project images must keep their order in the README', async (t) => {
  const fixture = await makeFixture(t);
  const readmePath = join(fixture, 'README.md');
  const markdown = await readFile(readmePath, 'utf8');
  await writeFile(
    readmePath,
    markdown.replace('assets/projects/chollogas.png', 'assets/projects/other.png'),
  );

  const result = await validateProfile(fixture);

  assert(result.errors.includes('README.md: project image 1 must be assets/projects/chollogas.png'));
});

test('every project image needs its provenance', async (t) => {
  const fixture = await makeFixture(t);
  const provenancePath = join(fixture, 'ASSET_PROVENANCE.md');
  const provenance = await readFile(provenancePath, 'utf8');
  await writeFile(provenancePath, provenance.replace('- Asset: `assets/projects/anvil.png`.', ''));

  const result = await validateProfile(fixture);

  assert(result.errors.some((error) => error.includes('assets/projects/anvil.png')));
});
