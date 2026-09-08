import { useEffect, useMemo, useState } from 'react';
import {
  listComplianceFindings,
  listCustomers,
  listOversightCases,
  listQualityReviews,
  listResolutionSummaries,
  listRiskProfiles,
  listTransactions,
  listWorkCases,
} from '../lib/data';
import { dash } from '../lib/format';
import type { LddWorkCase, ProcessConfig } from '../lib/types';

interface Props {
  config: ProcessConfig;
  onOpenCase: (caseId: string) => void;
}

type Row = Record<string, unknown>;

/** The generated Dataverse models have no index signature, so widen explicitly. */
const asRows = <T,>(p: Promise<T[]>): Promise<Row[]> =>
  p.then((rows) => rows as unknown as Row[]);

/** The reference data objects, matching Pega's per-class data table editors. */
const REFERENCE_TABLES: Array<{ key: string; label: string; load: () => Promise<Row[]> }> = [
  { key: 'customers', label: 'Customers', load: () => asRows(listCustomers()) },
  { key: 'transactions', label: 'Lending transactions', load: () => asRows(listTransactions()) },
  { key: 'riskProfiles', label: 'Risk profiles', load: () => asRows(listRiskProfiles()) },
  { key: 'findings', label: 'Compliance findings', load: () => asRows(listComplianceFindings()) },
  { key: 'reviews', label: 'Quality reviews', load: () => asRows(listQualityReviews()) },
  { key: 'oversight', label: 'Oversight cases', load: () => asRows(listOversightCases()) },
  { key: 'summaries', label: 'Resolution summaries', load: () => asRows(listResolutionSummaries()) },
];

/** Columns that carry no meaning in a grid. */
const HIDDEN = /(id|statecode|statuscode|versionnumber|importsequencenumber|timezoneruleversionnumber|utcconversiontimezonecode|overriddencreatedon)$/i;

function displayColumns(rows: Row[], limit = 6): string[] {
  if (!rows.length) return [];
  const counts = new Map<string, number>();
  for (const row of rows.slice(0, 25)) {
    for (const [k, v] of Object.entries(row)) {
      if (!k.startsWith('ava_') || HIDDEN.test(k)) continue;
      if (v === null || v === undefined || v === '') continue;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  // Prefer the name column, then whichever columns are most consistently populated.
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const name = ranked.find((k) => k === 'ava_name');
  const rest = ranked.filter((k) => k !== 'ava_name');
  return (name ? [name, ...rest] : rest).slice(0, limit);
}

const label = (col: string) =>
  col.replace(/^ava_/, '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());

function cell(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  const s = String(value);
  // ISO dates render as just the date part.
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
  return s.length > 60 ? `${s.slice(0, 60)}…` : s;
}

const isResolved = (c: LddWorkCase) => (c.ava_status ?? '').startsWith('Resolved');

/**
 * Case insights and reference data.
 *
 * Replaces the capability of Pega's auto-generated report definitions: the
 * per-case-type summary reports (pyDefaultSummaryReport) and the per-class data
 * table editors (DataTableEditorReport). None of those carried bespoke logic, so
 * nothing was ported - this provides the equivalent capability natively.
 */
export function InsightsScreen({ config, onOpenCase }: Props) {
  const [tab, setTab] = useState<'summary' | 'sla' | 'data'>('summary');
  const [cases, setCases] = useState<LddWorkCase[]>([]);
  // Snapshot taken when the data loads, so SLA buckets are computed against a
  // stable point in time rather than a fresh clock on every render.
  const [asOf, setAsOf] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [refKey, setRefKey] = useState(REFERENCE_TABLES[0].key);
  const [refRows, setRefRows] = useState<Row[]>([]);
  const [refLoading, setRefLoading] = useState(false);
  const [refError, setRefError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listWorkCases()
      .then((c) => {
        if (cancelled) return;
        setCases(c);
        setAsOf(Date.now());
      })
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (tab !== 'data') return;
    const entry = REFERENCE_TABLES.find((t) => t.key === refKey);
    if (!entry) return;
    let cancelled = false;
    // Hoisted into an async function so no state is set synchronously in the
    // effect body, which React's purity rules disallow.
    const run = async () => {
      setRefLoading(true);
      setRefError(null);
      try {
        const rows = await entry.load();
        if (!cancelled) setRefRows(rows);
      } catch (e) {
        if (!cancelled) setRefError((e as Error).message);
      } finally {
        if (!cancelled) setRefLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [tab, refKey]);

  /** Counts by case type and status - the summary report equivalent. */
  const summary = useMemo(() => {
    return config.caseTypes.map((ct) => {
      const mine = cases.filter((c) => c.ava_casetypecode === ct.ava_code);
      const open = mine.filter((c) => !isResolved(c));
      const byStage = new Map<string, number>();
      for (const c of open) {
        const key = c.ava_stagename ?? 'Unknown';
        byStage.set(key, (byStage.get(key) ?? 0) + 1);
      }
      return {
        code: ct.ava_code ?? '',
        name: ct.ava_name ?? '',
        total: mine.length,
        open: open.length,
        resolved: mine.length - open.length,
        stages: [...byStage.entries()].sort((a, b) => b[1] - a[1]),
      };
    });
  }, [cases, config.caseTypes]);

  const totals = useMemo(
    () => ({
      total: cases.length,
      open: cases.filter((c) => !isResolved(c)).length,
      resolved: cases.filter(isResolved).length,
    }),
    [cases]
  );

  /** Open cases bucketed against their SLA deadline, as at the load snapshot. */
  const sla = useMemo(() => {
    const soon = asOf + 2 * 24 * 60 * 60 * 1000;
    const open = cases.filter((c) => !isResolved(c));
    const withDeadline = asOf ? open.filter((c) => c.ava_sladeadline) : [];
    const overdue = withDeadline.filter((c) => new Date(c.ava_sladeadline!).getTime() < asOf);
    const dueSoon = withDeadline.filter((c) => {
      const t = new Date(c.ava_sladeadline!).getTime();
      return t >= asOf && t <= soon;
    });
    return {
      overdue,
      dueSoon,
      onTrack: withDeadline.length - overdue.length - dueSoon.length,
      noDeadline: open.length - withDeadline.length,
    };
  }, [cases, asOf]);

  const refColumns = useMemo(() => displayColumns(refRows), [refRows]);

  return (
    <>
      <div className="page-title-bar">Insights</div>
      <div className="work-area">
        {error && <div className="panel error">{error}</div>}

        <div className="panel">
          <div className="stat-row">
            <Stat value={totals.total} label="Total cases" />
            <Stat value={totals.open} label="Open" />
            <Stat value={totals.resolved} label="Resolved" />
            <Stat value={sla.overdue.length} label="Past SLA" />
          </div>
        </div>

        <div className="panel">
          <div className="tabs">
            {(
              [
                ['summary', 'Case summary'],
                ['sla', 'SLA and ageing'],
                ['data', 'Reference data'],
              ] as const
            ).map(([key, text]) => (
              <button
                key={key}
                type="button"
                className={tab === key ? 'tab active' : 'tab'}
                onClick={() => setTab(key)}
              >
                {text}
              </button>
            ))}
          </div>

          {loading && <p className="muted">Loading cases…</p>}

          {!loading && tab === 'summary' && (
            <>
              <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
                Equivalent of Pega's per-case-type summary reports. Open cases are broken
                down by the stage they are currently sitting in.
              </p>
              <div className="grid-wrap">
                <table className="grid">
                  <thead>
                    <tr>
                      <th>Case type</th>
                      <th style={{ width: 80 }}>Total</th>
                      <th style={{ width: 80 }}>Open</th>
                      <th style={{ width: 90 }}>Resolved</th>
                      <th>Open cases by stage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.map((s) => (
                      <tr key={s.code}>
                        <td>
                          <strong>{s.name}</strong>
                        </td>
                        <td>{s.total}</td>
                        <td>{s.open}</td>
                        <td>{s.resolved}</td>
                        <td className="muted">
                          {s.stages.length
                            ? s.stages.map(([stage, n]) => `${stage} (${n})`).join(', ')
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {!loading && tab === 'sla' && (
            <>
              <div className="stat-row" style={{ marginBottom: 14 }}>
                <Stat value={sla.overdue.length} label="Past deadline" />
                <Stat value={sla.dueSoon.length} label="Due within 2 days" />
                <Stat value={sla.onTrack} label="On track" />
                <Stat value={sla.noDeadline} label="No deadline set" />
              </div>
              <div className="grid-wrap">
                <table className="grid">
                  <thead>
                    <tr>
                      <th style={{ width: 130 }}>Case</th>
                      <th>Case type</th>
                      <th>Stage</th>
                      <th>Assigned to</th>
                      <th style={{ width: 120 }}>Deadline</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...sla.overdue, ...sla.dueSoon].map((c) => (
                      <tr
                        key={c.ava_lddworkcaseid}
                        onClick={() => onOpenCase(c.ava_lddworkcaseid)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>
                          <strong>{c.ava_name}</strong>
                        </td>
                        <td>{dash(c.ava_casetypecode)}</td>
                        <td>{dash(c.ava_stagename)}</td>
                        <td>{dash(c.ava_assignedto)}</td>
                        <td>{cell(c.ava_sladeadline)}</td>
                      </tr>
                    ))}
                    {!sla.overdue.length && !sla.dueSoon.length && (
                      <tr>
                        <td colSpan={5} className="muted">
                          No cases are past or near their deadline.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === 'data' && (
            <>
              <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
                Equivalent of Pega's per-class data table editors, read-only for now.
              </p>
              <div className="toolbar">
                <select value={refKey} onChange={(e) => setRefKey(e.target.value)}>
                  {REFERENCE_TABLES.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <span className="muted">{refRows.length} rows</span>
              </div>
              {refLoading && <p className="muted">Loading…</p>}
              {refError && <div className="error">{refError}</div>}
              {!refLoading && !refError && (
                <div className="grid-wrap">
                  <table className="grid">
                    <thead>
                      <tr>
                        {refColumns.map((c) => (
                          <th key={c}>{label(c)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {refRows.slice(0, 100).map((row, i) => (
                        <tr key={String(row.ava_name ?? i)}>
                          {refColumns.map((c) => (
                            <td key={c}>{cell(row[c])}</td>
                          ))}
                        </tr>
                      ))}
                      {!refRows.length && (
                        <tr>
                          <td colSpan={Math.max(1, refColumns.length)} className="muted">
                            No rows in this table.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

function Stat({ value, label: text }: { value: number; label: string }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{text}</div>
    </div>
  );
}
