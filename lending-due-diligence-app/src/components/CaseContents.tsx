import { dash, relativeTime } from '../lib/format';
import type { LddTask } from '../lib/types';

interface Props {
  tasks: LddTask[];
  onGo: (task: LddTask) => void;
}

/** "Case Contents / Overview" assignment table shown under the stage stepper. */
export function CaseContents({ tasks, onGo }: Props) {
  const pending = tasks.filter((t) => t.ava_status === 'Pending');
  return (
    <div className="panel">
      <div className="section-title">Case Contents</div>
      <div style={{ marginTop: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Overview</div>
          <div style={{ flex: 1 }} />
          <label className="checkbox-row" style={{ fontSize: 13 }}>
            <input type="checkbox" readOnly checked={false} /> View all
          </label>
        </div>
        <div className="grid-wrap" style={{ marginTop: 12 }}>
          <table className="grid">
            <thead>
              <tr>
                <th style={{ width: '26%' }}>Name</th>
                <th style={{ width: '20%' }}>Assigned to</th>
                <th style={{ width: '18%' }}>Goal</th>
                <th style={{ width: '18%' }}>Deadline</th>
                <th style={{ width: '12%' }}>Status</th>
                <th style={{ width: '6%' }} />
              </tr>
            </thead>
            <tbody>
              {pending.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-row">
                    ✧ No results.
                  </td>
                </tr>
              )}
              {pending.map((t) => (
                <tr key={t.ava_lddcasetaskid}>
                  <td>
                    {t.ava_name}
                    <br />
                    <span style={{ color: '#5a5a5a' }}>({t.ava_stage})</span>
                  </td>
                  <td>{dash(t.ava_assignedto)}</td>
                  <td>{t.ava_goal ? relativeTime(t.ava_goal) : ''}</td>
                  <td>{t.ava_deadline ? relativeTime(t.ava_deadline) : ''}</td>
                  <td>{dash(t.ava_status)}</td>
                  <td>
                    <button className="btn btn-primary btn-sm" type="button" onClick={() => onGo(t)}>
                      Go
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
