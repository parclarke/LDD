import { useState } from 'react';
import { DynamicForm } from '../../components/DynamicForm';
import { partitionValues } from '../../components/formMapping';
import type { FormValues } from '../../components/DynamicForm';
import { relativeTime } from '../../lib/format';
import { submitAssignment } from '../../lib/orchestrator';
import type { LookupSources } from '../../lib/data';
import type {
  CaseBundle,
  CaseTypeCode,
  CurrentUser,
  LddAssignment,
  ProcessConfig,
} from '../../lib/types';

interface Props {
  bundle: CaseBundle;
  assignment: LddAssignment;
  config: ProcessConfig;
  lookups: LookupSources;
  user: CurrentUser;
  onCancel: () => void;
  onDone: (message: string) => void;
}

/**
 * Renders the open assignment's form from view metadata, then submits it through
 * the orchestrator which saves the values, closes the assignment and advances the
 * case to its next pause point.
 */
export function AssignmentForm({
  bundle,
  assignment,
  config,
  lookups,
  user,
  onCancel,
  onDone,
}: Props) {
  const view = config.views.find((v) => v.ava_name === assignment.ava_viewname);
  const fields = view
    ? config.viewFields
        .filter((f) => f._ava_viewid_value === view.ava_lddviewid)
        .sort((a, b) => (a.ava_sortorder ?? 0) - (b.ava_sortorder ?? 0))
    : [];

  // Seed the form from whatever is already stored on the case detail row.
  const [values, setValues] = useState<FormValues>(() => {
    const seed: FormValues = {};
    for (const f of fields) {
      const col = `ava_${f.ava_name.toLowerCase()}`;
      const existing = bundle.detail?.[col];
      if (existing !== undefined && existing !== null) seed[f.ava_name] = existing;
    }
    return seed;
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const missing = fields.filter(
    (f) => f.ava_required && (values[f.ava_name] === undefined || values[f.ava_name] === '')
  );

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const code = (bundle.record.ava_casetypecode ?? '') as CaseTypeCode;
      const { detail, workCase, skipped } = partitionValues(fields, values, code);
      const result = await submitAssignment(
        bundle.record,
        assignment.ava_lddassignmentid,
        assignment.ava_stepname ?? assignment.ava_name,
        detail,
        workCase,
        config,
        user
      );
      const note = skipped.length
        ? `${assignment.ava_name} submitted. Not stored (no mapped column): ${skipped.join(', ')}.`
        : `${assignment.ava_name} submitted.`;
      const advanced = result.actionsTaken.length
        ? ` ${result.actionsTaken.join('; ')}`
        : '';
      onDone(note + advanced);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="panel">
      <div className="task-head">
        <span className="avatar">{user.initials}</span>
        <div>
          <div className="task-title">{assignment.ava_stepname ?? assignment.ava_name}</div>
          <div className="task-sub">
            {assignment.ava_viewname ?? 'No view'} &nbsp;•&nbsp; {assignment.ava_assignmenttype}
            {assignment.ava_deadline ? ` • Due ${relativeTime(assignment.ava_deadline)}` : ''}
          </div>
        </div>
      </div>

      {error && <div className="banner-msg error">{error}</div>}
      {!view && assignment.ava_viewname && (
        <div className="banner-msg error">
          View "{assignment.ava_viewname}" is not present in the imported configuration.
        </div>
      )}

      <DynamicForm
        fields={fields}
        values={values}
        onChange={(k, v) => setValues((prev) => ({ ...prev, [k]: v }))}
        choiceSets={config.choiceSets}
        choiceValues={config.choiceValues}
        lookups={lookups}
        disabled={busy}
      />

      <div className="form-actions">
        <button className="btn btn-secondary" type="button" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <div className="spacer" />
        {missing.length > 0 && (
          <span className="muted" style={{ fontSize: 13 }}>
            Required: {missing.map((f) => f.ava_label ?? f.ava_name).join(', ')}
          </span>
        )}
        <button
          className="btn btn-primary"
          type="button"
          onClick={submit}
          disabled={busy || missing.length > 0}
        >
          {busy ? 'Submitting…' : 'Submit'}
        </button>
      </div>
    </div>
  );
}

