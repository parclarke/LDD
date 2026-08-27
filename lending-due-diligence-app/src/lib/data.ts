/**
 * Data access for the Lending Due Diligence app.
 * All Dataverse traffic goes through the generated Power Apps services.
 */
import { Ava_lddcasesService } from '../generated/services/Ava_lddcasesService';
import { Ava_lddcasetasksService } from '../generated/services/Ava_lddcasetasksService';
import { Ava_lddtransactionsService } from '../generated/services/Ava_lddtransactionsService';
import { Ava_lddratingsService } from '../generated/services/Ava_lddratingsService';
import { Ava_lddcaseerrorsService } from '../generated/services/Ava_lddcaseerrorsService';
import { Ava_ldderrorsService } from '../generated/services/Ava_ldderrorsService';
import { Ava_lddemployeesService } from '../generated/services/Ava_lddemployeesService';
import { Ava_lddrefdatasService } from '../generated/services/Ava_lddrefdatasService';
import { Ava_lddreviewtemplatesService } from '../generated/services/Ava_lddreviewtemplatesService';

import type { Ava_lddcasesBase } from '../generated/models/Ava_lddcasesModel';
import type { Ava_lddcasetasksBase } from '../generated/models/Ava_lddcasetasksModel';
import type { Ava_lddratingsBase } from '../generated/models/Ava_lddratingsModel';
import type { Ava_lddcaseerrorsBase } from '../generated/models/Ava_lddcaseerrorsModel';

import type {
  LddCase,
  LddCaseError,
  LddEmployee,
  LddError,
  LddRating,
  LddRefData,
  LddReviewTemplate,
  LddTask,
  LddTransaction,
} from './types';

function unwrap<T>(result: { success: boolean; data: T; error?: unknown }, what: string): T {
  if (!result.success) {
    const message =
      (result.error as { message?: string } | undefined)?.message ?? 'Unknown Dataverse error';
    throw new Error(`${what} failed: ${message}`);
  }
  return result.data;
}

const escape = (value: string) => value.replace(/'/g, "''");

/* ------------------------------ Reference data ------------------------------ */

export async function listRefData(): Promise<LddRefData[]> {
  const res = await Ava_lddrefdatasService.getAll({
    orderBy: ['ava_reftype asc', 'ava_sortorder asc'],
    top: 500,
  });
  return unwrap(res, 'Load reference data') ?? [];
}

export function refValues(refData: LddRefData[], refType: string): string[] {
  return refData.filter((r) => r.ava_reftype === refType).map((r) => r.ava_name);
}

export async function listEmployees(): Promise<LddEmployee[]> {
  const res = await Ava_lddemployeesService.getAll({ orderBy: ['ava_name asc'], top: 500 });
  return unwrap(res, 'Load employees') ?? [];
}

export async function listReviewTemplates(): Promise<LddReviewTemplate[]> {
  const res = await Ava_lddreviewtemplatesService.getAll({ orderBy: ['ava_name asc'], top: 200 });
  return unwrap(res, 'Load review templates') ?? [];
}

export async function listErrors(): Promise<LddError[]> {
  const res = await Ava_ldderrorsService.getAll({ orderBy: ['ava_name asc'], top: 500 });
  return unwrap(res, 'Load error catalogue') ?? [];
}

/* ------------------------------- Transactions ------------------------------- */

export interface TransactionFilter {
  applicationDateFrom?: string;
  applicationDateTo?: string;
  fundedDateFrom?: string;
  fundedDateTo?: string;
}

export async function searchTransactions(filter: TransactionFilter): Promise<LddTransaction[]> {
  const clauses: string[] = [];
  if (filter.applicationDateFrom) clauses.push(`ava_applicationdate ge ${filter.applicationDateFrom}`);
  if (filter.applicationDateTo) clauses.push(`ava_applicationdate le ${filter.applicationDateTo}`);
  if (filter.fundedDateFrom) clauses.push(`ava_fundeddate ge ${filter.fundedDateFrom}`);
  if (filter.fundedDateTo) clauses.push(`ava_fundeddate le ${filter.fundedDateTo}`);

  const res = await Ava_lddtransactionsService.getAll({
    filter: clauses.length ? clauses.join(' and ') : undefined,
    orderBy: ['ava_applicationdate desc'],
    top: 200,
  });
  return unwrap(res, 'Search transactions') ?? [];
}

export async function getTransaction(id: string): Promise<LddTransaction> {
  const res = await Ava_lddtransactionsService.get(id);
  return unwrap(res, 'Load transaction');
}

/* ----------------------------------- Cases ---------------------------------- */

export async function listCases(): Promise<LddCase[]> {
  const res = await Ava_lddcasesService.getAll({ orderBy: ['createdon desc'], top: 200 });
  return unwrap(res, 'Load cases') ?? [];
}

export async function getCase(id: string): Promise<LddCase> {
  const res = await Ava_lddcasesService.get(id);
  return unwrap(res, 'Load case');
}

export async function createCase(record: Omit<Ava_lddcasesBase, 'ava_lddcaseid'>): Promise<LddCase> {
  const res = await Ava_lddcasesService.create(record);
  return unwrap(res, 'Create case');
}

export async function updateCase(
  id: string,
  changes: Partial<Omit<Ava_lddcasesBase, 'ava_lddcaseid'>>
): Promise<LddCase> {
  const res = await Ava_lddcasesService.update(id, changes);
  return unwrap(res, 'Update case');
}

/* ----------------------------------- Tasks ---------------------------------- */

export async function listAllTasks(): Promise<LddTask[]> {
  const res = await Ava_lddcasetasksService.getAll({
    orderBy: ['ava_deadline asc'],
    top: 300,
  });
  return unwrap(res, 'Load tasks') ?? [];
}

export async function listPendingTasks(): Promise<LddTask[]> {
  const res = await Ava_lddcasetasksService.getAll({
    filter: `ava_status eq 'Pending'`,
    orderBy: ['ava_deadline asc'],
    top: 300,
  });
  return unwrap(res, 'Load pending tasks') ?? [];
}

export async function listTasksForCase(caseId: string): Promise<LddTask[]> {
  const res = await Ava_lddcasetasksService.getAll({
    filter: `_ava_caseid_value eq ${caseId}`,
    orderBy: ['createdon asc'],
    top: 100,
  });
  return unwrap(res, 'Load case tasks') ?? [];
}

export async function createTask(
  record: Omit<Ava_lddcasetasksBase, 'ava_lddcasetaskid'>
): Promise<LddTask> {
  const res = await Ava_lddcasetasksService.create(record);
  return unwrap(res, 'Create task');
}

export async function completeTask(id: string): Promise<void> {
  await Ava_lddcasetasksService.update(id, { ava_status: 'Completed' });
}

/* ---------------------------- Rating & recommendation ---------------------------- */

export async function listRatingsForCase(caseId: string): Promise<LddRating[]> {
  const res = await Ava_lddratingsService.getAll({
    filter: `_ava_caseid_value eq ${caseId}`,
    orderBy: ['ava_sortorder asc'],
    top: 50,
  });
  return unwrap(res, 'Load ratings') ?? [];
}

export async function createRating(
  record: Omit<Ava_lddratingsBase, 'ava_lddratingid'>
): Promise<LddRating> {
  const res = await Ava_lddratingsService.create(record);
  return unwrap(res, 'Create rating');
}

export async function updateRating(
  id: string,
  changes: Partial<Omit<Ava_lddratingsBase, 'ava_lddratingid'>>
): Promise<LddRating> {
  const res = await Ava_lddratingsService.update(id, changes);
  return unwrap(res, 'Update rating');
}

/* --------------------------------- Case errors -------------------------------- */

export async function listCaseErrors(ratingIds: string[]): Promise<LddCaseError[]> {
  if (!ratingIds.length) return [];
  const filter = ratingIds.map((id) => `_ava_ratingid_value eq ${id}`).join(' or ');
  const res = await Ava_lddcaseerrorsService.getAll({ filter, top: 200 });
  return unwrap(res, 'Load case errors') ?? [];
}

export async function addCaseError(
  ratingId: string,
  error: LddError,
  isPrimary: boolean
): Promise<LddCaseError> {
  const record: Omit<Ava_lddcaseerrorsBase, 'ava_lddcaseerrorid'> = {
    ava_name: error.ava_name,
    ava_namefr: error.ava_namefr,
    ava_isprimary: isPrimary,
    'ava_RatingId@odata.bind': `/ava_lddratings(${ratingId})`,
    'ava_ErrorId@odata.bind': `/ava_ldderrors(${error.ava_ldderrorid})`,
    statecode: 0,
  };
  const res = await Ava_lddcaseerrorsService.create(record);
  return unwrap(res, 'Add error');
}

export async function setPrimaryError(id: string, isPrimary: boolean): Promise<void> {
  await Ava_lddcaseerrorsService.update(id, { ava_isprimary: isPrimary });
}

export async function removeCaseError(id: string): Promise<void> {
  await Ava_lddcaseerrorsService.delete(id);
}

export { escape as escapeODataString };
