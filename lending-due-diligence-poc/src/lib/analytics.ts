import type { LddAssignment, LddWorkCase } from './types';

/** A single category on a chart's x axis, or a single pie slice. */
export interface Slice {
  label: string;
  value: number;
}

/** Categories plus one or more named series, shared by the bar and line charts. */
export interface Series {
  categories: string[];
  series: { name: string; values: number[] }[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const parse = (v?: string | null): Date | null => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const dayKey = (d: Date) => `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
const monthKey = (d: Date) => `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

export const isResolved = (c: LddWorkCase) => (c.ava_status ?? '').toLowerCase().startsWith('resolved');

/**
 * Groups rows by a label and returns the counts in descending order. Rows with no
 * value fall into 'N/A', which is how Pega renders an unpopulated grouping column.
 */
export function countBy<T>(rows: T[], label: (row: T) => string | null | undefined): Slice[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = label(row) || 'N/A';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].map(([l, value]) => ({ label: l, value })).sort((a, b) => b.value - a.value);
}

/**
 * Builds a time series bucketed by day or month, split into one line per group.
 * Buckets are ordered chronologically and every series covers every bucket so the
 * lines stay aligned.
 */
function timeSeries<T>(
  rows: T[],
  date: (row: T) => Date | null,
  group: (row: T) => string,
  bucket: (d: Date) => string,
  limit: number
): Series {
  const seen = new Map<string, { sort: number; counts: Map<string, number> }>();
  const groups = new Set<string>();

  for (const row of rows) {
    const d = date(row);
    if (!d) continue;
    const key = bucket(d);
    const g = group(row);
    groups.add(g);
    if (!seen.has(key)) seen.set(key, { sort: d.getTime(), counts: new Map() });
    const entry = seen.get(key)!;
    entry.sort = Math.min(entry.sort, d.getTime());
    entry.counts.set(g, (entry.counts.get(g) ?? 0) + 1);
  }

  const ordered = [...seen.entries()].sort((a, b) => a[1].sort - b[1].sort).slice(-limit);
  return {
    categories: ordered.map(([k]) => k),
    series: [...groups].sort().map((name) => ({
      name,
      values: ordered.map(([, v]) => v.counts.get(name) ?? 0),
    })),
  };
}

export function dailySeries<T>(rows: T[], date: (row: T) => Date | null, group: (row: T) => string, limit = 12) {
  return timeSeries(rows, date, group, dayKey, limit);
}

export function monthlySeries<T>(rows: T[], date: (row: T) => Date | null, group: (row: T) => string, limit = 8) {
  return timeSeries(rows, date, group, monthKey, limit);
}

/** Turns a flat slice list into the single-series shape the bar chart expects. */
export function asSeries(slices: Slice[], name: string): Series {
  return { categories: slices.map((s) => s.label), series: [{ name, values: slices.map((s) => s.value) }] };
}

/** Cross-tab: one bar group per category, one series per stack key. */
export function crossTab<T>(
  rows: T[],
  category: (row: T) => string | null | undefined,
  stack: (row: T) => string | null | undefined
): Series {
  const cats: string[] = [];
  const keys: string[] = [];
  const grid = new Map<string, number>();

  for (const row of rows) {
    const c = category(row) || 'N/A';
    const s = stack(row) || 'N/A';
    if (!cats.includes(c)) cats.push(c);
    if (!keys.includes(s)) keys.push(s);
    const cell = `${c}\u0000${s}`;
    grid.set(cell, (grid.get(cell) ?? 0) + 1);
  }

  return {
    categories: cats,
    series: keys.sort().map((name) => ({
      name,
      values: cats.map((c) => grid.get(`${c}\u0000${name}`) ?? 0),
    })),
  };
}

export interface WorkMetrics {
  createdThisMonth: number;
  createdChange: number;
  resolvedThisMonth: number;
  resolvedChange: number;
  averageResolutionDays: number;
  pastDeadline: number;
  pastDeadlineChange: number;
}

/** The four KPI tiles on the Work metrics dashboard. */
export function workMetrics(cases: LddWorkCase[], assignments: LddAssignment[]): WorkMetrics {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();

  const createdAt = (c: LddWorkCase) => parse(c.createdon)?.getTime() ?? 0;
  const changedAt = (c: LddWorkCase) => parse(c.modifiedon ?? c.createdon)?.getTime() ?? 0;

  const createdThisMonth = cases.filter((c) => createdAt(c) >= monthStart).length;
  const createdLastMonth = cases.filter((c) => createdAt(c) >= prevStart && createdAt(c) < monthStart).length;

  const resolved = cases.filter(isResolved);
  const resolvedThisMonth = resolved.filter((c) => changedAt(c) >= monthStart).length;
  const resolvedLastMonth = resolved.filter((c) => changedAt(c) >= prevStart && changedAt(c) < monthStart).length;

  const durations = resolved
    .map((c) => {
      const from = parse(c.createdon);
      const to = parse(c.modifiedon ?? c.createdon);
      return from && to ? (to.getTime() - from.getTime()) / 86_400_000 : null;
    })
    .filter((d): d is number => d !== null && d >= 0);

  const nowMs = now.getTime();
  const pastDeadline = assignments.filter((a) => {
    const d = parse(a.ava_deadline);
    return d !== null && d.getTime() < nowMs;
  }).length;

  const pct = (current: number, previous: number) =>
    previous === 0 ? (current === 0 ? 0 : 100) : Math.round(((current - previous) / previous) * 100);

  return {
    createdThisMonth,
    createdChange: pct(createdThisMonth, createdLastMonth),
    resolvedThisMonth,
    resolvedChange: pct(resolvedThisMonth, resolvedLastMonth),
    averageResolutionDays: durations.length
      ? Number((durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(2))
      : 0,
    pastDeadline,
    pastDeadlineChange: 0,
  };
}

/**
 * Pega buckets a work item's status into New / Resolved / Resolved-Cancelled /
 * Resolved-Rejected / Resolved-Unspecified on the work volume chart.
 */
export function statusBucket(c: LddWorkCase): string {
  const s = (c.ava_status ?? '').toLowerCase();
  const r = (c.ava_resolutioncode ?? '').toLowerCase();
  if (!s.startsWith('resolved')) return s.startsWith('pending') ? 'Pending' : 'New';
  if (r.includes('cancel') || s.includes('cancel')) return 'Resolved-Cancelled';
  if (r.includes('reject') || s.includes('reject')) return 'Resolved-Rejected';
  if (r.includes('complete')) return 'Resolved-Completed';
  return 'Resolved-Unspecified';
}

export const created = (c: LddWorkCase) => parse(c.createdon);
export const changed = (c: LddWorkCase) => parse(c.modifiedon ?? c.createdon);
