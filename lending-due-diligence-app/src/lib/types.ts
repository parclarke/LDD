import type { Ava_lddcases } from '../generated/models/Ava_lddcasesModel';
import type { Ava_lddcasetasks } from '../generated/models/Ava_lddcasetasksModel';
import type { Ava_lddtransactions } from '../generated/models/Ava_lddtransactionsModel';
import type { Ava_lddratings } from '../generated/models/Ava_lddratingsModel';
import type { Ava_lddcaseerrors } from '../generated/models/Ava_lddcaseerrorsModel';
import type { Ava_ldderrors } from '../generated/models/Ava_ldderrorsModel';
import type { Ava_lddemployees } from '../generated/models/Ava_lddemployeesModel';
import type { Ava_lddrefdatas } from '../generated/models/Ava_lddrefdatasModel';
import type { Ava_lddreviewtemplates } from '../generated/models/Ava_lddreviewtemplatesModel';

export type LddCase = Ava_lddcases;
export type LddTask = Ava_lddcasetasks;
export type LddTransaction = Ava_lddtransactions;
export type LddRating = Ava_lddratings;
export type LddCaseError = Ava_lddcaseerrors;
export type LddError = Ava_ldderrors;
export type LddEmployee = Ava_lddemployees;
export type LddRefData = Ava_lddrefdatas;
export type LddReviewTemplate = Ava_lddreviewtemplates;

/** Business Control case lifecycle, mirroring the Pega stage chevrons. */
export const STAGES = ['Initialization', 'Triage', 'Review', 'Recommendation and action'] as const;
export type Stage = (typeof STAGES)[number];

/** Rating and Recommendation roles, mirroring the Pega tab strip. */
export const RATING_ROLES = [
  'Lender',
  'Overrider',
  'UW-CA',
  'IVO',
  'RCS',
  'Other 1',
  'Other 2',
  'Other 3',
] as const;
export type RatingRole = (typeof RATING_ROLES)[number];

export const TASK_KEYS = {
  collectCaseParameter: 'CollectCaseParameter',
  triageDecision: 'TriageDecision',
  reviewCaseDetails: 'ReviewCaseDetails',
  provideResponseEscalation: 'ProvideResponseForEscalation',
  provideResponseCoaching: 'ProvideResponseForCoaching',
} as const;

export type Route =
  | { name: 'worklist' }
  | { name: 'cases' }
  | { name: 'newCaseTransaction' }
  | { name: 'newCaseParameters'; transactionId: string }
  | { name: 'case'; caseId: string; openTaskId?: string };

export interface CurrentUser {
  operatorId: string;
  displayName: string;
  initials: string;
  role: 'BusinessControl' | 'FrontlineManager';
}
