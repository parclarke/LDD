import { useState } from 'react';
import type { PocRoute } from '../lib/routes';
import { caseTypeName, isOpen, type AppData } from '../lib/appdata';
import { StatusChip } from '../components/Primitives';
import { Icon } from '../components/Icon';
import { urgencyOf } from '../lib/status';

interface HomeScreenProps {
  data: AppData;
  onNavigate: (route: PocRoute) => void;
  onOpenCase: (caseId: string) => void;
  onCreate: () => void;
}

const TASK_PAGE = 5;

/** Home: announcement banner, Tasks, followed items and the Pulse feed. */
export function HomeScreen({ data, onNavigate, onOpenCase, onCreate }: HomeScreenProps) {
  const [shown, setShown] = useState(TASK_PAGE);
  const [post, setPost] = useState('');
  const tasks = data.assignments.slice(0, shown);
  const followed = data.cases.filter((c) => !isOpen(c)).slice(0, 5);

  return (
    <>
      <div className="announce">
        <h3>Welcome to Lending Due Diligence</h3>
        <p>
          Review lending decisions, assess risk, monitor compliance and manage escalations — all in one
          workspace, driven by the same process model as the source application.
        </p>
        <button className="btn" onClick={onCreate} type="button">
          <span className="sparkle">✦</span> Create a case
        </button>
        <div className="wm">LDD</div>
      </div>

      <div className="cols">
        <div>
          <div className="card">
            <div className="cardhd">
              <h3>Tasks</h3>
              <span className="count">{data.assignments.length}</span>
            </div>
            {tasks.length === 0 ? (
              <div className="empty">No open assignments</div>
            ) : (
              tasks.map((a) => {
                const parent = data.cases.find((c) => c.ava_lddworkcaseid === a._ava_workcaseid_value);
                return (
                  <div className="task" key={a.ava_lddassignmentid}>
                    <div className="body">
                      <div className="t">{a.ava_name}</div>
                      <div className="muted small">
                        In {caseTypeName(data, parent?.ava_casetypecode)} - {parent?.ava_stagename ?? '—'} (
                        {parent?.ava_name ?? '—'}) &nbsp;•&nbsp; <StatusChip status={parent?.ava_status} />
                        &nbsp;•&nbsp; Urgency {parent ? urgencyOf(parent) : '—'}
                      </div>
                    </div>
                    <button
                      className="btn sm"
                      type="button"
                      onClick={() => parent && onOpenCase(parent.ava_lddworkcaseid)}
                    >
                      Go
                    </button>
                  </div>
                );
              })
            )}
            {shown < data.assignments.length ? (
              <button className="showmore" type="button" onClick={() => setShown((n) => n + TASK_PAGE)}>
                Show more
              </button>
            ) : null}
          </div>

          <div className="card flush">
            <div className="cardhd">
              <h3>My followed items</h3>
              <span className="count">{followed.length}</span>
            </div>
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>Case ID</th>
                    <th>Label</th>
                    <th>Status</th>
                    <th className="num">Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {followed.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="empty">
                        No records
                      </td>
                    </tr>
                  ) : (
                    followed.map((c) => (
                      <tr key={c.ava_lddworkcaseid}>
                        <td>
                          <a onClick={() => onOpenCase(c.ava_lddworkcaseid)}>{c.ava_name}</a>
                        </td>
                        <td>{c.ava_stagename ?? '—'}</td>
                        <td className="statcell">
                          <StatusChip status={c.ava_status} />
                        </td>
                        <td className="num">{urgencyOf(c)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div>
          <div className="card">
            <div className="cardhd">
              <h3>Pulse</h3>
            </div>
            <div className="pulse-post">
              <div className="pp-hd">
                PA Post <span className="caret">▾</span>
              </div>
              <textarea
                value={post}
                placeholder="Share an update with your team…"
                onChange={(e) => setPost(e.target.value)}
              />
              <div className="pp-acts">
                <button type="button" title="Attach">
                  <Icon name="paper" />
                </button>
                <button type="button" title="Image">
                  <Icon name="image" />
                </button>
                <button type="button" title="Emoji">
                  <Icon name="emoji" />
                </button>
                <span className="spacer" />
                <button className="btn sm" type="button" disabled={!post.trim()} onClick={() => setPost('')}>
                  Post
                </button>
              </div>
            </div>
            <div className="pulse-box">No recent activity to show.</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="cardhd">
          <h3>Case types</h3>
          <span className="count">{data.caseTypes.length}</span>
        </div>
        <div className="tiles">
          {data.caseTypes.map((t) => {
            const code = t.ava_code ?? t.ava_lddcasetypeid;
            const n = data.cases.filter((c) => c.ava_casetypecode === code && isOpen(c)).length;
            return (
              <a
                className="tile"
                key={t.ava_lddcasetypeid}
                onClick={() => onNavigate({ name: 'type', code })}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onNavigate({ name: 'type', code });
                }}
              >
                <div className="n">{n}</div>
                <div className="l">{caseTypeName(data, code)}</div>
                <div className="muted small">open cases</div>
              </a>
            );
          })}
        </div>
      </div>
    </>
  );
}
