import type { LddAssignment, LddCaseType, LddStage, LddStep, LddWorkCase } from './types';

/** Everything the shell loads once and hands down to the screens. */
export interface AppData {
  caseTypes: LddCaseType[];
  stages: LddStage[];
  steps: LddStep[];
  cases: LddWorkCase[];
  assignments: LddAssignment[];
}

export const EMPTY_APP_DATA: AppData = {
  caseTypes: [],
  stages: [],
  steps: [],
  cases: [],
  assignments: [],
};

/** True when a case has not yet reached a resolved status. */
export function isOpen(c: LddWorkCase): boolean {
  return !(c.ava_status ?? '').toLowerCase().startsWith('resolved');
}

export function caseTypeName(data: AppData, code?: string | null): string {
  if (!code) return '—';
  return data.caseTypes.find((t) => t.ava_code === code)?.ava_name ?? code;
}

/** Stages belonging to one case type, in Pega sort order. */
export function stagesFor(data: AppData, caseTypeId?: string): LddStage[] {
  if (!caseTypeId) return [];
  return data.stages
    .filter((s) => s._ava_casetypeid_value === caseTypeId)
    .slice()
    .sort((a, b) => (a.ava_sortorder ?? 0) - (b.ava_sortorder ?? 0));
}

/** Steps belonging to one stage, in Pega sort order. */
export function stepsFor(data: AppData, stageId: string): LddStep[] {
  return data.steps
    .filter((s) => s._ava_stageid_value === stageId)
    .slice()
    .sort((a, b) => (a.ava_sortorder ?? 0) - (b.ava_sortorder ?? 0));
}

export function openAssignmentFor(data: AppData, caseId: string): LddAssignment | undefined {
  return data.assignments.find((a) => a._ava_workcaseid_value === caseId);
}
