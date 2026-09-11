import assert from 'node:assert/strict';
import test from 'node:test';

import { buildGrid, level, monthLabels, render, thresholds, windowStart } from './build-calendar.mjs';

// A calendar as the API answers it: whole weeks that overrun the window at both
// ends, with the week in progress cut short.
function apiCalendar(from, days, counts = () => 1) {
  const weeks = [];
  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(Date.parse(`${from}T00:00:00Z`) + offset * 86_400_000)
      .toISOString().slice(0, 10);
    const row = new Date(`${date}T00:00:00Z`).getUTCDay();
    if (row === 0 || weeks.length === 0) weeks.push({ contributionDays: [] });
    weeks.at(-1).contributionDays.push({ date, contributionCount: counts(date) });
  }
  return { weeks };
}

test('the grid is 53 whole columns ending on the week that holds today', () => {
  const grid = buildGrid(apiCalendar('2025-01-01', 700), '2026-09-11');

  assert.equal(grid.length, 53);
  assert.ok(grid.every((column) => column.length === 7));
  assert.equal(grid.at(-1)[5].date, '2026-09-11');
});

test('the requested window never exceeds the year the API allows', () => {
  for (const today of ['2026-09-11', '2026-09-13', '2024-02-29', '2025-01-01']) {
    const span = (Date.parse(today) - Date.parse(windowStart(today))) / 86_400_000;
    assert.ok(span <= 365, `${today}: asked for ${span} days`);
  }
});

test('the first column is the one the year-long window cuts short', () => {
  const grid = buildGrid(apiCalendar(windowStart('2026-09-11'), 365), '2026-09-11');

  assert.equal(grid.length, 53);
  assert.ok(grid[0].some((day) => day === null), 'the oldest column starts mid-week');
  assert.ok(grid[0].some(Boolean), 'but it still carries the days the window reaches');
});

test('days after today are left empty rather than drawn as zero', () => {
  const grid = buildGrid(apiCalendar('2025-01-01', 700), '2026-09-11');

  assert.equal(grid.at(-1)[6], null, 'Saturday has not happened yet');
  assert.ok(grid.at(-1).slice(0, 6).every(Boolean));
});

test('dates the API never sent are empty too', () => {
  const grid = buildGrid(apiCalendar('2026-06-01', 103), '2026-09-11');

  assert.equal(grid[0][0], null);
  assert.ok(grid.at(-1).slice(0, 6).every(Boolean));
});

test('thresholds are quartiles of the active days, so one heavy day cannot flatten a year', () => {
  const heavy = (date) => (date === '2026-09-10' ? 400 : 3);
  const grid = buildGrid(apiCalendar('2025-01-01', 700, heavy), '2026-09-11');
  const steps = thresholds(grid);

  assert.equal(level(3, steps), 1, 'a steady day stays readable');
  assert.equal(level(400, steps), 4);
  assert.equal(level(0, steps), 0);
});

test('an empty year still produces usable thresholds', () => {
  const grid = buildGrid(apiCalendar('2025-01-01', 700, () => 0), '2026-09-11');

  assert.deepEqual(thresholds(grid), [1, 2, 3]);
  assert.equal(level(0, thresholds(grid)), 0);
});

test('month labels run in order and never crowd each other', () => {
  const labels = monthLabels(buildGrid(apiCalendar('2025-01-01', 700), '2026-09-11'));

  assert.ok(labels.length >= 11 && labels.length <= 13);
  assert.equal(labels.at(-1).text, 'Sep');
  for (const [position, label] of labels.entries()) {
    if (position > 0) assert.ok(label.index - labels[position - 1].index >= 3);
  }
});

test('the drawing is self-contained and states the date it was counted', () => {
  const svg = render(buildGrid(apiCalendar('2025-01-01', 700), '2026-09-11'), '2026-09-11');

  assert.match(svg, /^<svg\b/);
  assert.match(svg, /Counted by the GitHub API on 2026-09-11, nothing estimated/);
  assert.doesNotMatch(svg, /<(?:script|foreignObject|iframe|image|use)\b/i);
  assert.doesNotMatch(svg, /\bon[a-z]+\s*=/i);
  assert.doesNotMatch(svg, /(?:https?:)?\/\/(?!www\.w3\.org\/)/i);
});
