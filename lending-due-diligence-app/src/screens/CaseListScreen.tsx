import { useEffect, useMemo, useState } from 'react';
import { listWorkCases } from '../lib/data';
import { dash, relativeTime } from '../lib/format';
import type { LddWorkCase, ProcessConfig } from '../lib/types';

interface Props {
  config: ProcessConfig;
  onOpenCase: (caseId: string) => void;
  onNewCase: () => void;
}

/** All cases across every case type, with type and status filters. */
export function CaseListScreen({ config, onOpenCase, onNewCase }: Props) {
  const [cases, setCases] = useState<LddWorkCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [openOnly, setOpenOnly] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    listWorkCases()
      .then((c) => !cancelled && setCases(c))
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return cases.filter((c) => {
      if (typeFilter && c.ava_casetypecode !== typeFilter) return false;
      if (openOnly && (c.ava_status ?? '').startsWith('Resolved')) return false;
      if (term && !`${c.ava_name} ${c.ava_stagename} ${c.ava_assignedto}`.toLowerCase().includes(term))
        return false;
      return true;
    });
  }, [cases, typeFilter, openOnly, search]);

  return (
    <>
      <div className="page-title-bar">
        Cases
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary" type="button" onClick={onNewCase}>
          + Create case
        </button>
      </div>
      <div className="work-area">
        <div className="panel">
          <div className="toolbar">
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">All case types</option>
              {config.caseTypes.map((ct) => (
                <option key={ct.ava_lddcasetypeid} value={ct.ava_code ?? ''}>
                  {ct.ava_name}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Search case ID, stage or assignee"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ minWidth: 280 }}
            />
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={openOnly}
                onChange={(e) => setOpenOnly(e.target.checked)}
              />
              Open cases only
            </label>
            <div style={{ flex: 1 }} />
            <span className="muted">{rows.length} shown</span>
          </div>

          {error && <div className="banner-msg error">{error}</div>}
          {loading ? (
            <div className="loading">Loading cases…</div>
          ) : (
            <div className="grid-wrap">
              <table className="grid">
                <thead>
                  <tr>
                    <th>Case ID</th>
                    <th>Case type</th>
                    <th>Status</th>
                    <th>Stage</th>
                    <th>Assigned to</th>
                    <th>Workbasket</th>
                    <th>Last decision</th>
                    <th>Updated</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={9} className="empty-row">
                        ✧ No cases match the current filters.
                      </td>
                    </tr>
                  )}
                  {rows.map((c) => {
                    const ct = config.caseTypes.find((t) => t.ava_code === c.ava_casetypecode);
                    const resolved = (c.ava_status ?? '').startsWith('Resolved');
                    return (
                      <tr key={c.ava_lddworkcaseid}>
                        <td>
                          <span className="case-link" onClick={() => onOpenCase(c.ava_lddworkcaseid)}>
                            {c.ava_name}
                          </span>
                        </td>
                        <td>{dash(ct?.ava_name ?? c.ava_casetypecode)}</td>
                        <td>
                          <span className={`status-chip${resolved ? '' : ' new'}`}>
                            {dash(c.ava_status)}
                          </span>
                        </td>
                        <td>{dash(c.ava_stagename)}</td>
                        <td>{dash(c.ava_assignedto)}</td>
                        <td>{dash(c.ava_workbasket)}</td>
                        <td>{dash(c.ava_lastdecisionresult)}</td>
                        <td>{relativeTime(c.modifiedon)}</td>
                        <td>
                          <button
                            className="btn btn-primary btn-sm"
                            type="button"
                            onClick={() => onOpenCase(c.ava_lddworkcaseid)}
                          >
                            Open
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
