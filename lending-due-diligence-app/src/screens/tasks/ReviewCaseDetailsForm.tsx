import { useEffect, useMemo, useState } from 'react';
import {
  addCaseError,
  completeTask,
  createRating,
  createTask,
  listCaseErrors,
  listRatingsForCase,
  refValues,
  removeCaseError,
  setPrimaryError,
  updateCase,
  updateRating,
} from '../../lib/data';
import { addBusinessDays, dash } from '../../lib/format';
import { RATING_ROLES, TASK_KEYS } from '../../lib/types';
import type {
  CurrentUser,
  LddCase,
  LddCaseError,
  LddEmployee,
  LddError,
  LddRating,
  LddRefData,
  LddTask,
  LddTransaction,
} from '../../lib/types';

interface Props {
  record: LddCase;
  task: LddTask;
  transaction: LddTransaction | null;
  employees: LddEmployee[];
  errorCatalogue: LddError[];
  refData: LddRefData[];
  user: CurrentUser;
  onCancel: () => void;
  onDone: () => void;
}

/**
 * Review stage — "Review Case Details".
 * Review question, Rating and Recommendation role tabs, primary/secondary errors,
 * BC due diligence disposition, counters and manager level information.
 */
export function ReviewCaseDetailsForm({
  record,
  task,
  transaction,
  employees,
  errorCatalogue,
  refData,
  user,
  onCancel,
  onDone,
}: Props) {
  const [activeRole, setActiveRole] = useState<string>('Lender');
  const [ratings, setRatings] = useState<LddRating[]>([]);
  const [caseErrors, setCaseErrors] = useState<LddCaseError[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [answer, setAnswer] = useState(record.ava_reviewanswer ?? '');
  const [disposition, setDisposition] = useState(record.ava_bcduediligence ?? '');
  const [accountable, setAccountable] = useState(record.ava_employeeaccountable ?? '');
  const [alignmentChange, setAlignmentChange] = useState(Boolean(record.ava_alignmentchange));
  const [comments, setComments] = useState(record.ava_analystcomments ?? '');
  const [pendingErrorId, setPendingErrorId] = useState('');

  const [mgrEdits, setMgrEdits] = useState<Record<string, string>>({});

  // Manager details default from the lending employee's reporting line, and are
  // overridden by anything the analyst types.
  const mgr = useMemo(() => {
    const lender = employees.find((e) => e.ava_operatorid === transaction?.ava_operatorid);
    const m1 = employees.find((e) => e.ava_operatorid === lender?.ava_manageroperatorid);
    const m2 = employees.find((e) => e.ava_operatorid === lender?.ava_l2manageroperatorid);
    const defaults: Record<string, string> = {
      m1OperatorId: record.ava_mgr1operatorid ?? m1?.ava_operatorid ?? '',
      m1CoinsId: record.ava_mgr1coinsid ?? m1?.ava_coinsid ?? '',
      m1Name: record.ava_mgr1name ?? m1?.ava_name ?? '',
      m1Email: record.ava_mgr1email ?? m1?.ava_emailaddress ?? '',
      m1JobTitle: record.ava_mgr1jobtitle ?? m1?.ava_jobtitle ?? '',
      m1Transit: record.ava_mgr1transit ?? m1?.ava_transit ?? '',
      m2OperatorId: record.ava_mgr2operatorid ?? m2?.ava_operatorid ?? '',
      m2CoinsId: record.ava_mgr2coinsid ?? m2?.ava_coinsid ?? '',
      m2Name: record.ava_mgr2name ?? m2?.ava_name ?? '',
      m2Email: record.ava_mgr2email ?? m2?.ava_emailaddress ?? '',
      m2JobTitle: record.ava_mgr2jobtitle ?? m2?.ava_jobtitle ?? '',
      m2Transit: record.ava_mgr2transit ?? m2?.ava_transit ?? '',
    };
    return { ...defaults, ...mgrEdits };
  }, [employees, transaction, record, mgrEdits]);

  const reload = async () => {
    const rs = await listRatingsForCase(record.ava_lddcaseid);
    setRatings(rs);
    setCaseErrors(await listCaseErrors(rs.map((r) => r.ava_lddratingid)));
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rs = await listRatingsForCase(record.ava_lddcaseid);
        if (cancelled) return;
        setRatings(rs);
        setCaseErrors(await listCaseErrors(rs.map((r) => r.ava_lddratingid)));
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [record.ava_lddcaseid]);

  const activeRating = ratings.find((r) => r.ava_role === activeRole);
  const activeErrors = useMemo(
    () => caseErrors.filter((e) => e._ava_ratingid_value === activeRating?.ava_lddratingid),
    [caseErrors, activeRating]
  );

  const roleEmployee = useMemo(() => {
    if (!transaction) return undefined;
    const opId = activeRole === 'Overrider' ? transaction.ava_overriderid : transaction.ava_operatorid;
    return employees.find((e) => e.ava_operatorid === opId);
  }, [activeRole, transaction, employees]);

  const ensureRating = async (): Promise<LddRating> => {
    if (activeRating) return activeRating;
    const created = await createRating({
      ava_name: activeRole,
      ava_role: activeRole,
      ava_operatorid: roleEmployee?.ava_operatorid ?? '',
      ava_employeename: roleEmployee?.ava_name ?? '',
      ava_sortorder: RATING_ROLES.indexOf(activeRole as (typeof RATING_ROLES)[number]) + 1,
      'ava_CaseId@odata.bind': `/ava_lddcases(${record.ava_lddcaseid})`,
      statecode: 0,
    });
    setRatings((prev) => [...prev, created]);
    return created;
  };

  const handleAddError = async () => {
    const chosen = errorCatalogue.find((e) => e.ava_ldderrorid === pendingErrorId);
    if (!chosen) return;
    setBusy(true);
    try {
      const rating = await ensureRating();
      await addCaseError(rating.ava_lddratingid, chosen, activeErrors.length === 0);
      setPendingErrorId('');
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handlePrimary = async (row: LddCaseError) => {
    setBusy(true);
    try {
      await Promise.all(
        activeErrors.map((e) =>
          setPrimaryError(e.ava_lddcaseerrorid, e.ava_lddcaseerrorid === row.ava_lddcaseerrorid)
        )
      );
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (row: LddCaseError) => {
    setBusy(true);
    try {
      await removeCaseError(row.ava_lddcaseerrorid);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const persist = async (submit: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const escalation = disposition === 'Escalation';
      const coaching = disposition === 'Coaching';
      const fyi = disposition === 'FYI';

      await updateCase(record.ava_lddcaseid, {
        ava_reviewanswer: answer,
        ava_bcduediligence: disposition,
        ava_employeeaccountable: accountable,
        ava_alignmentchange: alignmentChange,
        ava_analystcomments: comments,
        ava_mgr1operatorid: mgr.m1OperatorId,
        ava_mgr1coinsid: mgr.m1CoinsId,
        ava_mgr1name: mgr.m1Name,
        ava_mgr1email: mgr.m1Email,
        ava_mgr1jobtitle: mgr.m1JobTitle,
        ava_mgr1transit: mgr.m1Transit,
        ava_mgr2operatorid: mgr.m2OperatorId,
        ava_mgr2coinsid: mgr.m2CoinsId,
        ava_mgr2name: mgr.m2Name,
        ava_mgr2email: mgr.m2Email,
        ava_mgr2jobtitle: mgr.m2JobTitle,
        ava_mgr2transit: mgr.m2Transit,
        ...(submit
          ? {
              ava_stage: 'Recommendation and action',
              ava_status: 'Pending-Branch Response',
              ava_escalationcount: (record.ava_escalationcount ?? 0) + (escalation ? 1 : 0),
              ava_coachingcount: (record.ava_coachingcount ?? 0) + (coaching ? 1 : 0),
              ava_fyicount: (record.ava_fyicount ?? 0) + (fyi ? 1 : 0),
            }
          : {}),
      });

      if (activeRating) {
        await updateRating(activeRating.ava_lddratingid, {
          ava_bcduediligence: disposition,
          ava_employeeaccountable: accountable,
          ava_comments: comments,
          ava_operatorid: activeRating.ava_operatorid || roleEmployee?.ava_operatorid,
          ava_employeename: activeRating.ava_employeename || roleEmployee?.ava_name,
        });
      }

      if (submit) {
        await completeTask(task.ava_lddcasetaskid);
        await createTask({
          ava_name: escalation ? 'Provide Response for Escalation' : 'Provide Response for Coaching',
          ava_taskkey: escalation
            ? TASK_KEYS.provideResponseEscalation
            : TASK_KEYS.provideResponseCoaching,
          ava_stage: 'Recommendation and action',
          ava_assignedto: mgr.m1Name ? `${mgr.m1Name} (${mgr.m1OperatorId})` : 'Frontline Manager',
          ava_status: 'Pending',
          ava_assignmentdate: new Date().toISOString(),
          ava_goal: addBusinessDays(new Date(), 1).toISOString(),
          ava_deadline: addBusinessDays(new Date(), record.ava_sladays ?? 2).toISOString(),
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

  const dispositions = refValues(refData, 'BcDueDiligence');

  return (
    <div className="panel">
      <div className="task-head">
        <span className="avatar">{user.initials}</span>
        <div>
          <div className="task-title">Review Case Details</div>
          <div className="task-sub">Review Case Details&nbsp;&nbsp;•&nbsp;&nbsp;Due 1 day from now</div>
        </div>
      </div>

      <div className="callout">
        <span>Transaction Details</span>
        <span className="callout-link">Opens a new window in your browser. ⧉</span>
      </div>

      {error && <div className="banner-msg error">{error}</div>}

      <div className="section-title">Answer the following questions:</div>
      <hr className="rule" />
      <div className="field-grid">
        <div className="field">
          <label htmlFor="reviewAnswer">
            {record.ava_reviewquestion || 'Was the transaction reviewed against the template criteria?'}
          </label>
          <select id="reviewAnswer" value={answer} onChange={(e) => setAnswer(e.target.value)}>
            <option value="">Select</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
            <option value="N/A">N/A</option>
          </select>
        </div>
      </div>

      <div className="section-title" style={{ marginTop: 32 }}>
        Rating and Recommendation
      </div>
      <hr className="rule" />

      <div className="tabs">
        {RATING_ROLES.map((role) => (
          <button
            key={role}
            type="button"
            className={`tab${activeRole === role ? ' active' : ''}`}
            onClick={() => setActiveRole(role)}
          >
            {role}
          </button>
        ))}
      </div>

      <div className="field-grid">
        <div>
          <div className="readonly-label">Operator ID ⓘ</div>
          <div className="readonly-value">
            {dash(activeRating?.ava_operatorid ?? roleEmployee?.ava_operatorid)}
          </div>
        </div>
        <div>
          <div className="readonly-label">Employee Name</div>
          <div className="readonly-value">
            {dash(activeRating?.ava_employeename ?? roleEmployee?.ava_name)}
          </div>
        </div>
      </div>

      <div className="subpanel" style={{ marginTop: 22 }}>
        <div className="subpanel-title">Primary or Secondary Errors</div>
        <hr className="rule" style={{ margin: '10px 0 0' }} />
        <div className="error-row" style={{ color: '#5a5a5a', fontSize: 13, paddingTop: 10 }}>
          <span style={{ width: 130 }}>Select a primary error</span>
          <span className="err-text">Errors</span>
          <span style={{ width: 60, textAlign: 'right' }}>Action</span>
        </div>
        {loading ? (
          <div className="loading">Loading errors…</div>
        ) : (
          <>
            {activeErrors.length === 0 && (
              <div className="empty-row">No errors recorded for {activeRole}.</div>
            )}
            {activeErrors.map((row) => (
              <div className="error-row" key={row.ava_lddcaseerrorid}>
                <span style={{ width: 130 }}>
                  <input
                    type="checkbox"
                    checked={Boolean(row.ava_isprimary)}
                    onChange={() => handlePrimary(row)}
                    disabled={busy}
                    style={{ width: 18, height: 18, accentColor: '#2f8e9b' }}
                  />
                </span>
                <span className="err-text">{row.ava_name}</span>
                <span style={{ width: 60, textAlign: 'right' }}>
                  <button
                    className="icon-btn"
                    type="button"
                    onClick={() => handleRemove(row)}
                    disabled={busy}
                    aria-label="Remove error"
                  >
                    🗑
                  </button>
                </span>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginTop: 12 }}>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="addError">Add Primary or Secondary Error</label>
                <select
                  id="addError"
                  value={pendingErrorId}
                  onChange={(e) => setPendingErrorId(e.target.value)}
                >
                  <option value="">Select an error</option>
                  {errorCatalogue.map((e) => (
                    <option key={e.ava_ldderrorid} value={e.ava_ldderrorid}>
                      {e.ava_name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={handleAddError}
                disabled={!pendingErrorId || busy}
              >
                ⊕ Add
              </button>
            </div>
          </>
        )}
      </div>

      <div className="field-grid">
        <div className="field">
          <label htmlFor="disposition">BC due diligence</label>
          <select
            id="disposition"
            value={disposition}
            onChange={(e) => setDisposition(e.target.value)}
          >
            <option value="">Select</option>
            {dispositions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="accountable">Employee Accountable</label>
          <select
            id="accountable"
            value={accountable}
            onChange={(e) => setAccountable(e.target.value)}
          >
            <option value="">Select</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        </div>
      </div>

      <div style={{ marginTop: 22 }}>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={alignmentChange}
            onChange={(e) => setAlignmentChange(e.target.checked)}
          />
          Alignment change?
        </label>
      </div>

      <div className="field-grid cols-1" style={{ marginTop: 22 }}>
        <div className="field">
          <label htmlFor="analystComments">Comments</label>
          <textarea
            id="analystComments"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
          />
        </div>
      </div>

      <div className="section-title" style={{ marginTop: 30 }}>
        Counter for escalation, coaching and FYI
      </div>
      <hr className="rule" />
      <div className="counter-grid">
        <div className="counter">
          <div className="counter-label">Escalation</div>
          <div className="counter-value">{record.ava_escalationcount ?? 0}</div>
        </div>
        <div className="counter">
          <div className="counter-label">Coaching</div>
          <div className="counter-value">{record.ava_coachingcount ?? 0}</div>
        </div>
        <div className="counter">
          <div className="counter-label">FYI</div>
          <div className="counter-value">{record.ava_fyicount ?? 0}</div>
        </div>
      </div>

      <div className="section-title" style={{ marginTop: 34 }}>
        Manager level information
      </div>
      <hr className="rule" />

      <ManagerBlock
        title="1st level manager details"
        prefix="m1"
        values={mgr}
        onChange={(k, v) => setMgrEdits((prev) => ({ ...prev, [k]: v }))}
      />
      <ManagerBlock
        title="2nd level manager details"
        prefix="m2"
        values={mgr}
        onChange={(k, v) => setMgrEdits((prev) => ({ ...prev, [k]: v }))}
      />

      <div className="form-actions">
        <button className="btn btn-secondary" type="button" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <div className="spacer" />
        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => persist(false)}
          disabled={busy}
        >
          Save
        </button>
        <button
          className="btn btn-primary"
          type="button"
          onClick={() => persist(true)}
          disabled={busy || !disposition}
        >
          Submit
        </button>
      </div>
    </div>
  );
}

type MgrValues = Record<string, string>;

function ManagerBlock({
  title,
  prefix,
  values,
  onChange,
}: {
  title: string;
  prefix: 'm1' | 'm2';
  values: MgrValues;
  onChange: (key: string, value: string) => void;
}) {
  const fields: Array<[string, string]> = [
    ['OperatorId', 'Operator ID'],
    ['CoinsId', 'COINS ID'],
    ['Name', 'Employee Name'],
    ['Email', 'Email address'],
    ['JobTitle', 'Job Title'],
    ['Transit', 'Transit'],
  ];
  return (
    <div className="subpanel">
      <div className="subpanel-title">{title}</div>
      <hr className="rule" style={{ margin: '10px 0 18px' }} />
      <div className="field-grid">
        {fields.map(([suffix, label]) => {
          const key = `${prefix}${suffix}`;
          return (
            <div className="field" key={key}>
              <label htmlFor={key}>{label}</label>
              <input
                id={key}
                type="text"
                value={values[key] ?? ''}
                onChange={(e) => onChange(key, e.target.value)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
