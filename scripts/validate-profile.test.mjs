import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { validateProfile } from './validate-profile.mjs';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function makeFixture(t) {
  const fixture = await mkdtemp(join(tmpdir(), 'magnoscg-profile-'));
  await mkdir(join(fixture, 'assets'));
  await copyFile(join(PROJECT_ROOT, 'README.md'), join(fixture, 'README.md'));
  await copyFile(
    join(PROJECT_ROOT, 'assets/profile-banner.png'),
    join(fixture, 'assets/profile-banner.png'),
  );
  t.after(() => rm(fixture, { recursive: true, force: true }));
  return fixture;
}

test('the current profile satisfies its public-proof invariants', async () => {
  const result = await validateProfile(PROJECT_ROOT);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.banner, { width: 1280, height: 512 });
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
  await writeFile(readmePath, markdown.replace('421 automated tests', '420 automated tests'));

  const result = await validateProfile(fixture);
  assert(result.errors.some((error) => error.includes('421 automated tests')));
});

test('the CV remains disconnected while it is under revision', async (t) => {
  const fixture = await makeFixture(t);
  const readmePath = join(fixture, 'README.md');
  const markdown = await readFile(readmePath, 'utf8');
  await writeFile(readmePath, `${markdown}\n[CV](assets/oscar-canton-cv.pdf)\n`);

  const result = await validateProfile(fixture);
  assert(result.errors.some((error) => error.includes('CV must stay disconnected')));
});

test('the CholloGas case study remains disconnected until it is public', async (t) => {
  const fixture = await makeFixture(t);
  const readmePath = join(fixture, 'README.md');
  const markdown = await readFile(readmePath, 'utf8');
  await writeFile(
    readmePath,
    `${markdown}\n[Engineering case study](https://github.com/magnoscg/chollogas-case-study)\n`,
  );

  const result = await validateProfile(fixture);
  assert(result.errors.some((error) => error.includes('CholloGas case study must stay disconnected')));
});

test('the banner dimensions cannot drift', async (t) => {
  const fixture = await makeFixture(t);
  const bannerPath = join(fixture, 'assets/profile-banner.png');
  const banner = await readFile(bannerPath);
  banner.writeUInt32BE(1279, 16);
  await writeFile(bannerPath, banner);

  const result = await validateProfile(fixture);
  assert(result.errors.some((error) => error.includes('expected 1280x512')));
});
