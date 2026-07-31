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
  'https://hilo.ogamlabs.com',
  'https://github.com/magnoscg/hilo-case-study',
  'https://github.com/magnoscg/anvil',
]);

const EXPECTED_BANNER = Object.freeze({
  path: 'assets/profile-banner.png',
  width: 1280,
  height: 512,
});

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
  if (!/\*\*Hilo\b[\s\S]{0,120}\bpre-release\b/i.test(markdown)) {
    errors.add('README.md: Hilo must remain explicitly labelled as pre-release');
  }
  if (!/\*\*PRDPlanner\*\*[\s\S]{0,320}public edition is in preparation/i.test(markdown)) {
    errors.add('README.md: PRDPlanner needs its public-edition-in-preparation label');
  }
  if (!/\*\*HarnessHub\*\*[\s\S]{0,360}currently in local beta/i.test(markdown)) {
    errors.add('README.md: HarnessHub needs its local-beta label');
  }

  let banner = null;
  try {
    banner = pngDimensions(await readFile(join(profileRoot, EXPECTED_BANNER.path)));
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
    + `${result.banner.width}x${result.banner.height} local banner.`,
  );
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  await main();
}
