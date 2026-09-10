import { useEffect, useState } from 'react';
import { RECORD_SOURCES, type RecordSource } from '../lib/records';
import { PageHeader, Toolbar } from '../components/Primitives';
import { formatDate } from '../lib/format';

function cell(value: unknown, kind?: string): string {
  if (value === null || value === undefined || value === '') return '—';
  if (kind === 'date') return formatDate(String(value));
  if (kind === 'money') return `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  if (kind === 'number') return Number(value).toLocaleString();
  return String(value);
}

/**
 * Records Manager. The source application presents each data object as a
 * horizontal tab over a single table, so the tabs stay visible while browsing.
 */
export function RecordsScreen() {
  const [selected, setSelected] = useState<RecordSource>(RECORD_SOURCES[0]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** Resets the table before the effect below loads the new source. */
  const choose = (source: RecordSource) => {
    if (source.key === selected.key) return;
    setRows([]);
    setError(null);
    setLoading(true);
    setSelected(source);
  };

  useEffect(() => {
    let cancelled = false;
    selected
      .load()
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [selected]);

  return (
    <>
      <PageHeader icon="data" title="Records Manager" />

      <div className="rtabs" role="tablist">
        {RECORD_SOURCES.map((s) => (
          <button
            key={s.key}
            type="button"
            role="tab"
            aria-selected={s.key === selected.key}
            className={s.key === selected.key ? 'rtab on' : 'rtab'}
            onClick={() => choose(s)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="card flush">
        <div className="cardhd">
          <h3>{selected.label}</h3>
          <span className="selv">All ▾</span>
          <span className="count">{rows.length} results</span>
          <Toolbar />
        </div>
        <div className="tw">
          <table>
            <thead>
              <tr>
                {selected.columns.map((c) => (
                  <th key={c.field} className={c.kind === 'number' || c.kind === 'money' ? 'num' : undefined}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading || error || rows.length === 0 ? (
                <tr>
                  <td colSpan={selected.columns.length} className="empty">
                    {loading ? 'Loading…' : (error ?? 'No records')}
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => (
                  <tr key={String(r[selected.idField] ?? i)}>
                    {selected.columns.map((c) => (
                      <td key={c.field} className={c.kind === 'number' || c.kind === 'money' ? 'num' : undefined}>
                        {cell(r[c.field], c.kind)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
