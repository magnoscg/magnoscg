import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
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
  'Four Swift Package modules',
  'Clean Architecture dependency direction',
  'MVVM',
  'typed Router navigation',
  '15 Swift Testing checks',
  'zero third-party package dependencies',
]);

const EXPECTED_BANNER = Object.freeze({
  path: 'assets/profile-banner.png',
  width: 1280,
  height: 512,
  sha256: '15d877758fac8aaf91e7959cd3a47fba9ad54bb97eedc33ef0a14fe1f7c78673',
});

const PROVENANCE_PATH = 'ASSET_PROVENANCE.md';
const WORKFLOW_PATH = '.github/workflows/profile-check.yml';
const APPROVED_ACTIONS = new Map([
  ['actions/checkout', '3d3c42e5aac5ba805825da76410c181273ba90b1'],
]);
const REQUIRED_PROVENANCE_STATEMENTS = Object.freeze([
  '- Asset: `assets/profile-banner.png`.',
  '- Source type: AI-assisted first-party derivative.',
  '- Generator: OpenAI ImageGen.',
  '- Generated: 2026-07-31.',
  '- Reference asset: PortfolioWeb `assets/og-image.png`, a first-party OgamLabs social card.',
  '- Reference dimensions: 1200x630.',
  '- Reference SHA-256: `a507fff26f858d89d845d2f468b071c25fd8b7bbdf8550766090792412700291`.',
  '- Generated-output dimensions: 1983x793.',
  '- Generated-output SHA-256: `dd6ebe676c2b075244b6460513ea56bf421d1a57343cc51f9ef2f502e7e21a6b`.',
  '- Transformation: resized proportionally to 1280x512 with macOS `sips -z 512 1280`; no crop or additional retouching was applied.',
  '- Distributed dimensions: 1280x512.',
  `- Distributed SHA-256: \`${EXPECTED_BANNER.sha256}\`.`,
  '- Content declaration: no product UI, person, customer data, testimonial, or third-party logo is represented.',
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

function validateWorkflow(workflow, errors) {
  if (/^\s*pull_request_target\s*:/m.test(workflow)) {
    errors.add(`${WORKFLOW_PATH}: pull_request_target is not allowed`);
  }
  if (!/^permissions:\r?\n  contents: read[ \t]*$/m.test(workflow)) {
    errors.add(`${WORKFLOW_PATH}: top-level permissions must be contents: read`);
  }
  if (/^\s{2,}[A-Za-z0-9_-]+:\s*write\s*$/m.test(workflow)) {
    errors.add(`${WORKFLOW_PATH}: write permissions are not allowed`);
  }
  if (!/^\s+timeout-minutes:\s*5\s*$/m.test(workflow)) {
    errors.add(`${WORKFLOW_PATH}: validate job must keep a five-minute timeout`);
  }
  for (const command of ['npm test', 'npm run validate']) {
    if (!new RegExp(`^\\s+run:\\s*${command.replace(/ /g, '\\s+')}\\s*$`, 'm').test(workflow)) {
      errors.add(`${WORKFLOW_PATH}: missing required command "${command}"`);
    }
  }

  const actionReferences = [...workflow.matchAll(/^\s*uses:\s*([^\s#]+)(?:\s+#.*)?$/gm)]
    .map((match) => match[1]);
  if (actionReferences.length === 0) {
    errors.add(`${WORKFLOW_PATH}: expected at least one SHA-pinned action`);
  }

  for (const reference of actionReferences) {
    const pinned = reference.match(/^([^@]+)@([0-9a-f]{40})$/i);
    if (!pinned) {
      errors.add(`${WORKFLOW_PATH}: action must be pinned to a full commit SHA (${reference})`);
      continue;
    }
    const [, action, revision] = pinned;
    const approvedRevision = APPROVED_ACTIONS.get(action);
    if (!approvedRevision) {
      errors.add(`${WORKFLOW_PATH}: action is not allowlisted (${action})`);
    } else if (revision.toLowerCase() !== approvedRevision) {
      errors.add(`${WORKFLOW_PATH}: action revision is not approved (${reference})`);
    }
  }

  const checkoutStep = workflow.split(/\n(?=\s{6}-\s)/)
    .find((step) => step.includes('uses: actions/checkout@'));
  if (!checkoutStep || !/^\s+persist-credentials:\s*false\s*$/m.test(checkoutStep)) {
    errors.add(`${WORKFLOW_PATH}: checkout must set persist-credentials: false`);
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
  if (images.length !== 1) {
    errors.add('README.md: expected exactly one local profile image');
  } else if (images[0].target !== EXPECTED_BANNER.path) {
    errors.add(`README.md: profile image must be ${EXPECTED_BANNER.path}`);
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
  if (!/\*\*Hilo\b[\s\S]{0,120}\bpublished\b/i.test(markdown)) {
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
  for (const proof of ANVIL_PUBLIC_PROOF) {
    if (!normalizedMarkdown.includes(proof)) {
      errors.add(`README.md: Anvil public proof must include "${proof}"`);
    }
  }
  if (!/\*\*PRDPlanner\*\*[\s\S]{0,320}public edition is in preparation/i.test(markdown)) {
    errors.add('README.md: PRDPlanner needs its public-edition-in-preparation label');
  }
  if (!/\*\*HarnessHub\*\*[\s\S]{0,360}currently in local beta/i.test(markdown)) {
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

  try {
    const workflow = await readFile(join(profileRoot, WORKFLOW_PATH), 'utf8');
    validateWorkflow(workflow, errors);
  } catch {
    errors.add(`${WORKFLOW_PATH}: file is missing or unreadable`);
  }

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
    `Validated ${result.linkCount} links and a `
    + `${result.banner.width}x${result.banner.height} hash-locked local banner.`,
  );
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  await main();
}
