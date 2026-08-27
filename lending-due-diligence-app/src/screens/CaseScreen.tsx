import { useCallback, useEffect, useState } from 'react';
import {
  getCase,
  getTransaction,
  listCaseErrors,
  listEmployees,
  listErrors,
  listRatingsForCase,
  listRefData,
  listTasksForCase,
  updateCase,
} from '../lib/data';
import { CaseSummaryPanel } from '../components/CaseSummaryPanel';
import { CaseContents } from '../components/CaseContents';
import { StageStepper } from '../components/StageStepper';
import { CaseSections } from './CaseSections';
import { TriageDecisionForm } from './tasks/TriageDecisionForm';
import { ReviewCaseDetailsForm } from './tasks/ReviewCaseDetailsForm';
import { ProvideResponseForm } from './tasks/ProvideResponseForm';
import { TASK_KEYS } from '../lib/types';
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
} from '../lib/types';

interface Props {
  caseId: string;
  initialTaskId?: string;
  user: CurrentUser;
  onExit: () => void;
}

/** Case detail workspace: stage stepper, case contents and the active assignment form. */
export function CaseScreen({ caseId, initialTaskId, user, onExit }: Props) {
  const [record, setRecord] = useState<LddCase | null>(null);
  const [tasks, setTasks] = useState<LddTask[]>([]);
  const [transaction, setTransaction] = useState<LddTransaction | null>(null);
  const [ratings, setRatings] = useState<LddRating[]>([]);
  const [caseErrors, setCaseErrors] = useState<LddCaseError[]>([]);
  const [employees, setEmployees] = useState<LddEmployee[]>([]);
  const [errorCatalogue, setErrorCatalogue] = useState<LddError[]>([]);
  const [refData, setRefData] = useState<LddRefData[]>([]);

  const [openTaskId, setOpenTaskId] = useState<string | undefined>(initialTaskId);
  const [section, setSection] = useState('Overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(
    async (autoOpen: boolean) => {
      try {
        const [c, t, rs, emps, errs, refs] = await Promise.all([
          getCase(caseId),
          listTasksForCase(caseId),
          listRatingsForCase(caseId),
          listEmployees(),
          listErrors(),
          listRefData(),
        ]);
        const errorRows = await listCaseErrors(rs.map((r) => r.ava_lddratingid));
        const tx = c._ava_transactionid_value
          ? await getTransaction(c._ava_transactionid_value)
          : null;
        setRecord(c);
        setTasks(t);
        setRatings(rs);
        setCaseErrors(errorRows);
        setEmployees(emps);
        setErrorCatalogue(errs);
        setRefData(refs);
        setTransaction(tx);
        if (autoOpen && initialTaskId) setOpenTaskId(initialTaskId);
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [caseId, initialTaskId]
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (cancelled) return;
      await load(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const openTask = tasks.find((t) => t.ava_lddcasetaskid === openTaskId && t.ava_status === 'Pending');

  const handleDone = async (message: string) => {
    setOpenTaskId(undefined);
    setNotice(message);
    await load(false);
  };

  const handleReopen = async () => {
    if (!record) return;
    await updateCase(record.ava_lddcaseid, {
      ava_status: 'Open-Review',
      ava_stage: 'Review',
    });
    await load(false);
  };

  if (loading && !record) {
    return <div className="loading">Loading case…</div>;
  }
  if (error && !record) {
    return (
      <div className="work-area">
        <div className="banner-msg error">{error}</div>
        <button className="btn btn-secondary" type="button" onClick={onExit}>
          Back to worklist
        </button>
      </div>
    );
  }
  if (!record) return null;

  const resolved = (record.ava_status ?? '').startsWith('Resolved');

  return (
    <div className="case-layout">
      <CaseSummaryPanel
        record={record}
        activeSection={section}
        onSection={(s) => {
          setSection(s);
          setOpenTaskId(undefined);
        }}
        onReopen={handleReopen}
        showEdit={!resolved}
      />

      <div className="work-area">
        <StageStepper currentStage={record.ava_stage} resolved={resolved} />

        {notice && <div className="banner-msg success">{notice}</div>}
        {error && <div className="banner-msg error">{error}</div>}

        {section === 'Overview' ? (
          <>
            {openTask && renderTask(openTask)}
            <CaseContents
              tasks={tasks}
              onGo={(t) => {
                setNotice(null);
                setOpenTaskId(t.ava_lddcasetaskid);
              }}
            />
          </>
        ) : (
          <CaseSections
            section={section}
            record={record}
            transaction={transaction}
            ratings={ratings}
            caseErrors={caseErrors}
          />
        )}
      </div>
    </div>
  );

  function renderTask(task: LddTask) {
    const key = task.ava_taskkey;
    if (key === TASK_KEYS.triageDecision) {
      return (
        <TriageDecisionForm
          record={record!}
          task={task}
          employees={employees}
          user={user}
          onCancel={() => setOpenTaskId(undefined)}
          onDone={() => handleDone('Triage decision saved.')}
        />
      );
    }
    if (key === TASK_KEYS.reviewCaseDetails) {
      return (
        <ReviewCaseDetailsForm
          record={record!}
          task={task}
          transaction={transaction}
          employees={employees}
          errorCatalogue={errorCatalogue}
          refData={refData}
          user={user}
          onCancel={() => setOpenTaskId(undefined)}
          onDone={() => handleDone('Review case details saved.')}
        />
      );
    }
    if (
      key === TASK_KEYS.provideResponseEscalation ||
      key === TASK_KEYS.provideResponseCoaching
    ) {
      return (
        <ProvideResponseForm
          record={record!}
          task={task}
          transaction={transaction}
          user={user}
          onCancel={() => setOpenTaskId(undefined)}
          onDone={() => handleDone('Response submitted.')}
        />
      );
    }
    return null;
  }
}
