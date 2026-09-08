import { useMemo, useState } from 'react';
import { DynamicForm } from '../components/DynamicForm';
import { partitionValues } from '../components/formMapping';
import type { FormValues } from '../components/DynamicForm';
import { StageStepper } from '../components/StageStepper';
import { createCase } from '../lib/orchestrator';
import { primaryStages } from '../lib/engine';
import type { LookupSources } from '../lib/data';
import type { CurrentUser, LddCaseType, ProcessConfig } from '../lib/types';

interface Props {
  config: ProcessConfig;
  lookups: LookupSources;
  user: CurrentUser;
  onCreated: (caseId: string) => void;
  onCancel: () => void;
}

/**
 * Case creation. The user picks a case type, then fills in the form defined by the
 * first assignment step of that type's create stage - exactly as the prototype does.
 */
export function NewCaseScreen({ config, lookups, user, onCreated, onCancel }: Props) {
  const [caseType, setCaseType] = useState<LddCaseType | null>(null);
  const [values, setValues] = useState<FormValues>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stages = useMemo(
    () => (caseType ? config.stages.filter((s) => s._ava_casetypeid_value === caseType.ava_lddcasetypeid) : []),
    [config.stages, caseType]
  );

  // The intake form is the first Assignment step of the first primary stage.
  const intake = useMemo(() => {
    if (!caseType) return { viewName: null as string | null, fields: [] };
    const first = primaryStages(stages)[0];
    if (!first) return { viewName: null, fields: [] };
    const steps = config.steps
      .filter((s) => s._ava_stageid_value === first.ava_lddstageid)
      .sort((a, b) => (a.ava_sortorder ?? 0) - (b.ava_sortorder ?? 0));
    const step = steps.find((s) => s.ava_kind === 'Assignment' && s.ava_viewname);
    if (!step?.ava_viewname) return { viewName: null, fields: [] };
    const view = config.views.find((v) => v.ava_name === step.ava_viewname);
    if (!view) return { viewName: step.ava_viewname, fields: [] };
    return {
      viewName: view.ava_name,
      fields: config.viewFields
        .filter((f) => f._ava_viewid_value === view.ava_lddviewid)
        .sort((a, b) => (a.ava_sortorder ?? 0) - (b.ava_sortorder ?? 0)),
    };
  }, [caseType, stages, config]);

  const handleCreate = async () => {
    if (!caseType) return;
    setBusy(true);
    setError(null);
    try {
      const { detail, workCase } = partitionValues(intake.fields, values, caseType.ava_code ?? '');
      const result = await createCase(caseType, detail, workCase, config, user);
      onCreated(result.record.ava_lddworkcaseid);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="work-area">
      {caseType && <StageStepper stages={stages} currentStageCode={primaryStages(stages)[0]?.ava_stagecode} />}

      <div className="panel">
        <div className="task-head">
          <span className="avatar">{user.initials}</span>
          <div>
            <div className="task-title">Create a case</div>
            <div className="task-sub">
              {caseType ? `${caseType.ava_name} - ${intake.viewName ?? 'intake'}` : 'Choose a case type'}
            </div>
          </div>
        </div>

        {error && <div className="banner-msg error">{error}</div>}

        <div className="section-title">Case type</div>
        <hr className="rule" />
        <div className="case-type-grid">
          {config.caseTypes.map((ct) => {
            const ctStages = config.stages.filter(
              (s) => s._ava_casetypeid_value === ct.ava_lddcasetypeid
            );
            return (
              <button
                key={ct.ava_lddcasetypeid}
                type="button"
                className={`case-type-card${caseType?.ava_lddcasetypeid === ct.ava_lddcasetypeid ? ' selected' : ''}`}
                onClick={() => {
                  setCaseType(ct);
                  setValues({});
                }}
              >
                <div className="ct-name">{ct.ava_name}</div>
                <div className="ct-meta">
                  Prefix {ct.ava_caseprefix} &middot; {ctStages.length} stages &middot;{' '}
                  {ctStages.filter((s) => s.ava_stagetype === 'Primary').length} primary
                </div>
              </button>
            );
          })}
        </div>

        {caseType && (
          <>
            <div className="section-title" style={{ marginTop: 30 }}>
              {intake.viewName ?? 'Case details'}
            </div>
            <hr className="rule" />
            <DynamicForm
              fields={intake.fields}
              values={values}
              onChange={(k, v) => setValues((prev) => ({ ...prev, [k]: v }))}
              choiceSets={config.choiceSets}
              choiceValues={config.choiceValues}
              lookups={lookups}
              disabled={busy}
            />
          </>
        )}

        <div className="form-actions">
          <button className="btn btn-secondary" type="button" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <div className="spacer" />
          <button
            className="btn btn-primary"
            type="button"
            onClick={handleCreate}
            disabled={!caseType || busy}
          >
            {busy ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

