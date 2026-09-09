import { useEffect, useMemo, useState } from 'react';
import { RECORD_SOURCES } from '../lib/records';
import type { RecordColumn } from '../lib/records';
import { dash, formatDate } from '../lib/format';

/** Formats one cell according to the column's declared kind. */
function cell(row: Record<string, unknown>, col: RecordColumn) {
  const raw = row[col.field];
  if (raw === null || raw === undefined || raw === '') return <span className="muted">—</span>;

  switch (col.kind) {
    case 'money':
      return Number(raw).toLocaleString('en-CA', {
        style: 'currency',
        currency: 'CAD',
        maximumFractionDigits: 0,
      });
    case 'number':
      return Number(raw).toLocaleString('en-CA');
    case 'date':
      return formatDate(String(raw));
    case 'chip':
      return <span className="status-chip new">{String(raw)}</span>;
    default:
      return dash(String(raw));
  }
}

/**
 * Records Manager — browses the application's data objects.
 *
 * This mirrors the Pega portal screen of the same name: one tab per data object,
 * each showing that object's records in a grid. Unlike Cases, these are reference
 * records rather than work items, so the grid is read-only.
 */
export function RecordsScreen() {
  const [activeKey, setActiveKey] = useState(RECORD_SOURCES[0].key);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const source = RECORD_SOURCES.find((s) => s.key === activeKey) ?? RECORD_SOURCES[0];

  // The effect only touches state from its async callbacks. Clearing the
  // previous tab's rows is done in the click handler, so switching tabs does
  // not briefly show one object's records under another's column headings.
  useEffect(() => {
    let cancelled = false;
    source
      .load()
      .then((r) => !cancelled && setRows(r))
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [source]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) =>
      source.columns.some((c) => String(r[c.field] ?? '').toLowerCase().includes(term))
    );
  }, [rows, search, source]);

  return (
    <>
      <div className="page-title-bar">Records Manager</div>
      <div className="work-area">
        <div className="tabs records-tabs">
          {RECORD_SOURCES.map((s) => (
            <button
              key={s.key}
              type="button"
              className={`tab${s.key === activeKey ? ' active' : ''}`}
              onClick={() => {
                if (s.key === activeKey) return;
                setActiveKey(s.key);
                setSearch('');
                setRows([]);
                setError(null);
                setLoading(true);
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="panel">
          <div className="toolbar">
            <strong>All</strong>
            <span className="muted">
              {loading ? 'loading…' : `${filtered.length} result${filtered.length === 1 ? '' : 's'}`}
            </span>
            <div style={{ flex: 1 }} />
            <input
              type="text"
              placeholder={`Search ${source.label.toLowerCase()} records`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ minWidth: 280 }}
            />
          </div>

          {error && <div className="banner-msg error">{error}</div>}

          {loading ? (
            <div className="loading">Loading {source.label.toLowerCase()} records…</div>
          ) : (
            <div className="grid-wrap">
              <table className="grid">
                <thead>
                  <tr>
                    {source.columns.map((c) => (
                      <th key={c.field}>{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={source.columns.length} className="empty-row">
                        ✧ No records found.
                      </td>
                    </tr>
                  )}
                  {filtered.map((r, i) => (
                    <tr key={String(r[source.idField] ?? i)}>
                      {source.columns.map((c) => (
                        <td key={c.field}>{cell(r, c)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="records-class-note muted">
            Pega data class: <code>{source.pegaClass}</code>
          </div>
        </div>
      </div>
    </>
  );
}
