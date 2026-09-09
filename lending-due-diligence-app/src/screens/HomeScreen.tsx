import { useEffect, useState } from 'react';
import { listOpenAssignments, listWorkCases } from '../lib/data';
import { dash } from '../lib/format';
import type { CurrentUser, LddAssignment, LddWorkCase, ProcessConfig } from '../lib/types';

interface Props {
  config: ProcessConfig;
  user: CurrentUser;
  onOpenCase: (caseId: string, assignmentId: string) => void;
  onShowMore: () => void;
  onOpenCases: () => void;
}

/** Number of task rows shown before the "Show more" link takes over. */
const TASK_PREVIEW = 4;

/**
 * Landing dashboard mirroring the Pega Constellation home page: announcements
 * and pending work down the left, Pulse and case-type tiles down the right.
 */
export function HomeScreen({ config, user, onOpenCase, onShowMore, onOpenCases }: Props) {
  const [assignments, setAssignments] = useState<LddAssignment[]>([]);
  const [cases, setCases] = useState<Record<string, LddWorkCase>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  }, []);

  const rows = assignments.map((a) => ({
    a,
    c: a._ava_workcaseid_value ? cases[a._ava_workcaseid_value] : undefined,
  }));

  const typeName = (code?: string) =>
    config.caseTypes.find((t) => t.ava_code === code)?.ava_name ?? code ?? 'Case';

  // Open cases per type drive the tiles on the right.
  const openByType = config.caseTypes.map((ct) => ({
    id: ct.ava_lddcasetypeid,
    name: ct.ava_name ?? '',
    count: Object.values(cases).filter(
      (c) => c.ava_casetypecode === ct.ava_code && c.ava_status !== 'Resolved',
    ).length,
  }));

  return (
    <>
      <div className="page-title-bar">
        <span className="title-badge" aria-hidden="true">
          ⌂
        </span>
        Home
      </div>

      <div className="work-area">
        <div className="home-grid">
          <div className="home-col">
            <section className="announce">
              <span className="announce-mark" aria-hidden="true">
                LDD
              </span>
              <h2>Announcements</h2>
              <p>
                Lending Due Diligence runs the five reviews migrated from Pega — lending review,
                risk assessment, compliance monitoring, escalation management and quality
                recommendation. Stage and step routing come straight from the exported process
                model, so the flow you see here matches the source application.
              </p>
              <button className="btn btn-ghost-light" type="button" onClick={onOpenCases}>
                View guidance
              </button>
            </section>

            <section className="panel">
              <div className="card-head">
                <h3>Tasks</h3>
                <span className="result-count">{rows.length} results</span>
              </div>

              {error && <div className="banner-msg error">{error}</div>}
              {loading ? (
                <div className="loading">Loading tasks…</div>
              ) : rows.length === 0 ? (
                <div className="empty-card">✧ No pending tasks.</div>
              ) : (
                <>
                  <ul className="task-list">
                    {rows.slice(0, TASK_PREVIEW).map(({ a, c }) => (
                      <li key={a.ava_lddassignmentid}>
                        <div className="task-main">
                          <div className="task-name">
                            {typeName(c?.ava_casetypecode)} — {dash(a.ava_stepname ?? a.ava_name)}
                          </div>
                          <div className="task-meta">
                            In {typeName(c?.ava_casetypecode)} ({dash(c?.ava_name)}) •{' '}
                            {(c?.ava_status ?? 'OPEN').toUpperCase()} • Urgency{' '}
                            {c?.ava_priority ?? 10}
                          </div>
                        </div>
                        <button
                          className="btn btn-primary btn-sm"
                          type="button"
                          disabled={!c}
                          onClick={() => c && onOpenCase(c.ava_lddworkcaseid, a.ava_lddassignmentid)}
                        >
                          Go
                        </button>
                      </li>
                    ))}
                  </ul>
                  {rows.length > TASK_PREVIEW && (
                    <button className="link-btn" type="button" onClick={onShowMore}>
                      Show more
                    </button>
                  )}
                </>
              )}
            </section>

            <section className="panel">
              <div className="card-head">
                <h3>My followed items</h3>
              </div>
              <div className="grid-wrap">
                <table className="grid">
                  <thead>
                    <tr>
                      <th>Case ID</th>
                      <th>Label</th>
                      <th>Status</th>
                      <th>Priority</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td colSpan={4} className="empty-row">
                        No records
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <div className="home-col">
            <section className="panel">
              <div className="card-head">
                <h3>Pulse</h3>
              </div>
              <div className="pulse-compose">
                <span className="avatar">{user.initials}</span>
                <div className="pulse-input">Share an update with the team…</div>
              </div>
              <button className="btn btn-secondary btn-sm" type="button" disabled>
                Post ▾
              </button>
            </section>

            <section className="panel">
              <div className="card-head">
                <h3>Case types</h3>
              </div>
              <div className="tile-grid">
                {openByType.map((t) => (
                  <button key={t.id} className="tile" type="button" onClick={onOpenCases}>
                    <span className="tile-count">{t.count}</span>
                    <span className="tile-name">{t.name}</span>
                    <span className="tile-sub">open cases</span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
