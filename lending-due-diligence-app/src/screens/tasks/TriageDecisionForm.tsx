import { useState } from 'react';
import { addBusinessDays } from '../../lib/format';
import type { CurrentUser, LddCase, LddEmployee, LddTask } from '../../lib/types';
import { TASK_KEYS } from '../../lib/types';
import { completeTask, createTask, updateCase } from '../../lib/data';

interface Props {
  record: LddCase;
  task: LddTask;
  employees: LddEmployee[];
  user: CurrentUser;
  onCancel: () => void;
  onDone: () => void;
}

/** Triage stage — "Triage Decision": Assign to, SLA (business days), Notes. */
export function TriageDecisionForm({ record, task, employees, user, onCancel, onDone }: Props) {
  const [assignTo, setAssignTo] = useState(record.ava_assignedto ?? '');
  const [sla, setSla] = useState<number>(record.ava_sladays ?? 1);
  const [notes, setNotes] = useState(record.ava_triagenotes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const persist = async (submit: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await updateCase(record.ava_lddcaseid, {
        ava_assignedto: assignTo,
        ava_sladays: sla,
        ava_triagenotes: notes,
        ...(submit
          ? {
              ava_stage: 'Review',
              ava_status: 'Open-Review',
              ava_caseowner: assignTo || user.displayName,
            }
          : {}),
      });
      if (submit) {
        await completeTask(task.ava_lddcasetaskid);
        await createTask({
          ava_name: 'Review Case Details',
          ava_taskkey: TASK_KEYS.reviewCaseDetails,
          ava_stage: 'Review',
          ava_assignedto: assignTo || user.displayName,
          ava_status: 'Pending',
          ava_assignmentdate: new Date().toISOString(),
          ava_deadline: addBusinessDays(new Date(), sla || 1).toISOString(),
          'ava_CaseId@odata.bind': `/ava_lddcases(${record.ava_lddcaseid})`,
          statecode: 0,
        });
      }
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel">
      <div className="task-head">
        <span className="avatar">{user.initials.slice(0, 1)}</span>
        <div>
          <div className="task-title">Triage Decision</div>
          <div className="task-sub">Triage Decision&nbsp;&nbsp;•</div>
        </div>
      </div>

      {error && <div className="banner-msg error">{error}</div>}

      <div className="field-grid">
        <div className="field">
          <label className="req" htmlFor="triageAssign">
            Assign to
          </label>
          <select
            id="triageAssign"
            value={assignTo}
            onChange={(e) => setAssignTo(e.target.value)}
          >
            <option value="">Select</option>
            {employees.map((e) => (
              <option key={e.ava_lddemployeeid} value={e.ava_name}>
                {e.ava_name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="req" htmlFor="triageSla">
            SLA (Business Days)
          </label>
          <input
            id="triageSla"
            type="number"
            min={1}
            max={30}
            style={{ textAlign: 'right' }}
            value={sla}
            onChange={(e) => setSla(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="field-grid cols-1" style={{ marginTop: 18 }}>
        <div className="field">
          <label htmlFor="triageNotes">Notes</label>
          <textarea id="triageNotes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>

      <div className="form-actions">
        <button className="btn btn-secondary" type="button" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <div className="spacer" />
        <button className="btn btn-secondary" type="button" onClick={() => persist(false)} disabled={busy}>
          Save
        </button>
        <button
          className="btn btn-primary"
          type="button"
          onClick={() => persist(true)}
          disabled={busy || !assignTo}
        >
          Submit
        </button>
      </div>
    </div>
  );
}
