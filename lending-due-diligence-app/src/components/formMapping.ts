/**
 * Maps submitted form values onto Dataverse columns.
 *
 * Kept separate from the form component so the mapping can be unit tested and so
 * the component file only exports components (React Fast Refresh requirement).
 */
import { DETAIL_COLUMNS, WORK_CASE_COLUMNS } from '../lib/detail-columns';
import type { LddViewField } from '../lib/types';
import type { FormValues } from './DynamicForm';

/**
 * Splits submitted form values into the case-level and detail-level writes.
 * Lookup fields become `@odata.bind` references on whichever table owns them.
 *
 * Prototype fields with no matching Dataverse column (Pega platform properties
 * such as `pyNote`) are reported as `skipped` rather than failing the save.
 */
export function partitionValues(
  fields: LddViewField[],
  values: FormValues,
  caseTypeCode: string
): {
  detail: Record<string, unknown>;
  workCase: Record<string, unknown>;
  skipped: string[];
} {
  const detail: Record<string, unknown> = {};
  const workCase: Record<string, unknown> = {};
  const skipped: string[] = [];
  const detailColumns = DETAIL_COLUMNS[caseTypeCode] ?? new Set<string>();

  for (const f of fields) {
    const raw = values[f.ava_name];
    if (raw === undefined) continue;

    if (f.ava_control === 'lookup') {
      const target = LOOKUP_BINDING[f.ava_lookuptable ?? ''];
      if (!target) {
        skipped.push(f.ava_name);
        continue;
      }
      const column = DETAIL_LOOKUP_COLUMN[f.ava_name] ?? target.column;
      const bindValue = raw ? `/${target.set}(${raw})` : null;
      if (target.on === 'case') workCase[`${target.column}@odata.bind`] = bindValue;
      else detail[`${column}@odata.bind`] = bindValue;
      continue;
    }

    const column = `ava_${f.ava_name.toLowerCase()}`;
    if (detailColumns.has(column)) {
      detail[column] = normalise(raw, f.ava_control ?? 'text');
    } else if (WORK_CASE_COLUMNS.has(column)) {
      workCase[column] = normalise(raw, f.ava_control ?? 'text');
    } else {
      skipped.push(f.ava_name);
    }
  }

  return { detail, workCase, skipped };
}

/** Where each lookup lands: the shared case envelope or the type-specific detail row. */
const LOOKUP_BINDING: Record<string, { set: string; column: string; on: 'case' | 'detail' }> = {
  LendingTransaction: { set: 'ava_lddtransactions', column: 'ava_TransactionId', on: 'case' },
  Customer: { set: 'ava_lddcustomers', column: 'ava_CustomerId', on: 'case' },
  ComplianceFinding: {
    set: 'ava_lddcompliancefindings',
    column: 'ava_ComplianceFindingId',
    on: 'detail',
  },
  QualityReview: { set: 'ava_lddqualityreviews', column: 'ava_QualityReviewId', on: 'detail' },
  RiskAssessment: { set: 'ava_lddriskprofiles', column: 'ava_RiskProfileId', on: 'detail' },
  OversightCase: { set: 'ava_lddoversightcases', column: 'ava_OversightCaseId', on: 'detail' },
  ResolutionSummary: {
    set: 'ava_lddresolutionsummaries',
    column: 'ava_ResolutionSummaryId',
    on: 'detail',
  },
};

/** Prototype field names that map onto a differently named detail lookup column. */
const DETAIL_LOOKUP_COLUMN: Record<string, string> = {
  LinkedRiskAssessment: 'ava_RiskProfileId',
  DocumentedComplianceFinding: 'ava_ComplianceFindingId',
};

function normalise(value: unknown, control: string): unknown {
  if (value === '' ) return null;
  if (control === 'boolean') return Boolean(value);
  if (control === 'datetime' && value) return new Date(String(value)).toISOString();
  return value;
}


