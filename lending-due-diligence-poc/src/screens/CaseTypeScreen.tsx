import { openAssignmentFor, stagesFor, stepsFor, type AppData } from '../lib/appdata';
import { PageHeader, StatusChip, Toolbar } from '../components/Primitives';
import { iconFor } from '../lib/icons';
import { urgencyOf } from '../lib/status';

interface CaseTypeScreenProps {
  data: AppData;
  code: string;
  onOpenCase: (caseId: string) => void;
  onOpenAssignment: (caseId: string, assignmentId: string) => void;
  onCreate: (code: string) => void;
}

/** Mirrors `pageType()`: lifecycle chevrons, case table, and the process outline. */
export function CaseTypeScreen({ data, code, onOpenCase, onOpenAssignment, onCreate }: CaseTypeScreenProps) {
  const index = data.caseTypes.findIndex((t) => t.ava_code === code);
  const type = data.caseTypes[index];
  if (!type) {
    return <div className="empty">Case type not found</div>;
  }

  const stages = stagesFor(data, type.ava_lddcasetypeid);
  const cases = data.cases.filter((c) => c.ava_casetypecode === code);

  return (
    <>
      <PageHeader icon={iconFor(code, index)} title={type.ava_name} sub={type.ava_pegaclass ?? type.ava_code}>
        <button className="btn" type="button" onClick={() => onCreate(code)}>
          + New {type.ava_name}
        </button>
      </PageHeader>

      <div className="card">
        <div className="cardhd">
          <h3>Lifecycle</h3>
        </div>
        <div className="stagebar">
          {stages.map((s) => (
            <div
              className={`chevron ${s.ava_stagetype === 'Alternate' ? 'alt' : ''}`.trim()}
              key={s.ava_lddstageid}
            >
              {s.ava_name}
            </div>
          ))}
        </div>
      </div>

      <div className="cols">
        <div>
          <div className="card flush">
            <div className="cardhd">
              <h3>Cases</h3>
              <span className="count">{cases.length}</span>
              <Toolbar />
            </div>
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>Case ID</th>
                    <th>Assignment</th>
                    <th>Status</th>
                    <th>Stage</th>
                    <th className="num">Urgency</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="empty">
                        No cases yet
                      </td>
                    </tr>
                  ) : (
                    cases.map((c) => {
                      const a = openAssignmentFor(data, c.ava_lddworkcaseid);
                      return (
                        <tr key={c.ava_lddworkcaseid}>
                          <td>
                            <a onClick={() => onOpenCase(c.ava_lddworkcaseid)}>{c.ava_name}</a>
                          </td>
                          <td>
                            {a ? (
                              <a onClick={() => onOpenAssignment(c.ava_lddworkcaseid, a.ava_lddassignmentid)}>
                                {a.ava_name}
                              </a>
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </td>
                          <td className="statcell">
                            <StatusChip status={c.ava_status} />
                          </td>
                          <td className="muted">{c.ava_stagename ?? '—'}</td>
                          <td className="num">{urgencyOf(c)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div>
          <div className="card">
            <div className="cardhd">
              <h3>Process</h3>
            </div>
            {stages.map((s) => {
              const steps = stepsFor(data, s.ava_lddstageid);
              return (
                <div style={{ marginBottom: 16 }} key={s.ava_lddstageid}>
                  <div style={{ fontWeight: 700, marginBottom: 2 }}>
                    {s.ava_name}
                    <span className="kind">{s.ava_stagetype ?? 'Primary'}</span>
                  </div>
                  <div className="muted small" style={{ marginBottom: 6 }}>
                    {s.ava_processname ?? ''}
                  </div>
                  <ul className="steps">
                    {steps.length === 0 ? (
                      <li className="muted">No steps captured</li>
                    ) : (
                      steps.map((x) => (
                        <li key={x.ava_lddstepid}>
                          <span className="dot">{x.ava_kind === 'Assignment' ? '●' : '›'}</span>
                          <span>
                            <span className="nm">{x.ava_name}</span>
                            <span className="kind">{x.ava_kind ?? 'Step'}</span>
                            {x.ava_notificationname ? (
                              <div className="muted small">✉ {x.ava_notificationname}</div>
                            ) : null}
                          </span>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
