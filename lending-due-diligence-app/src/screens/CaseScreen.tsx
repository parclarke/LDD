import { useCallback, useEffect, useState } from 'react';
import { CaseSummaryPanel } from '../components/CaseSummaryPanel';
import { StageStepper } from '../components/StageStepper';
import { CaseSections } from './CaseSections';
import { AssignmentForm } from './forms/AssignmentForm';
import { ApprovalForm } from './forms/ApprovalForm';
import {
  getCaseDetail,
  getWorkCase,
  listApprovalsForCase,
  listAssignmentsForCase,
  listHistoryForCase,
} from '../lib/data';
import type { LookupSources } from '../lib/data';
import { advanceCase, changeStage } from '../lib/orchestrator';
import { dash, relativeTime } from '../lib/format';
import type {
  CaseBundle,
  CaseTypeCode,
  CurrentUser,
  LddAssignment,
  ProcessConfig,
} from '../lib/types';
import { DETAIL_SET } from '../lib/types';

interface Props {
  caseId: string;
  initialAssignmentId?: string;
  config: ProcessConfig;
  lookups: LookupSources;
  user: CurrentUser;
  onExit: () => void;
}

/** Case workspace: stage stepper, open work, case contents and read-only sections. */
export function CaseScreen({ caseId, initialAssignmentId, config, lookups, user, onExit }: Props) {
  const [bundle, setBundle] = useState<CaseBundle | null>(null);
  const [openId, setOpenId] = useState<string | undefined>(initialAssignmentId);
  const [section, setSection] = useState('Overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const record = await getWorkCase(caseId);
    const code = (record.ava_casetypecode ?? '') as CaseTypeCode;
    const caseType = config.caseTypes.find((c) => c.ava_code === code);
    const stages = config.stages.filter(
      (s) => s._ava_casetypeid_value === record._ava_casetypeid_value
    );
    const stageIds = new Set(stages.map((s) => s.ava_lddstageid));
    const steps = config.steps.filter((s) => stageIds.has(s._ava_stageid_value ?? ''));

    const [detail, assignments, approvals, history] = await Promise.all([
      getCaseDetail(code, caseId),
      listAssignmentsForCase(caseId),
      listApprovalsForCase(caseId),
      listHistoryForCase(caseId),
    ]);

    return {
      record,
      caseType,
      stages,
      steps,
      detail,
      detailSet: DETAIL_SET[code] ?? '',
      assignments,
      approvals,
      history,
    } satisfies CaseBundle;
  }, [caseId, config]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const next = await load();
        if (!cancelled) {
          setBundle(next);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const refresh = async (message?: string) => {
    setBusy(true);
    try {
      const next = await load();
      setBundle(next);
      if (message) setNotice(message);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="loading">Loading case…</div>;
  if (error && !bundle) {
    return (
      <div className="work-area">
        <div className="banner-msg error">{error}</div>
        <button className="btn btn-secondary" type="button" onClick={onExit}>
          Back to worklist
        </button>
      </div>
    );
  }
  if (!bundle) return null;

  const { record, assignments, approvals } = bundle;
  const resolved = (record.ava_status ?? '').startsWith('Resolved');
  const pendingAssignments = assignments.filter((a) => a.ava_status === 'Pending');
  const pendingApproval = approvals.find((a) => a.ava_status === 'Pending');
  const openAssignment = pendingAssignments.find((a) => a.ava_lddassignmentid === openId);

  const handleChangeStage = async (stageCode: string) => {
    setBusy(true);
    setNotice(null);
    try {
      const result = await changeStage(record, stageCode, 'Manual stage change', config, user);
      await refresh(`Moved to ${result.record.ava_stagename}. ${result.actionsTaken.join('; ')}`);
      setOpenId(undefined);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const handleAdvance = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const result = await advanceCase(record, config, user);
      await refresh(
        result.actionsTaken.length
          ? `Case advanced: ${result.actionsTaken.join('; ')}`
          : 'Nothing further to run at this point.'
      );
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="case-layout">
      <CaseSummaryPanel
        bundle={bundle}
        activeSection={section}
        onSection={(s) => {
          setSection(s);
          setOpenId(undefined);
        }}
        onChangeStage={handleChangeStage}
      />

      <div className="work-area">
        <StageStepper
          stages={bundle.stages}
          currentStageCode={record.ava_stagecode}
          resolved={resolved}
        />

        {notice && <div className="banner-msg success">{notice}</div>}
        {error && <div className="banner-msg error">{error}</div>}

        {section === 'Overview' ? (
          <>
            {openAssignment && (
              <AssignmentForm
                bundle={bundle}
                assignment={openAssignment}
                config={config}
                lookups={lookups}
                user={user}
                onCancel={() => setOpenId(undefined)}
                onDone={async (msg) => {
                  setOpenId(undefined);
                  await refresh(msg);
                }}
              />
            )}

            {!openAssignment && pendingApproval && (
              <ApprovalForm
                bundle={bundle}
                approval={pendingApproval}
                config={config}
                user={user}
                onCancel={() => setSection('Overview')}
                onDone={async (msg) => refresh(msg)}
              />
            )}

            <CaseContents
              assignments={pendingAssignments}
              onGo={(a) => {
                setNotice(null);
                setOpenId(a.ava_lddassignmentid);
              }}
            />

            {!resolved && pendingAssignments.length === 0 && !pendingApproval && (
              <div className="panel">
                <div className="section-title">No open work</div>
                <hr className="rule" />
                <p className="muted">
                  This case has no pending assignment. Run the engine to execute the next
                  automated steps and create the next assignment.
                </p>
                <div className="form-actions">
                  <div className="spacer" />
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={handleAdvance}
                    disabled={busy}
                  >
                    {busy ? 'Running…' : 'Run next steps'}
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <CaseSections section={section} bundle={bundle} config={config} />
        )}
      </div>
    </div>
  );
}

function CaseContents({
  assignments,
  onGo,
}: {
  assignments: LddAssignment[];
  onGo: (a: LddAssignment) => void;
}) {
  return (
    <div className="panel">
      <div className="section-title">Case Contents</div>
      <div style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Open work</div>
        <div className="grid-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th style={{ width: '30%' }}>Task</th>
                <th>Assigned to</th>
                <th>Routing</th>
                <th>Goal</th>
                <th>Deadline</th>
                <th style={{ width: 80 }} />
              </tr>
            </thead>
            <tbody>
              {assignments.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-row">
                    ✧ No results.
                  </td>
                </tr>
              )}
              {assignments.map((a) => (
                <tr key={a.ava_lddassignmentid}>
                  <td>
                    {a.ava_stepname ?? a.ava_name}
                    <br />
                    <span className="muted">{a.ava_viewname}</span>
                  </td>
                  <td>{dash(a.ava_assignedto)}</td>
                  <td>
                    <span className="pill">{dash(a.ava_assignmenttype)}</span>
                  </td>
                  <td>{a.ava_goal ? relativeTime(a.ava_goal) : '—'}</td>
                  <td>{a.ava_deadline ? relativeTime(a.ava_deadline) : '—'}</td>
                  <td>
                    <button className="btn btn-primary btn-sm" type="button" onClick={() => onGo(a)}>
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
