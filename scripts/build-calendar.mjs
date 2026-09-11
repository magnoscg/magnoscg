#!/usr/bin/env node
// Renders assets/github-calendar.svg: the rolling 53-week contribution calendar,
// read from the GitHub GraphQL API through the authenticated `gh` CLI so private
// contributions are counted. A weekly workflow runs it and commits the result,
// and `npm run calendar` does the same by hand.
//
// GitHub draws its own calendar on the profile page, but only below the pinned
// repositories, where a reader arriving at the profile does not see it. This one
// sits under the banner and carries the same data with the count date on it, so
// the top of the page states the account's rhythm instead of implying it. The
// activity card next to it stays what it was: the numbers a calendar cannot show.
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const LOGIN = 'magnoscg';
const OUTPUT = 'assets/github-calendar.svg';
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WEEKS = 53;

const W = 1280;
const H = 310;
const MARGIN = 132;
const GRID_X = 166;
const GRID_Y = 112;
const CELL = 15;
const STEP = 18.5;
// GitHub's own dark scale, so the calendar reads the same here as it does on the
// profile page it is lifted above.
const SCALE = Object.freeze(['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353']);
const MONTHS = Object.freeze(
  ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
);

function graphql(query) {
  const raw = execFileSync('gh', ['api', 'graphql', '-f', `query=${query}`], { encoding: 'utf8' });
  return JSON.parse(raw).data.user;
}

function shiftDays(date, days) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

function weekday(date) {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

// The contributionsCollection window may not span more than a year, so it cannot
// reach back to the Sunday that opens a 53-column grid: 53 weeks is 371 days. Ask
// for the widest window allowed and let the first column stay partly empty, which
// is what GitHub's own calendar does with the same limit.
export function windowStart(today) {
  return shiftDays(today, -364);
}

// The API answers in whole weeks that can overrun the window at both ends, and a
// week is short when it is the one in progress. Rebuild the grid from the dates
// themselves rather than trusting the shape that came back.
export function buildGrid(calendar, today, weeks = WEEKS) {
  const counts = new Map();
  for (const week of calendar.weeks) {
    for (const day of week.contributionDays) {
      if (day.date <= today) counts.set(day.date, day.contributionCount);
    }
  }

  const lastSunday = shiftDays(today, -weekday(today));
  const columns = [];
  for (let column = weeks - 1; column >= 0; column -= 1) {
    const sunday = shiftDays(lastSunday, -column * 7);
    columns.push(Array.from({ length: 7 }, (unused, row) => {
      const date = shiftDays(sunday, row);
      return counts.has(date) ? { date, count: counts.get(date) } : null;
    }));
  }
  return columns;
}

// Quartiles of the days that have contributions, which is what GitHub does: a
// single heavy day should not flatten a year of steady ones into the palest step.
export function thresholds(grid) {
  const active = grid.flat().filter(Boolean).map((day) => day.count).filter((count) => count > 0)
    .sort((a, b) => a - b);
  if (active.length === 0) return [1, 2, 3];
  const at = (fraction) => active[Math.min(active.length - 1, Math.floor(active.length * fraction))];
  return [at(0.25), at(0.5), at(0.75)];
}

export function level(count, [first, second, third]) {
  if (count <= 0) return 0;
  if (count <= first) return 1;
  if (count <= second) return 2;
  if (count <= third) return 3;
  return 4;
}

// One label per month, over the column where that month starts, and never over
// the first column when only a sliver of the month is left in it.
export function monthLabels(grid) {
  const labels = [];
  let previous = null;
  for (const [index, column] of grid.entries()) {
    const first = column.find(Boolean);
    if (!first) continue;
    const month = first.date.slice(0, 7);
    if (month !== previous) {
      if (previous !== null || Number(first.date.slice(8)) <= 7) {
        labels.push({ index, text: MONTHS[Number(first.date.slice(5, 7)) - 1] });
      }
      previous = month;
    }
  }
  return labels.filter(({ index }, position) => position === 0 || index - labels[position - 1].index >= 3);
}

const number = (value) => new Intl.NumberFormat('en-US').format(value);

export function render(grid, today) {
  const steps = thresholds(grid);
  const days = grid.flat().filter(Boolean);
  const total = days.reduce((sum, day) => sum + day.count, 0);
  const active = days.filter((day) => day.count > 0).length;
  const from = days[0]?.date ?? today;

  const cells = grid.map((column, index) => column.map((day, row) => {
    if (!day) return '';
    const x = (GRID_X + index * STEP).toFixed(1);
    const y = (GRID_Y + row * STEP).toFixed(1);
    return `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="3" `
      + `fill="${SCALE[level(day.count, steps)]}"/>`;
  }).join('')).join('\n');

  const months = monthLabels(grid)
    .map(({ index, text }) => `<text x="${(GRID_X + index * STEP).toFixed(1)}" y="102" class="axis">${text}</text>`)
    .join('\n');

  const weekdays = [[1, 'Mon'], [3, 'Wed'], [5, 'Fri']]
    .map(([row, text]) => `<text x="${MARGIN}" y="${(GRID_Y + row * STEP + 11.5).toFixed(1)}" class="axis">${text}</text>`)
    .join('\n');

  const legendRight = GRID_X + (WEEKS - 1) * STEP + CELL;
  const legendCells = SCALE.map((fill, index) => {
    const x = (legendRight - 44 - (SCALE.length - index) * 16).toFixed(1);
    return `<rect x="${x}" y="258" width="12" height="12" rx="2.5" fill="${fill}"/>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="calendar-title">
<title id="calendar-title">Contribution calendar of ${LOGIN} from ${from} to ${today}, private repositories included: ${number(total)} contributions across ${number(active)} active days</title>
<style>
text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; fill: #ffffff; }
.eyebrow, .caption, .axis { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; fill: #8b949e; }
.eyebrow { font-size: 13px; letter-spacing: 0.08em; }
.caption { font-size: 12px; }
.axis { font-size: 11px; }
</style>
<rect width="${W}" height="${H}" fill="#0a0a0a"/>
<circle cx="136" cy="53" r="3.5" fill="#39d353"/>
<text x="148" y="58" class="eyebrow">CONTRIBUTION CALENDAR · ${from} TO ${today} · PRIVATE REPOSITORIES INCLUDED</text>
${months}
${weekdays}
${cells}
<text x="${(legendRight - 44 - SCALE.length * 16 - 8).toFixed(1)}" y="268" class="axis" text-anchor="end">Less</text>
${legendCells}
<text x="${(legendRight - 40).toFixed(1)}" y="268" class="axis">More</text>
<text x="${MARGIN}" y="294" class="caption">${number(total)} contributions across ${number(active)} active days · Counted by the GitHub API on ${today}, nothing estimated</text>
</svg>
`;
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const from = windowStart(today);
  const calendar = graphql(`{ user(login: "${LOGIN}") { contributionsCollection(
    from: "${from}T00:00:00Z", to: "${today}T23:59:59Z") {
    contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } }
  } } }`).contributionsCollection.contributionCalendar;

  // The activity card guards its cumulative totals because they can only rise.
  // A rolling window can legitimately fall, so there is nothing to compare here.
  // What is still worth refusing is an empty answer, which is what a token
  // without `read:user` returns for an account whose work is mostly private.
  if (calendar.totalContributions === 0) {
    throw new Error(
      `${OUTPUT}: the API reported no contributions in the last ${WEEKS} weeks. `
      + 'That is almost certainly a token that cannot see private contributions, not an idle year.',
    );
  }

  const grid = buildGrid(calendar, today);
  await writeFile(join(PROJECT_ROOT, OUTPUT), render(grid, today));
  const days = grid.flat().filter(Boolean);
  console.log(`${OUTPUT}: ${number(days.reduce((sum, day) => sum + day.count, 0))} contributions across `
    + `${days.filter((day) => day.count > 0).length} active days in the last ${WEEKS} weeks.`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  await main();
}
