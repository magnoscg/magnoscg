import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REQUIRED_SECTIONS = Object.freeze([
  '## Selected work',
  '## AI-assisted engineering in development',
  '## Engineering focus',
]);

const REQUIRED_LINKS = Object.freeze([
  'https://ogamlabs.com',
  'https://www.linkedin.com/in/oscarcantongarcia/',
  'mailto:soporte@ogamlabs.com',
  'https://chollogas.ogamlabs.com',
  'https://apps.apple.com/es/app/chollogas-gasolineras-baratas/id6773014516',
  'https://github.com/magnoscg/chollogas-case-study',
  'https://hilo.ogamlabs.com',
  'https://apps.apple.com/es/app/id6779929637',
  'https://github.com/magnoscg/hilo-case-study',
  'https://github.com/magnoscg/ios-architecture-reference',
  'https://github.com/magnoscg/ios-architecture-reference/actions/workflows/ci.yml',
  'https://github.com/magnoscg/anvil',
  'https://github.com/magnoscg/anvil/actions/workflows/ci.yml',
  'https://github.com/magnoscg/prdplanner-case-study',
  'https://github.com/magnoscg/harnesshub-case-study',
]);

const ANVIL_PUBLIC_PROOF = Object.freeze([
  'transactional generator',
  '421 automated tests',
  '34 provenance-tracked skills',
  '25 self-contained Swift 6 examples',
]);

const CHOLLOGAS_PUBLIC_PROOF = Object.freeze([
  'public engineering case study',
  'Swift 6 offline-first client',
  'official-data ingestion',
  'production operations',
  'without exposing the product source',
]);

const ARCHITECTURE_PUBLIC_PROOF = Object.freeze([
  'single app target',
  'inspired by Clean Architecture',
  'MVVM',
  'typed Router navigation',
  'manual factory-based dependency injection',
  '194 Swift Testing cases across 27 suites',
  'zero third-party package dependencies',
]);

const SUPERSEDED_ARCHITECTURE_CLAIMS = Object.freeze([
  'Four Swift Package modules',
  '15 Swift Testing checks',
  'dependency direction visible at compile time',
]);

const EXPECTED_BANNER = Object.freeze({
  path: 'assets/profile-banner.png',
  width: 1280,
  height: 512,
  sha256: '03354a6381f514fe9f4da70b916b401dbbb59158c150a5e7ed453b4428d17d08',
});

const EXPECTED_ACTIVITY = Object.freeze({
  path: 'assets/github-activity.svg',
  generator: 'scripts/build-stats.mjs',
});

const PROVENANCE_PATH = 'ASSET_PROVENANCE.md';
const WORKFLOWS_DIR = '.github/workflows';
const CHECK_WORKFLOW = 'profile-check.yml';
const REFRESH_WORKFLOW = 'refresh-stats.yml';
// Every workflow in the directory is held to the same rules, so a second file
// cannot slip in unchecked. Writing is a per-file grant rather than a blanket
// ban: the refresh job has to commit the card it recounts, and saying so in
// YAML keeps that privilege visible here and to a reader, instead of hiding it
// inside a personal access token no checker can see.
const WORKFLOW_RULES = new Map([
  [CHECK_WORKFLOW, { writePermissions: [] }],
  [REFRESH_WORKFLOW, { writePermissions: ['contents'] }],
]);
const REQUIRED_WORKFLOW_COMMANDS = Object.freeze(['npm test', 'npm run validate']);
const APPROVED_ACTIONS = new Map([
  ['actions/checkout', '3d3c42e5aac5ba805825da76410c181273ba90b1'],
]);
const REQUIRED_PROVENANCE_STATEMENTS = Object.freeze([
  '- Asset: `assets/profile-banner.png`.',
  '- Source type: first-party screen capture.',
  '- Generator: none. No generative model was used.',
  '- Captured: 2026-08-06.',
  '- Reference asset: the English page of ogamlabs.com at release `1.5.0`, served from its locally built deployment artifact.',
  '- Reference dimensions: 3400x2000.',
  '- Reference SHA-256: `3fd87a13f9d3dc6f550e869b1e7bc5eb85c0d27958ea074f45c030b7f42291fe`.',
  '- Capture method: headless Chrome at a 1700x1000 CSS viewport with device scale factor 2 and scrollbars hidden.',
  '- Transformation: cropped to 2600x1040 and resampled to 1280x512. Capturing at 2x and reducing by 2.03 keeps the body copy legible at the width GitHub renders. No retouching, recolouring or composition was applied.',
  '- Distributed dimensions: 1280x512.',
  `- Distributed SHA-256: \`${EXPECTED_BANNER.sha256}\`.`,
  '- Content declaration: no product UI, person, customer data, testimonial, or third-party logo is represented.',
  `- Asset: \`${EXPECTED_ACTIVITY.path}\`.`,
  `- Generator: \`${EXPECTED_ACTIVITY.generator}\`, run against the GitHub GraphQL API on a weekly schedule.`,
]);

export function markdownReferences(markdown) {
  const references = [];
  const pattern = /(!?)\[([^\]]*)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g;

  for (const match of markdown.matchAll(pattern)) {
    references.push({
      image: match[1] === '!',
      label: match[2].trim(),
      target: match[3].trim(),
    });
  }

  return references;
}

function pngDimensions(data) {
  const signature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
  if (
    data.length < 24
    || !signature.every((byte, index) => data[index] === byte)
    || data.toString('ascii', 12, 16) !== 'IHDR'
  ) {
    return null;
  }

  return {
    width: data.readUInt32BE(16),
    height: data.readUInt32BE(20),
  };
}

function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}

// The activity card is generated locally and committed, so it must stay a
// self-contained drawing: no script, no foreign markup, no remote fetch.
function validateActivitySvg(svg, errors) {
  if (!/^\s*<svg\b/.test(svg)) {
    errors.add(`${EXPECTED_ACTIVITY.path}: expected an SVG document`);
  }
  if (/<(?:script|foreignObject|iframe|image|use)\b/i.test(svg)) {
    errors.add(`${EXPECTED_ACTIVITY.path}: active or embedded content is not allowed`);
  }
  if (/\b(?:https?:)?\/\/(?!www\.w3\.org\/)/i.test(svg) || /\bon[a-z]+\s*=/i.test(svg)) {
    errors.add(`${EXPECTED_ACTIVITY.path}: remote references and event handlers are not allowed`);
  }
  if (!/Counted by the GitHub API on \d{4}-\d{2}-\d{2}/.test(svg)) {
    errors.add(`${EXPECTED_ACTIVITY.path}: must state the date its numbers were counted`);
  }
}

function validateWorkflow(workflow, errors, path, rules) {
  if (/^\s*pull_request_target\s*:/m.test(workflow)) {
    errors.add(`${path}: pull_request_target is not allowed`);
  }
  if (!/^permissions:\r?\n  contents: read[ \t]*$/m.test(workflow)) {
    errors.add(`${path}: top-level permissions must be contents: read`);
  }
  for (const [, permission] of workflow.matchAll(/^\s{2,}([A-Za-z0-9_-]+):\s*write\s*$/gm)) {
    if (!rules.writePermissions.includes(permission)) {
      errors.add(`${path}: write permission is not allowed (${permission})`);
    }
  }
  if (!/^\s+timeout-minutes:\s*5\s*$/m.test(workflow)) {
    errors.add(`${path}: every job must keep a five-minute timeout`);
  }
  for (const command of REQUIRED_WORKFLOW_COMMANDS) {
    if (!new RegExp(`^\\s+run:\\s*${command.replace(/ /g, '\\s+')}\\s*$`, 'm').test(workflow)) {
      errors.add(`${path}: missing required command "${command}"`);
    }
  }

  const actionReferences = [...workflow.matchAll(/^\s*uses:\s*([^\s#]+)(?:\s+#.*)?$/gm)]
    .map((match) => match[1]);
  if (actionReferences.length === 0) {
    errors.add(`${path}: expected at least one SHA-pinned action`);
  }

  for (const reference of actionReferences) {
    const pinned = reference.match(/^([^@]+)@([0-9a-f]{40})$/i);
    if (!pinned) {
      errors.add(`${path}: action must be pinned to a full commit SHA (${reference})`);
      continue;
    }
    const [, action, revision] = pinned;
    const approvedRevision = APPROVED_ACTIONS.get(action);
    if (!approvedRevision) {
      errors.add(`${path}: action is not allowlisted (${action})`);
    } else if (revision.toLowerCase() !== approvedRevision) {
      errors.add(`${path}: action revision is not approved (${reference})`);
    }
  }

  const checkoutStep = workflow.split(/\n(?=\s{6}-\s)/)
    .find((step) => step.includes('uses: actions/checkout@'));
  if (!checkoutStep || !/^\s+persist-credentials:\s*false\s*$/m.test(checkoutStep)) {
    errors.add(`${path}: checkout must set persist-credentials: false`);
  }
}

async function validateWorkflows(profileRoot, errors) {
  let names;
  try {
    names = (await readdir(join(profileRoot, WORKFLOWS_DIR)))
      .filter((name) => /\.ya?ml$/i.test(name))
      .sort();
  } catch {
    errors.add(`${WORKFLOWS_DIR}: directory is missing or unreadable`);
    return;
  }

  for (const expected of WORKFLOW_RULES.keys()) {
    if (!names.includes(expected)) {
      errors.add(`${WORKFLOWS_DIR}/${expected}: file is missing`);
    }
  }

  for (const name of names) {
    const path = `${WORKFLOWS_DIR}/${name}`;
    const rules = WORKFLOW_RULES.get(name);
    if (!rules) {
      errors.add(`${path}: workflow is not allowlisted`);
      continue;
    }
    try {
      validateWorkflow(await readFile(join(profileRoot, path), 'utf8'), errors, path, rules);
    } catch {
      errors.add(`${path}: file is unreadable`);
    }
  }
}

function isAllowedReference(target) {
  if (target.startsWith('#')) {
    return true;
  }
  if (/^(?:https:\/\/|mailto:)/i.test(target)) {
    return true;
  }
  return (
    !isAbsolute(target)
    && !/^[a-z][a-z0-9+.-]*:/i.test(target)
    && !target.split('/').includes('..')
  );
}

export async function validateProfile(root = process.cwd()) {
  const profileRoot = resolve(root);
  const errors = new Set();
  const markdown = await readFile(join(profileRoot, 'README.md'), 'utf8');
  const normalizedMarkdown = markdown.replace(/\s+/g, ' ');
  const references = markdownReferences(markdown);

  for (const section of REQUIRED_SECTIONS) {
    if (!markdown.includes(section)) {
      errors.add(`README.md: missing required section "${section}"`);
    }
  }

  const targets = new Set(references.map(({ target }) => target));
  for (const target of REQUIRED_LINKS) {
    if (!targets.has(target)) {
      errors.add(`README.md: missing required public link ${target}`);
    }
  }

  for (const reference of references) {
    if (!isAllowedReference(reference.target)) {
      errors.add(`README.md: unsafe or unsupported reference ${reference.target}`);
    }
    if (reference.image && /^https?:\/\//i.test(reference.target)) {
      errors.add(`README.md: externally hosted image is not allowed (${reference.target})`);
    }
    if (reference.image && reference.label === '') {
      errors.add(`README.md: image ${reference.target} needs descriptive alt text`);
    }
  }

  const images = references.filter(({ image }) => image);
  if (images.length !== 2) {
    errors.add('README.md: expected exactly two local images, the banner then the activity card');
  } else {
    if (images[0].target !== EXPECTED_BANNER.path) {
      errors.add(`README.md: profile image must be ${EXPECTED_BANNER.path}`);
    }
    if (images[1].target !== EXPECTED_ACTIVITY.path) {
      errors.add(`README.md: activity image must be ${EXPECTED_ACTIVITY.path}`);
    }
  }

  if (/(?:file:\/\/|\/Users\/|\/home\/|[A-Za-z]:\\)/i.test(markdown)) {
    errors.add('README.md: contains a machine-local path');
  }
  if (/<(?:img|script|iframe)\b/i.test(markdown)) {
    errors.add('README.md: raw embedded media is not allowed');
  }
  if (/\[(?:CV|résumé|resume)\]\([^)]*\)/i.test(markdown)) {
    errors.add('README.md: CV must stay disconnected while it is under revision');
  }
  if (!/^### Hilo$[\s\S]{0,120}\bpublished\b/im.test(markdown)) {
    errors.add('README.md: Hilo must remain explicitly labelled as published');
  }
  for (const proof of CHOLLOGAS_PUBLIC_PROOF) {
    if (!normalizedMarkdown.includes(proof)) {
      errors.add(`README.md: CholloGas public proof must include "${proof}"`);
    }
  }
  for (const proof of ARCHITECTURE_PUBLIC_PROOF) {
    if (!normalizedMarkdown.includes(proof)) {
      errors.add(`README.md: architecture public proof must include "${proof}"`);
    }
  }
  const lowercaseMarkdown = normalizedMarkdown.toLowerCase();
  for (const claim of SUPERSEDED_ARCHITECTURE_CLAIMS) {
    if (lowercaseMarkdown.includes(claim.toLowerCase())) {
      errors.add(`README.md: architecture contains superseded claim "${claim}"`);
    }
  }
  for (const proof of ANVIL_PUBLIC_PROOF) {
    if (!normalizedMarkdown.includes(proof)) {
      errors.add(`README.md: Anvil public proof must include "${proof}"`);
    }
  }
  if (!/^### PRDPlanner$[\s\S]{0,320}public edition is in preparation/im.test(markdown)) {
    errors.add('README.md: PRDPlanner needs its public-edition-in-preparation label');
  }
  if (!/^### HarnessHub$[\s\S]{0,360}currently in local beta/im.test(markdown)) {
    errors.add('README.md: HarnessHub needs its local-beta label');
  }

  let banner = null;
  let bannerData = null;
  try {
    bannerData = await readFile(join(profileRoot, EXPECTED_BANNER.path));
    const dimensions = pngDimensions(bannerData);
    banner = dimensions ? { ...dimensions, sha256: sha256(bannerData) } : null;
  } catch {
    errors.add(`${EXPECTED_BANNER.path}: file is missing or unreadable`);
  }

  if (!banner) {
    errors.add(`${EXPECTED_BANNER.path}: expected a valid PNG`);
  } else if (
    banner.width !== EXPECTED_BANNER.width
    || banner.height !== EXPECTED_BANNER.height
  ) {
    errors.add(
      `${EXPECTED_BANNER.path}: expected ${EXPECTED_BANNER.width}x${EXPECTED_BANNER.height}, `
      + `found ${banner.width}x${banner.height}`,
    );
  }
  if (bannerData && banner?.sha256 !== EXPECTED_BANNER.sha256) {
    errors.add(
      `${EXPECTED_BANNER.path}: SHA-256 must be ${EXPECTED_BANNER.sha256}, `
      + `found ${banner?.sha256 ?? 'unavailable'}`,
    );
  }

  try {
    const activity = await readFile(join(profileRoot, EXPECTED_ACTIVITY.path), 'utf8');
    validateActivitySvg(activity, errors);
  } catch {
    errors.add(`${EXPECTED_ACTIVITY.path}: file is missing or unreadable`);
  }

  try {
    const provenance = await readFile(join(profileRoot, PROVENANCE_PATH), 'utf8');
    const normalizedProvenance = provenance.replace(/\s+/g, ' ');
    for (const statement of REQUIRED_PROVENANCE_STATEMENTS) {
      if (!normalizedProvenance.includes(statement.replace(/\s+/g, ' '))) {
        errors.add(`${PROVENANCE_PATH}: missing required statement "${statement}"`);
      }
    }
    if (/(?:file:\/\/|\/Users\/|\/home\/|[A-Za-z]:\\)/i.test(provenance)) {
      errors.add(`${PROVENANCE_PATH}: contains a machine-local path`);
    }
  } catch {
    errors.add(`${PROVENANCE_PATH}: file is missing or unreadable`);
  }

  await validateWorkflows(profileRoot, errors);

  return {
    banner,
    errors: [...errors].sort(),
    linkCount: references.filter(({ image }) => !image).length,
  };
}

async function main() {
  const result = await validateProfile();
  if (result.errors.length > 0) {
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `Validated ${result.linkCount} links, a `
    + `${result.banner.width}x${result.banner.height} hash-locked local banner `
    + 'and a self-contained activity card.',
  );
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  await main();
}
