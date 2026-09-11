import assert from 'node:assert/strict';
import test from 'node:test';

import { lostTotals, readCardTotals, render, summarize } from './build-stats.mjs';

const SUMMARY = Object.freeze({
  thisYear: { year: '2026', contributions: 2994, activeDays: 157 },
  longestStreak: 50,
});

const EXTRA = Object.freeze({ since: '2017', pullRequests: 53, repositories: 40 });

test('the card states the date its numbers were counted', () => {
  const svg = render(SUMMARY, EXTRA, '2026-09-11');

  assert.match(svg, /Counted by the GitHub API on 2026-09-11, nothing estimated/);
});

test('the card draws no graph, so it cannot freeze a copy of the official calendar', () => {
  const svg = render(SUMMARY, EXTRA, '2026-09-11');

  assert.equal(svg.match(/<rect\b/g).length, 1);
  assert.doesNotMatch(svg, /CONTRIBUTIONS PER YEAR|LAST 52 WEEKS/);
});

test('the longest streak counts consecutive days across a year boundary', () => {
  const years = [
    { calendar: { weeks: [{ contributionDays: [
      { date: '2025-12-30', contributionCount: 1 },
      { date: '2025-12-31', contributionCount: 4 },
    ] }] } },
    { calendar: { weeks: [{ contributionDays: [
      { date: '2026-01-01', contributionCount: 2 },
      { date: '2026-01-02', contributionCount: 0 },
      { date: '2026-01-03', contributionCount: 7 },
    ] }] } },
  ];

  const summary = summarize(years, '2026-01-03');

  assert.equal(summary.longestStreak, 3);
  assert.deepEqual(summary.thisYear, { year: '2026', contributions: 9, activeDays: 2 });
});

test('a card whose totals went down is refused', () => {
  const previous = readCardTotals(render(SUMMARY, EXTRA, '2026-09-11'));
  const degraded = readCardTotals(render(SUMMARY, { ...EXTRA, pullRequests: 3, repositories: 9 }, '2026-09-12'));

  assert.deepEqual(lostTotals(previous, degraded), ['53 -> 3', '40 -> 9']);
});

test('the year counters may reset when the year does', () => {
  const previous = readCardTotals(render(SUMMARY, EXTRA, '2026-12-31'));
  const fresh = readCardTotals(render(
    { thisYear: { year: '2027', contributions: 12, activeDays: 3 }, longestStreak: 50 },
    EXTRA,
    '2027-01-04',
  ));

  assert.deepEqual(lostTotals(previous, fresh), []);
});

test('the streak may not shrink even across a year boundary', () => {
  const previous = readCardTotals(render(SUMMARY, EXTRA, '2026-12-31'));
  const shrunk = readCardTotals(render(
    { thisYear: { year: '2027', contributions: 12, activeDays: 3 }, longestStreak: 4 },
    EXTRA,
    '2027-01-04',
  ));

  assert.deepEqual(lostTotals(previous, shrunk), ['50 -> 4']);
});
