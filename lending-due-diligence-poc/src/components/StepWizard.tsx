import { useMemo, useState } from 'react';
import type { CurrentUser, LddAssignment, LddWorkCase, ProcessConfig } from '../lib/types';
import { submitAssignment } from '../lib/orchestrator';

interface StepWizardProps {
  config: ProcessConfig;
  record: LddWorkCase;
  assignment: LddAssignment;
  user: CurrentUser;
  onClose: () => void;
  onSubmitted: (message: string) => void;
}

/**
 * Assignment step form, rendered from the harvested Pega view definition. Fields,
 * labels, required flags and choice lists all come from Dataverse configuration
 * rather than being hand-coded per step.
 */
export function StepWizard({ config, record, assignment, user, onClose, onSubmitted }: StepWizardProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fields = useMemo(() => {
    const view = config.views.find(
      (v) => v.ava_name === assignment.ava_viewname && v.ava_casetypecode === record.ava_casetypecode,
    );
    if (!view) return [];
    return config.viewFields
      .filter((f) => f._ava_viewid_value === view.ava_lddviewid)
      .slice()
      .sort((a, b) => (a.ava_sortorder ?? 0) - (b.ava_sortorder ?? 0));
  }, [config, assignment.ava_viewname, record.ava_casetypecode]);

  const choicesFor = (setName?: string) => {
    if (!setName) return [];
    const set = config.choiceSets.find((s) => s.ava_name === setName);
    if (!set) return [];
    return config.choiceValues
      .filter((v) => v._ava_choicesetid_value === set.ava_lddchoicesetid)
      .slice()
      .sort((a, b) => (a.ava_sortorder ?? 0) - (b.ava_sortorder ?? 0));
  };

  const missing = fields.filter((f) => f.ava_required && !values[f.ava_name]);

  async function submit() {
    if (missing.length > 0) {
      setError(`Complete the required field${missing.length > 1 ? 's' : ''}: ${missing
        .map((f) => f.ava_label ?? f.ava_name)
        .join(', ')}`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const detailChanges: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(values)) {
        if (v !== '') detailChanges[k] = v;
      }
      await submitAssignment(
        record,
        assignment.ava_lddassignmentid,
        assignment.ava_stepname ?? assignment.ava_name,
        detailChanges,
        {},
        config,
        user,
      );
      onSubmitted(`${assignment.ava_name} submitted`);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <div className="backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pmodal">
        <div className="pmodal-hd">
          <div className="pmodal-title">
            <b>{assignment.ava_name}</b>
          </div>
          <button className="ic first" onClick={onClose} title="Close" type="button">
            ✕
          </button>
        </div>
        <div className="pmodal-body">
          <div className="prog-label">{record.ava_stagename ?? 'Case step'}</div>
          {fields.length === 0 ? (
            <p className="muted">
              This step has no captured form. Submitting advances the case to the next step in the
              lifecycle.
            </p>
          ) : (
            <div className="grid c2">
              {fields.map((f) => {
                const control = (f.ava_control ?? 'text').toLowerCase();
                const label = f.ava_label ?? f.ava_name;
                const choices = choicesFor(f.ava_choiceset);
                const set = (v: string) => setValues((prev) => ({ ...prev, [f.ava_name]: v }));
                const value = values[f.ava_name] ?? '';
                const full = control === 'multiline' || control === 'attachment';
                return (
                  <div className={`field ${full ? 'full' : ''}`.trim()} key={f.ava_lddviewfieldid}>
                    <label htmlFor={f.ava_lddviewfieldid}>
                      {label}
                      {f.ava_required ? <span className="req">*</span> : null}
                    </label>
                    {control === 'multiline' ? (
                      <textarea
                        id={f.ava_lddviewfieldid}
                        rows={3}
                        value={value}
                        disabled={f.ava_readonly}
                        onChange={(e) => set(e.target.value)}
                      />
                    ) : choices.length > 0 ? (
                      <select
                        id={f.ava_lddviewfieldid}
                        value={value}
                        disabled={f.ava_readonly}
                        onChange={(e) => set(e.target.value)}
                      >
                        <option value="">Select…</option>
                        {choices.map((c) => (
                          <option key={c.ava_lddchoicevalueid} value={c.ava_name}>
                            {c.ava_name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id={f.ava_lddviewfieldid}
                        type={
                          control === 'date'
                            ? 'date'
                            : control === 'datetime'
                              ? 'datetime-local'
                              : control === 'integer' || control === 'decimal' || control === 'currency'
                                ? 'number'
                                : 'text'
                        }
                        value={value}
                        disabled={f.ava_readonly}
                        onChange={(e) => set(e.target.value)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {error ? (
            <div className="note" style={{ borderLeftColor: '#a4262c', background: '#fde6e6' }}>
              {error}
            </div>
          ) : null}
        </div>
        <div className="pmodal-ft">
          <button className="btn o" onClick={onClose} type="button">
            Cancel
          </button>
          <div className="right">
            <button className="btn" onClick={submit} disabled={busy} type="button">
              {busy ? 'Submitting…' : 'Submit'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
