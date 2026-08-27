import { useEffect, useMemo, useState } from 'react';
import {
  createCase,
  createTask,
  getTransaction,
  listCases,
  listEmployees,
  listRefData,
  listReviewTemplates,
  refValues,
} from '../lib/data';
import { addBusinessDays, nextCaseId } from '../lib/format';
import { StageStepper } from '../components/StageStepper';
import { TASK_KEYS } from '../lib/types';
import type { CurrentUser, LddEmployee, LddRefData, LddReviewTemplate, LddTransaction } from '../lib/types';

interface Props {
  transactionId: string;
  user: CurrentUser;
  onCreated: (caseId: string) => void;
  onBack: () => void;
  onCancel: () => void;
}

/**
 * Initialization stage — "Collect Case Parameter".
 * Queue Type / Review name / Review Template ID or Name / Assign to, then Create.
 */
export function NewCaseParametersScreen({ transactionId, user, onCreated, onBack, onCancel }: Props) {
  const [refData, setRefData] = useState<LddRefData[]>([]);
  const [templates, setTemplates] = useState<LddReviewTemplate[]>([]);
  const [employees, setEmployees] = useState<LddEmployee[]>([]);
  const [transaction, setTransaction] = useState<LddTransaction | null>(null);
  const [existingIds, setExistingIds] = useState<string[]>([]);

  const [queueType, setQueueType] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [assignTo, setAssignTo] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      listRefData(),
      listReviewTemplates(),
      listEmployees(),
      getTransaction(transactionId),
      listCases(),
    ])
      .then(([r, t, e, tx, cases]) => {
        if (cancelled) return;
        setRefData(r);
        setTemplates(t);
        setEmployees(e);
        setTransaction(tx);
        setExistingIds(cases.map((c) => c.ava_name));
        const defaultQueue = refValues(r, 'QueueType')[0] ?? '';
        setQueueType(defaultQueue);
        const firstTemplate = t.find((x) => x.ava_queuetype === defaultQueue) ?? t[0];
        if (firstTemplate) setTemplateId(firstTemplate.ava_lddreviewtemplateid);
      })
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [transactionId]);

  const queueTemplates = useMemo(
    () => templates.filter((t) => !queueType || t.ava_queuetype === queueType),
    [templates, queueType]
  );

  const selectedTemplate = templates.find((t) => t.ava_lddreviewtemplateid === templateId);
  const canCreate = Boolean(queueType && selectedTemplate && !busy);

  const handleCreate = async () => {
    if (!selectedTemplate || !transaction) return;
    setBusy(true);
    setError(null);
    try {
      const caseId = nextCaseId(existingIds);
      const owner = assignTo || user.displayName;
      const created = await createCase({
        ava_name: caseId,
        ava_stage: 'Triage',
        ava_status: 'Open-Triage',
        ava_caseowner: assignTo || '',
        ava_createdbyuser: user.displayName,
        ava_queuetype: queueType,
        ava_reviewname: selectedTemplate.ava_reviewname,
        ava_reviewtemplatename: selectedTemplate.ava_name,
        ava_channel: transaction.ava_channel,
        ava_producttype: transaction.ava_producttype,
        ava_purpose: transaction.ava_purpose,
        ava_piddescription: transaction.ava_piddescription,
        ava_assignedto: owner,
        ava_sladays: selectedTemplate.ava_recommendsla ?? 1,
        ava_escalationcount: 0,
        ava_coachingcount: 0,
        ava_fyicount: 0,
        ava_alignmentchange: false,
        'ava_TransactionId@odata.bind': `/ava_lddtransactions(${transactionId})`,
        statecode: 0,
      });

      await createTask({
        ava_name: 'Triage Decision',
        ava_taskkey: TASK_KEYS.triageDecision,
        ava_stage: 'Triage',
        ava_assignedto: assignTo || 'BCGeneralWB',
        ava_status: 'Pending',
        ava_assignmentdate: new Date().toISOString(),
        ava_deadline: addBusinessDays(new Date(), selectedTemplate.ava_recommendsla ?? 1).toISOString(),
        'ava_CaseId@odata.bind': `/ava_lddcases(${created.ava_lddcaseid})`,
        statecode: 0,
      });

      onCreated(created.ava_lddcaseid);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="work-area">
      <StageStepper currentStage="Initialization" />

      <div className="panel">
        <div className="task-head">
          <span className="avatar">{user.initials}</span>
          <div>
            <div className="task-title">Collect Case Parameter</div>
            <div className="task-sub">Collect Case Parameter&nbsp;&nbsp;•</div>
          </div>
        </div>

        <div className="section-title">Case Parameters</div>
        <hr className="rule" />

        {error && <div className="banner-msg error">{error}</div>}
        {loading ? (
          <div className="loading">Loading case parameters…</div>
        ) : (
          <>
            <div className="field-grid cols-4">
              <div className="field">
                <label className="req" htmlFor="queueType">
                  Queue Type
                </label>
                <select
                  id="queueType"
                  value={queueType}
                  onChange={(e) => {
                    setQueueType(e.target.value);
                    const first = templates.find((t) => t.ava_queuetype === e.target.value);
                    setTemplateId(first ? first.ava_lddreviewtemplateid : '');
                  }}
                >
                  <option value="">Select</option>
                  {refValues(refData, 'QueueType').map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label className="req" htmlFor="reviewName">
                  Review name
                </label>
                <input
                  id="reviewName"
                  type="text"
                  readOnly
                  value={selectedTemplate?.ava_reviewname ?? ''}
                />
              </div>

              <div className="field">
                <label className="req" htmlFor="templateId">
                  Review Template ID or Name
                </label>
                <select
                  id="templateId"
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                >
                  <option value="">Select</option>
                  {queueTemplates.map((t) => (
                    <option key={t.ava_lddreviewtemplateid} value={t.ava_lddreviewtemplateid}>
                      {t.ava_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="assignTo">Assign to</label>
                <select id="assignTo" value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
                  <option value="">Select</option>
                  {employees.map((e) => (
                    <option key={e.ava_lddemployeeid} value={`${e.ava_name}`}>
                      {e.ava_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-actions">
              <button className="btn btn-secondary" type="button" onClick={onCancel} disabled={busy}>
                Cancel
              </button>
              <button className="btn btn-secondary" type="button" onClick={onBack} disabled={busy}>
                Back
              </button>
              <div className="spacer" />
              <button
                className="btn btn-primary"
                type="button"
                onClick={handleCreate}
                disabled={!canCreate}
              >
                {busy ? 'Creating…' : 'Create'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
