#!/usr/bin/env node
// Renders assets/github-activity.svg from the GitHub GraphQL API, read through
// the authenticated `gh` CLI so private contributions are counted. Run it by
// hand (`npm run stats`) and commit the result: the profile never loads a
// third-party image, and the numbers stay reviewable in git history.
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const LOGIN = 'magnoscg';
const OUTPUT = 'assets/github-activity.svg';
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function graphql(query) {
  const raw = execFileSync('gh', ['api', 'graphql', '-f', `query=${query}`], { encoding: 'utf8' });
  return JSON.parse(raw).data.user;
}

function yearCollection(year) {
  return graphql(`{ user(login: "${LOGIN}") { contributionsCollection(
    from: "${year}-01-01T00:00:00Z", to: "${year}-12-31T23:59:59Z") {
      totalCommitContributions
      contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } }
  } } }`).contributionsCollection;
}

export function summarize(years, today) {
  const days = new Map();
  for (const { calendar } of years) {
    for (const week of calendar.weeks) {
      for (const day of week.contributionDays) {
        if (day.date <= today) days.set(day.date, day.contributionCount);
      }
    }
  }
  const sorted = [...days.keys()].sort();
  let best = 0;
  let run = 0;
  let previous = null;
  for (const date of sorted) {
    if (days.get(date) > 0) {
      run = previous && dayDiff(previous, date) === 1 ? run + 1 : 1;
      previous = date;
      best = Math.max(best, run);
    }
  }
  const thisYear = today.slice(0, 4);
  const yearDays = sorted.filter((date) => date.startsWith(thisYear));
  return {
    perYear: years.map(({ year, calendar }) => ({ year, total: calendar.totalContributions })),
    thisYear: {
      year: thisYear,
      contributions: yearDays.reduce((sum, date) => sum + days.get(date), 0),
      activeDays: yearDays.filter((date) => days.get(date) > 0).length,
    },
    longestStreak: best,
    lastYear: sorted.filter((date) => dayDiff(date, today) < 364).map((date) => ({ date, count: days.get(date) })),
  };
}

function dayDiff(a, b) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

const number = (value) => new Intl.NumberFormat('en-US').format(value);
const escape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;');

export function render(summary, extra, today) {
  const W = 1280;
  const H = 400;
  const green = '#3fb950';
  const levels = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'];
  const max = Math.max(1, ...summary.lastYear.map(({ count }) => count));
  const level = (count) => (count === 0 ? 0 : Math.min(4, 1 + Math.floor((count / max) * 3.999)));

  const stats = [
    [number(summary.thisYear.contributions), `contributions in ${summary.thisYear.year}`],
    [number(summary.thisYear.activeDays), `active days in ${summary.thisYear.year}`],
    [number(summary.longestStreak), 'day longest streak'],
    [number(extra.pullRequests), 'pull requests'],
    [number(extra.repositories), 'repositories, public and private'],
  ];
  const statSvg = stats.map(([value, label], index) => {
    const x = 132 + index * 200;
    return `<text x="${x}" y="150" class="big">${value}</text>
<text x="${x}" y="182" class="label">${escape(label)}</text>`;
  }).join('\n');

  // One row of bars per year: the account's whole life, not just a good year.
  const barMax = Math.max(1, ...summary.perYear.map(({ total }) => total));
  const barSvg = summary.perYear.map(({ year, total }, index) => {
    const x = 132 + index * 58;
    const h = Math.max(total > 0 ? 3 : 1, Math.round((total / barMax) * 90));
    return `<rect x="${x}" y="${330 - h}" width="42" height="${h}" rx="3" fill="${total > 0 ? green : '#21262d'}"/>
<text x="${x + 21}" y="352" class="axis" text-anchor="middle">${year}</text>`;
  }).join('\n');

  // Last 52 weeks as a heat map, one column per week starting on Sunday.
  const first = summary.lastYear[0]?.date ?? today;
  const offset = new Date(first).getUTCDay();
  const cellSvg = summary.lastYear.map(({ date, count }, index) => {
    const slot = index + offset;
    const x = 740 + Math.floor(slot / 7) * 10;
    const y = 238 + (slot % 7) * 10;
    return `<rect x="${x}" y="${y}" width="8" height="8" rx="2" fill="${levels[level(count)]}"><title>${date}: ${count}</title></rect>`;
  }).join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title">
<title id="title">GitHub activity of ${LOGIN}: ${number(summary.thisYear.contributions)} contributions in ${summary.thisYear.year}, longest streak ${summary.longestStreak} days, on GitHub since ${extra.since}</title>
<style>
  text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; fill: #ffffff; }
  .eyebrow, .axis, .caption { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; fill: #8b949e; letter-spacing: 0.08em; }
  .axis, .caption { letter-spacing: 0; font-size: 12px; }
  .big { font-size: 44px; font-weight: 700; letter-spacing: -0.02em; }
  .label { font-size: 15px; fill: #c9d1d9; }
</style>
<rect width="${W}" height="${H}" fill="#0a0a0a"/>
<circle cx="136" cy="53" r="3.5" fill="${green}"/>
<text x="148" y="58" class="eyebrow">GITHUB ACTIVITY · SINCE ${extra.since} · PRIVATE REPOSITORIES INCLUDED · UPDATED ${today}</text>
${statSvg}
<text x="132" y="225" class="eyebrow">CONTRIBUTIONS PER YEAR</text>
${barSvg}
<text x="740" y="225" class="eyebrow">LAST 52 WEEKS</text>
${cellSvg}
<text x="740" y="340" class="caption">Counted by the GitHub API on ${today}, nothing estimated</text>
</svg>
`;
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const account = graphql(`{ user(login: "${LOGIN}") { createdAt pullRequests { totalCount } repositories(ownerAffiliations: OWNER) { totalCount } } }`);
  const since = account.createdAt.slice(0, 4);
  const years = [];
  for (let year = Number(since); year <= Number(today.slice(0, 4)); year += 1) {
    const collection = yearCollection(year);
    years.push({ year, calendar: collection.contributionCalendar });
  }
  const summary = summarize(years, today);
  const svg = render(summary, {
    since,
    pullRequests: account.pullRequests.totalCount,
    repositories: account.repositories.totalCount,
  }, today);
  await writeFile(join(PROJECT_ROOT, OUTPUT), svg);
  console.log(`${OUTPUT}: ${number(summary.thisYear.contributions)} contributions in ${summary.thisYear.year}, `
    + `${summary.thisYear.activeDays} active days, longest streak ${summary.longestStreak}.`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  await main();
}
