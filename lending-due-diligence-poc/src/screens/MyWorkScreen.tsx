import { caseTypeName, isOpen, openAssignmentFor, type AppData } from '../lib/appdata';
import { PageHeader, StatusChip, Toolbar } from '../components/Primitives';
import { formatDate } from '../lib/format';

interface MyWorkScreenProps {
  data: AppData;
  onOpenCase: (caseId: string) => void;
  onOpenAssignment: (caseId: string, assignmentId: string) => void;
}

/** Mirrors `pageMyWork()`: a six-column worklist of every open case. */
export function MyWorkScreen({ data, onOpenCase, onOpenAssignment }: MyWorkScreenProps) {
  const open = data.cases.filter(isOpen);

  return (
    <>
      <PageHeader icon="work" title="My Work" />
      <div className="card flush">
        <div className="cardhd">
          <h3>My work:</h3>
          <span className="selv">All ▾</span>
          <span className="count">{open.length}</span>
          <Toolbar />
        </div>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Case ID</th>
                <th>Assignment</th>
                <th>Case Type</th>
                <th>Status</th>
                <th>Due date</th>
                <th className="num">Urgency</th>
              </tr>
            </thead>
            <tbody>
              {open.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty">
                    No open assignments
                  </td>
                </tr>
              ) : (
                open.map((c) => {
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
                      <td>{caseTypeName(data, c.ava_casetypecode)}</td>
                      <td className="statcell">
                        <StatusChip status={c.ava_status} />
                      </td>
                      <td className="muted">{a?.ava_deadline ? formatDate(a.ava_deadline) : '—'}</td>
                      <td className="num">{Number(c.ava_urgency ?? 0).toFixed(2)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
