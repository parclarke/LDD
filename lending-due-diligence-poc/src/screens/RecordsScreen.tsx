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
 * Mirrors `pageRecords()`: data-object tiles that drill into a live Dataverse
 * table. Pega's Record Manager browses data objects rather than case types.
 */
export function RecordsScreen() {
  const [selected, setSelected] = useState<RecordSource | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Resets the table before the effect below loads the new source. */
  const choose = (source: RecordSource | null) => {
    setRows([]);
    setError(null);
    setLoading(source !== null);
    setSelected(source);
  };

  useEffect(() => {
    if (!selected) return;
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

  if (selected) {
    return (
      <>
        <PageHeader icon="data" title={selected.label} sub={selected.pegaClass}>
          <button className="btn o" type="button" onClick={() => choose(null)}>
            ← Record Manager
          </button>
        </PageHeader>
        <div className="card flush">
          <div className="cardhd">
            <h3>Records</h3>
            <span className="count">{rows.length}</span>
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
                        <td
                          key={c.field}
                          className={c.kind === 'number' || c.kind === 'money' ? 'num' : undefined}
                        >
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

  return (
    <>
      <PageHeader icon="data" title="Record Manager" />
      <p className="muted" style={{ marginTop: '-8px' }}>
        Reference data maintained outside the case lifecycle. Each is a Dataverse table in the migrated
        application.
      </p>
      <div className="tiles">
        {RECORD_SOURCES.map((s) => (
          <a
            className="tile"
            key={s.key}
            onClick={() => choose(s)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') choose(s);
            }}
          >
            <div className="n">{s.columns.length}</div>
            <div className="l">{s.label}</div>
            <div className="muted small">columns</div>
          </a>
        ))}
      </div>
    </>
  );
}
