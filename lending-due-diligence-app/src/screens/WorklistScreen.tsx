import { useEffect, useState } from 'react';
import { listCases, listPendingTasks, searchTransactions } from '../lib/data';
import { dash, formatDate, isOverdue, relativeTime } from '../lib/format';
import type { LddCase, LddTask, LddTransaction } from '../lib/types';

interface Props {
  onOpenCase: (caseId: string, taskId: string) => void;
  userLabel: string;
}

/** "My Worklist" — All Pending Tasks grid. */
export function WorklistScreen({ onOpenCase, userLabel }: Props) {
  const [tasks, setTasks] = useState<LddTask[]>([]);
  const [cases, setCases] = useState<Record<string, LddCase>>({});
  const [transactions, setTransactions] = useState<Record<string, LddTransaction>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listPendingTasks(), listCases(), searchTransactions({})])
      .then(([t, c, tx]) => {
        if (cancelled) return;
        setTasks(t);
        setCases(Object.fromEntries(c.map((x) => [x.ava_lddcaseid, x])));
        setTransactions(Object.fromEntries(tx.map((x) => [x.ava_lddtransactionid, x])));
        setError(null);
      })
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  return (
    <>
      <div className="page-title-bar">My Worklist</div>
      <div className="work-area">
        <div className="panel">
          <div className="section-title">All Pending Tasks</div>
          <div className="worklist-head" style={{ marginTop: 16 }}>
            <span className="avatar green">{userLabel.slice(0, 2).toUpperCase()}</span>
            <span className="title">My Worklist</span>
            <span style={{ color: '#767676' }}>⊖</span>
            <div style={{ flex: 1 }} />
            <div className="grid-toolbar" style={{ padding: 0 }}>
              <button type="button">☰ Group</button>
              <button type="button">🗇 Fields</button>
              <button
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
                    <th>Source</th>
                    <th>Application number</th>
                    <th>Product Type</th>
                    <th>Queue Type</th>
                    <th>Review name</th>
                    <th>Channel</th>
                    <th>Purpose</th>
                    <th>PID Description</th>
                    <th>Case ID ↓</th>
                    <th>Operator Language</th>
                    <th>Transit</th>
                    <th>Case status</th>
                    <th>Task Description</th>
                    <th>Assignment Date</th>
                    <th>Goal</th>
                    <th>Deadline</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {tasks.length === 0 && (
                    <tr>
                      <td colSpan={17} className="empty-row">
                        ✧ No results.
                      </td>
                    </tr>
                  )}
                  {tasks.map((t) => {
                    const c = t._ava_caseid_value ? cases[t._ava_caseid_value] : undefined;
                    const tx = c?._ava_transactionid_value
                      ? transactions[c._ava_transactionid_value]
                      : undefined;
                    return (
                      <tr key={t.ava_lddcasetaskid}>
                        <td>{dash(tx?.ava_source)}</td>
                        <td>{dash(tx?.ava_applicationnumber)}</td>
                        <td>{dash(c?.ava_producttype)}</td>
                        <td>{dash(c?.ava_queuetype)}</td>
                        <td>{dash(c?.ava_reviewname)}</td>
                        <td>{dash(c?.ava_channel)}</td>
                        <td>{dash(c?.ava_purpose)}</td>
                        <td>{dash(c?.ava_piddescription)}</td>
                        <td>
                          <span
                            className="case-link"
                            onClick={() =>
                              c && onOpenCase(c.ava_lddcaseid, t.ava_lddcasetaskid)
                            }
                          >
                            {dash(c?.ava_name)}
                          </span>
                        </td>
                        <td>English</td>
                        <td>{dash(tx?.ava_transit)}</td>
                        <td>{dash(c?.ava_status)}</td>
                        <td>{dash(t.ava_name)}</td>
                        <td>{formatDate(t.ava_assignmentdate)}</td>
                        <td>{t.ava_goal ? relativeTime(t.ava_goal) : '—'}</td>
                        <td className={isOverdue(t.ava_deadline) ? 'overdue' : ''}>
                          {t.ava_deadline ? relativeTime(t.ava_deadline) : '—'}
                        </td>
                        <td>
                          <button
                            className="btn btn-primary btn-sm"
                            type="button"
                            disabled={!c}
                            onClick={() => c && onOpenCase(c.ava_lddcaseid, t.ava_lddcasetaskid)}
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
