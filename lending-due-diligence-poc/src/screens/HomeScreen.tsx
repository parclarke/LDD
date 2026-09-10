import type { PocRoute } from '../lib/routes';
import { caseTypeName, isOpen, type AppData } from '../lib/appdata';
import { StatusChip } from '../components/Primitives';
import { Icon } from '../components/Icon';

interface HomeScreenProps {
  data: AppData;
  onNavigate: (route: PocRoute) => void;
  onOpenCase: (caseId: string) => void;
  onCreate: () => void;
}

/** Mirrors the prototype's `pageHome()`: announcement, tasks, pulse, tiles. */
export function HomeScreen({ data, onNavigate, onOpenCase, onCreate }: HomeScreenProps) {
  const tasks = data.assignments.slice(0, 6);

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
                        {parent?.ava_name ?? '—'} &nbsp;•&nbsp; <StatusChip status={parent?.ava_status} />
                        &nbsp;•&nbsp; Urgency {parent?.ava_urgency ?? '—'}
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
          </div>

          <div className="card">
            <div className="cardhd">
              <h3>My followed items</h3>
            </div>
            <div className="empty">You are not following any cases</div>
          </div>
        </div>

        <div>
          <div className="card">
            <div className="cardhd">
              <h3>Pulse</h3>
              <Icon name="wave" />
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
