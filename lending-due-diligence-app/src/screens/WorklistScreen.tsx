import { useEffect, useState } from 'react';
import { listOpenAssignments, listWorkCases } from '../lib/data';
import { dash, formatDate, isOverdue, relativeTime } from '../lib/format';
import type { LddAssignment, LddWorkCase, ProcessConfig } from '../lib/types';

interface Props {
  config: ProcessConfig;
  onOpenCase: (caseId: string, assignmentId: string) => void;
  userLabel: string;
}

/** "My Worklist": every open assignment across all five case types. */
export function WorklistScreen({ config, onOpenCase, userLabel }: Props) {
  const [assignments, setAssignments] = useState<LddAssignment[]>([]);
  const [cases, setCases] = useState<Record<string, LddWorkCase>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [typeFilter, setTypeFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([listOpenAssignments(), listWorkCases()])
      .then(([a, c]) => {
        if (cancelled) return;
        setAssignments(a);
        setCases(Object.fromEntries(c.map((x) => [x.ava_lddworkcaseid, x])));
        setError(null);
      })
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const rows = assignments
    .map((a) => ({ a, c: a._ava_workcaseid_value ? cases[a._ava_workcaseid_value] : undefined }))
    .filter((r) => !typeFilter || r.c?.ava_casetypecode === typeFilter);

  const overdue = rows.filter((r) => isOverdue(r.a.ava_deadline)).length;

  return (
    <>
      <div className="page-title-bar">My Worklist</div>
      <div className="work-area">
        <div className="panel">
          <div className="stat-row" style={{ marginBottom: 18 }}>
            <div className="stat">
              <div className="stat-value">{rows.length}</div>
              <div className="stat-label">Open assignments</div>
            </div>
            <div className="stat">
              <div className="stat-value">{overdue}</div>
              <div className="stat-label">Past deadline</div>
            </div>
            <div className="stat">
              <div className="stat-value">{new Set(rows.map((r) => r.c?.ava_lddworkcaseid)).size}</div>
              <div className="stat-label">Distinct cases</div>
            </div>
          </div>

          <div className="worklist-head">
            <span className="avatar green">{userLabel.slice(0, 2).toUpperCase()}</span>
            <span className="title">All Pending Tasks</span>
            <div style={{ flex: 1 }} />
            <div className="toolbar" style={{ margin: 0 }}>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="">All case types</option>
                {config.caseTypes.map((ct) => (
                  <option key={ct.ava_lddcasetypeid} value={ct.ava_code ?? ''}>
                    {ct.ava_name}
                  </option>
                ))}
              </select>
              <button
                className="btn btn-secondary btn-sm"
                type="button"
                onClick={() => {
                  setLoading(true);
                  setNonce((n) => n + 1);
                }}
              >
                ↻ Refresh
              </button>
            </div>
          </div>

          {error && <div className="banner-msg error">{error}</div>}
          {loading ? (
            <div className="loading">Loading pending tasks…</div>
          ) : (
            <div className="grid-wrap">
              <table className="grid">
                <thead>
                  <tr>
                    <th>Case ID</th>
                    <th>Case type</th>
                    <th>Stage</th>
                    <th>Task</th>
                    <th>Routing</th>
                    <th>Assigned to</th>
                    <th>Workbasket</th>
                    <th>Assigned</th>
                    <th>Goal</th>
                    <th>Deadline</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={11} className="empty-row">
                        ✧ No pending tasks.
                      </td>
                    </tr>
                  )}
                  {rows.map(({ a, c }) => {
                    const ct = config.caseTypes.find((t) => t.ava_code === c?.ava_casetypecode);
                    return (
                      <tr key={a.ava_lddassignmentid}>
                        <td>
                          <span
                            className="case-link"
                            onClick={() => c && onOpenCase(c.ava_lddworkcaseid, a.ava_lddassignmentid)}
                          >
                            {dash(c?.ava_name)}
                          </span>
                        </td>
                        <td>{dash(ct?.ava_name ?? c?.ava_casetypecode)}</td>
                        <td>{dash(c?.ava_stagename)}</td>
                        <td>{dash(a.ava_stepname ?? a.ava_name)}</td>
                        <td>
                          <span className="pill">{dash(a.ava_assignmenttype)}</span>
                        </td>
                        <td>{dash(a.ava_assignedto)}</td>
                        <td>{dash(a.ava_workbasket)}</td>
                        <td>{formatDate(a.ava_assignmentdate)}</td>
                        <td>{a.ava_goal ? relativeTime(a.ava_goal) : '—'}</td>
                        <td className={isOverdue(a.ava_deadline) ? 'overdue' : ''}>
                          {a.ava_deadline ? relativeTime(a.ava_deadline) : '—'}
                        </td>
                        <td>
                          <button
                            className="btn btn-primary btn-sm"
                            type="button"
                            disabled={!c}
                            onClick={() => c && onOpenCase(c.ava_lddworkcaseid, a.ava_lddassignmentid)}
                          >
                            Go
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
