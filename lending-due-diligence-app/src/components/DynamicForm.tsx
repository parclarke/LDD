import type { ChangeEvent } from 'react';
import type { LookupSources } from '../lib/data';
import type { LddChoiceSet, LddChoiceValue, LddViewField } from '../lib/types';

export type FormValues = Record<string, unknown>;

interface Props {
  fields: LddViewField[];
  values: FormValues;
  onChange: (field: string, value: unknown) => void;
  choiceSets: LddChoiceSet[];
  choiceValues: LddChoiceValue[];
  lookups: LookupSources;
  disabled?: boolean;
}

/**
 * Renders a form from view metadata rather than hard-coded markup.
 *
 * Every assignment screen in the app is produced by this component: the fields,
 * their control types, choice lists and lookups all come from Dataverse
 * configuration rows imported from the Pega prototype. Adding a field to a
 * screen is a configuration change, not a code change.
 */
export function DynamicForm({
  fields,
  values,
  onChange,
  choiceSets,
  choiceValues,
  lookups,
  disabled,
}: Props) {
  if (!fields.length) {
    return (
      <p className="muted">
        This step has no form fields configured. Submitting will complete the step and let the
        case continue.
      </p>
    );
  }

  const regions = [...new Set(fields.map((f) => f.ava_region || 'Fields'))];

  return (
    <>
      {regions.map((region) => (
        <div key={region}>
          {regions.length > 1 && <div className="region-title">{region}</div>}
          <div className="field-grid">
            {fields
              .filter((f) => (f.ava_region || 'Fields') === region)
              .map((f) => (
                <Field
                  key={f.ava_lddviewfieldid}
                  field={f}
                  value={values[f.ava_name]}
                  onChange={onChange}
                  choiceSets={choiceSets}
                  choiceValues={choiceValues}
                  lookups={lookups}
                  disabled={disabled}
                />
              ))}
          </div>
        </div>
      ))}
    </>
  );
}

interface FieldProps {
  field: LddViewField;
  value: unknown;
  onChange: (field: string, value: unknown) => void;
  choiceSets: LddChoiceSet[];
  choiceValues: LddChoiceValue[];
  lookups: LookupSources;
  disabled?: boolean;
}

function Field({ field, value, onChange, choiceSets, choiceValues, lookups, disabled }: FieldProps) {
  const id = `fld-${field.ava_lddviewfieldid}`;
  const label = field.ava_label || field.ava_name;
  const required = Boolean(field.ava_required);
  const readOnly = Boolean(field.ava_readonly) || disabled;
  const control = field.ava_control ?? 'text';

  const set = (v: unknown) => onChange(field.ava_name, v);
  const onInput = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    set(e.target.value);

  const wide = control === 'multiline' || control === 'attachment';

  return (
    <div className={`field${wide ? ' span-2' : ''}`}>
      <label className={required ? 'req' : undefined} htmlFor={id}>
        {label}
      </label>

      {control === 'choice' && (
        <select id={id} value={String(value ?? '')} onChange={onInput} disabled={readOnly}>
          <option value="">Select...</option>
          {choicesFor(field, choiceSets, choiceValues).map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      )}

      {control === 'lookup' && (
        <select id={id} value={String(value ?? '')} onChange={onInput} disabled={readOnly}>
          <option value="">Select...</option>
          {(lookups[field.ava_lookuptable ?? ''] ?? []).map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      )}

      {control === 'multiline' && (
        <textarea id={id} value={String(value ?? '')} onChange={onInput} readOnly={readOnly} />
      )}

      {control === 'boolean' && (
        <label className="checkbox-row">
          <input
            id={id}
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => set(e.target.checked)}
            disabled={readOnly}
          />
          <span>Yes</span>
        </label>
      )}

      {control === 'attachment' && (
        <div className="attachment-box">
          <input
            id={id}
            type="text"
            placeholder="Document reference or URL"
            value={String(value ?? '')}
            onChange={onInput}
            readOnly={readOnly}
          />
          <span className="hint">
            File upload requires a document store; see the developer handover notes.
          </span>
        </div>
      )}

      {(control === 'date' || control === 'datetime') && (
        <input
          id={id}
          type={control === 'date' ? 'date' : 'datetime-local'}
          value={toInputDate(value, control)}
          onChange={onInput}
          readOnly={readOnly}
        />
      )}

      {(control === 'integer' || control === 'decimal' || control === 'currency' || control === 'percent') && (
        <input
          id={id}
          type="number"
          step={control === 'integer' ? 1 : 'any'}
          value={String(value ?? '')}
          onChange={(e) => set(e.target.value === '' ? null : Number(e.target.value))}
          readOnly={readOnly}
        />
      )}

      {(control === 'text' || control === 'user' || control === 'email' || control === 'phone' || control === 'url') && (
        <input
          id={id}
          type={control === 'email' ? 'email' : control === 'url' ? 'url' : 'text'}
          value={String(value ?? '')}
          onChange={onInput}
          readOnly={readOnly}
          placeholder={control === 'user' ? 'Operator name' : undefined}
        />
      )}
    </div>
  );
}

function choicesFor(
  field: LddViewField,
  choiceSets: LddChoiceSet[],
  choiceValues: LddChoiceValue[]
): string[] {
  // Prefer the explicitly configured choice set; otherwise fall back to a set whose
  // name matches the field name, which is how the Pega export names most of them.
  const setName = field.ava_choiceset || field.ava_name;
  const cs = choiceSets.find((c) => c.ava_name === setName);
  if (!cs) return [];
  return choiceValues
    .filter((v) => v._ava_choicesetid_value === cs.ava_lddchoicesetid)
    .sort((a, b) => (a.ava_sortorder ?? 0) - (b.ava_sortorder ?? 0))
    .map((v) => v.ava_name);
}

function toInputDate(value: unknown, control: string): string {
  if (!value) return '';
  const s = String(value);
  if (control === 'date') return s.slice(0, 10);
  // datetime-local wants YYYY-MM-DDTHH:mm
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Splits submitted form values into the case-level and detail-level writes.
 * Lookup fields become `@odata.bind` references on whichever table owns them.
 *
 * Prototype fields with no matching Dataverse column (Pega platform properties
 * such as `pyNote`) are reported as `skipped` rather than failing the save.
 */

