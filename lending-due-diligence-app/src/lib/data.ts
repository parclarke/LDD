/**
 * Data access for the LDD case management app.
 *
 * All Dataverse traffic goes through the generated Power Apps services. The
 * type-specific "detail" row for a case lives in one of five tables, so those
 * reads and writes are dispatched through a small registry rather than a
 * switch at every call site.
 */
import { Ava_lddcasetypesService } from '../generated/services/Ava_lddcasetypesService';
import { Ava_lddstagesService } from '../generated/services/Ava_lddstagesService';
import { Ava_lddstepsService } from '../generated/services/Ava_lddstepsService';
import { Ava_lddviewsService } from '../generated/services/Ava_lddviewsService';
import { Ava_lddviewfieldsService } from '../generated/services/Ava_lddviewfieldsService';
import { Ava_lddchoicesetsService } from '../generated/services/Ava_lddchoicesetsService';
import { Ava_lddchoicevaluesService } from '../generated/services/Ava_lddchoicevaluesService';
import { Ava_ldddecisionsService } from '../generated/services/Ava_ldddecisionsService';
import { Ava_ldddecisionrowsService } from '../generated/services/Ava_ldddecisionrowsService';
import { Ava_lddrolesService } from '../generated/services/Ava_lddrolesService';
import { Ava_lddflowbranchsService } from '../generated/services/Ava_lddflowbranchsService';
import { Ava_lddworkcasesService } from '../generated/services/Ava_lddworkcasesService';
import { Ava_lddassignmentsService } from '../generated/services/Ava_lddassignmentsService';
import { Ava_lddapprovalsService } from '../generated/services/Ava_lddapprovalsService';
import { Ava_lddcasehistoriesService } from '../generated/services/Ava_lddcasehistoriesService';
import { Ava_lddcustomersService } from '../generated/services/Ava_lddcustomersService';
import { Ava_lddcompliancefindingsService } from '../generated/services/Ava_lddcompliancefindingsService';
import { Ava_lddqualityreviewsService } from '../generated/services/Ava_lddqualityreviewsService';
import { Ava_lddriskprofilesService } from '../generated/services/Ava_lddriskprofilesService';
import { Ava_lddoversightcasesService } from '../generated/services/Ava_lddoversightcasesService';
import { Ava_lddresolutionsummariesService } from '../generated/services/Ava_lddresolutionsummariesService';
import { Ava_lddtransactionsService } from '../generated/services/Ava_lddtransactionsService';
import { Ava_lddlendingreviewsService } from '../generated/services/Ava_lddlendingreviewsService';
import { Ava_lddriskassessmentcasesService } from '../generated/services/Ava_lddriskassessmentcasesService';
import { Ava_lddcompliancecasesService } from '../generated/services/Ava_lddcompliancecasesService';
import { Ava_lddescalationcasesService } from '../generated/services/Ava_lddescalationcasesService';
import { Ava_lddqualityreccasesService } from '../generated/services/Ava_lddqualityreccasesService';

import type {
  CaseDetail,
  CaseTypeCode,
  LddApproval,
  LddAssignment,
  LddCaseHistory,
  LddComplianceFinding,
  LddCustomer,
  LddOversightCase,
  LddQualityReview,
  LddResolutionSummary,
  LddRiskProfile,
  LddTransaction,
  LddWorkCase,
  ProcessConfig,
} from './types';

interface OperationResult<T> {
  success: boolean;
  data: T;
  error?: unknown;
}

function unwrap<T>(result: OperationResult<T>, what: string): T {
  if (!result.success) {
    const message =
      (result.error as { message?: string } | undefined)?.message ?? 'Unknown Dataverse error';
    throw new Error(`${what} failed: ${message}`);
  }
  return result.data;
}

const PAGE = { top: 500 } as const;

/* -------------------------------------------------------------------------- *
 * Detail-table registry
 * -------------------------------------------------------------------------- */

/** Minimal shape shared by every generated Dataverse service we dispatch to. */
interface GenericService {
  getAll(options?: Record<string, unknown>): Promise<OperationResult<unknown[]>>;
  create(record: Record<string, unknown>): Promise<OperationResult<unknown>>;
  update(id: string, changes: Record<string, unknown>): Promise<OperationResult<unknown>>;
}

const DETAIL_REGISTRY: Record<CaseTypeCode, { service: GenericService; idField: string }> = {
  LendingReview: {
    service: Ava_lddlendingreviewsService as unknown as GenericService,
    idField: 'ava_lddlendingreviewid',
  },
  RiskAssessment: {
    service: Ava_lddriskassessmentcasesService as unknown as GenericService,
    idField: 'ava_lddriskassessmentcaseid',
  },
  ComplianceMonitoring: {
    service: Ava_lddcompliancecasesService as unknown as GenericService,
    idField: 'ava_lddcompliancecaseid',
  },
  EscalationManagement: {
    service: Ava_lddescalationcasesService as unknown as GenericService,
    idField: 'ava_lddescalationcaseid',
  },
  QualityRecommendation: {
    service: Ava_lddqualityreccasesService as unknown as GenericService,
    idField: 'ava_lddqualityreccaseid',
  },
};

export function detailIdField(code: CaseTypeCode): string {
  return DETAIL_REGISTRY[code]?.idField ?? '';
}

/* -------------------------------------------------------------------------- *
 * Process configuration
 * -------------------------------------------------------------------------- */

/**
 * Loads the whole process configuration in one pass. It is small (a few hundred
 * rows) and every screen needs some of it, so it is fetched once and cached.
 */
export async function loadProcessConfig(): Promise<ProcessConfig> {
  const [
    caseTypes,
    stages,
    steps,
    views,
    viewFields,
    choiceSets,
    choiceValues,
    decisions,
    decisionRows,
    roles,
    flowBranches,
  ] = await Promise.all([
    Ava_lddcasetypesService.getAll({ orderBy: ['ava_sortorder asc'], ...PAGE }),
    Ava_lddstagesService.getAll({ orderBy: ['ava_sortorder asc'], ...PAGE }),
    Ava_lddstepsService.getAll({ orderBy: ['ava_sortorder asc'], ...PAGE }),
    Ava_lddviewsService.getAll({ orderBy: ['ava_name asc'], ...PAGE }),
    Ava_lddviewfieldsService.getAll({ orderBy: ['ava_sortorder asc'], ...PAGE }),
    Ava_lddchoicesetsService.getAll({ orderBy: ['ava_name asc'], ...PAGE }),
    Ava_lddchoicevaluesService.getAll({ orderBy: ['ava_sortorder asc'], ...PAGE }),
    Ava_ldddecisionsService.getAll({ orderBy: ['ava_name asc'], ...PAGE }),
    Ava_ldddecisionrowsService.getAll({ orderBy: ['ava_sortorder asc'], ...PAGE }),
    Ava_lddrolesService.getAll({ orderBy: ['ava_name asc'], ...PAGE }),
    Ava_lddflowbranchsService.getAll({ orderBy: ['ava_sortorder asc'], ...PAGE }),
  ]);

  return {
    caseTypes: unwrap(caseTypes, 'Load case types') ?? [],
    stages: unwrap(stages, 'Load stages') ?? [],
    steps: unwrap(steps, 'Load steps') ?? [],
    views: unwrap(views, 'Load views') ?? [],
    viewFields: unwrap(viewFields, 'Load view fields') ?? [],
    choiceSets: unwrap(choiceSets, 'Load choice sets') ?? [],
    choiceValues: unwrap(choiceValues, 'Load choice values') ?? [],
    decisions: unwrap(decisions, 'Load decisions') ?? [],
    decisionRows: unwrap(decisionRows, 'Load decision rows') ?? [],
    roles: unwrap(roles, 'Load roles') ?? [],
    flowBranches: unwrap(flowBranches, 'Load flow branches') ?? [],
  };
}

/* -------------------------------------------------------------------------- *
 * Work cases
 * -------------------------------------------------------------------------- */

export async function listWorkCases(): Promise<LddWorkCase[]> {
  const res = await Ava_lddworkcasesService.getAll({ orderBy: ['createdon desc'], top: 250 });
  return unwrap(res, 'Load cases') ?? [];
}

export async function getWorkCase(id: string): Promise<LddWorkCase> {
  const res = await Ava_lddworkcasesService.get(id);
  return unwrap(res, 'Load case');
}

export async function createWorkCase(record: Record<string, unknown>): Promise<LddWorkCase> {
  const res = await Ava_lddworkcasesService.create(record as never);
  return unwrap(res, 'Create case');
}

export async function updateWorkCase(
  id: string,
  changes: Record<string, unknown>
): Promise<LddWorkCase> {
  const res = await Ava_lddworkcasesService.update(id, changes as never);
  return unwrap(res, 'Update case');
}

/* -------------------------------------------------------------------------- *
 * Case detail rows
 * -------------------------------------------------------------------------- */

export async function getCaseDetail(
  code: CaseTypeCode,
  workCaseId: string
): Promise<CaseDetail | null> {
  const reg = DETAIL_REGISTRY[code];
  if (!reg) return null;
  const res = await reg.service.getAll({
    filter: `_ava_workcaseid_value eq ${workCaseId}`,
    top: 1,
  });
  const rows = unwrap(res, 'Load case detail') ?? [];
  return (rows[0] as CaseDetail) ?? null;
}

export async function createCaseDetail(
  code: CaseTypeCode,
  record: Record<string, unknown>
): Promise<CaseDetail> {
  const res = await DETAIL_REGISTRY[code].service.create(record);
  return unwrap(res, 'Create case detail') as CaseDetail;
}

export async function updateCaseDetail(
  code: CaseTypeCode,
  id: string,
  changes: Record<string, unknown>
): Promise<void> {
  unwrap(await DETAIL_REGISTRY[code].service.update(id, changes), 'Update case detail');
}

/* -------------------------------------------------------------------------- *
 * Assignments, approvals, history
 * -------------------------------------------------------------------------- */

export async function listOpenAssignments(): Promise<LddAssignment[]> {
  const res = await Ava_lddassignmentsService.getAll({
    filter: `ava_status eq 'Pending'`,
    orderBy: ['ava_deadline asc'],
    top: 250,
  });
  return unwrap(res, 'Load assignments') ?? [];
}

export async function listAssignmentsForCase(workCaseId: string): Promise<LddAssignment[]> {
  const res = await Ava_lddassignmentsService.getAll({
    filter: `_ava_workcaseid_value eq ${workCaseId}`,
    orderBy: ['createdon asc'],
    top: 100,
  });
  return unwrap(res, 'Load case assignments') ?? [];
}

export async function createAssignment(record: Record<string, unknown>): Promise<LddAssignment> {
  const res = await Ava_lddassignmentsService.create(record as never);
  return unwrap(res, 'Create assignment');
}

export async function completeAssignment(id: string, completedBy: string): Promise<void> {
  await Ava_lddassignmentsService.update(id, {
    ava_status: 'Completed',
    ava_completedon: new Date().toISOString(),
    ava_completedby: completedBy,
  } as never);
}

export async function listApprovalsForCase(workCaseId: string): Promise<LddApproval[]> {
  const res = await Ava_lddapprovalsService.getAll({
    filter: `_ava_workcaseid_value eq ${workCaseId}`,
    orderBy: ['createdon asc'],
    top: 50,
  });
  return unwrap(res, 'Load approvals') ?? [];
}

export async function createApproval(record: Record<string, unknown>): Promise<LddApproval> {
  const res = await Ava_lddapprovalsService.create(record as never);
  return unwrap(res, 'Create approval');
}

export async function decideApproval(
  id: string,
  decision: 'Approved' | 'Rejected',
  approver: string,
  comments: string
): Promise<void> {
  await Ava_lddapprovalsService.update(id, {
    ava_decision: decision,
    ava_status: 'Completed',
    ava_approver: approver,
    ava_comments: comments,
    ava_decidedon: new Date().toISOString(),
  } as never);
}

export async function listHistoryForCase(workCaseId: string): Promise<LddCaseHistory[]> {
  const res = await Ava_lddcasehistoriesService.getAll({
    filter: `_ava_workcaseid_value eq ${workCaseId}`,
    orderBy: ['ava_eventdate desc'],
    top: 200,
  });
  return unwrap(res, 'Load history') ?? [];
}

export async function addHistory(record: Record<string, unknown>): Promise<void> {
  await Ava_lddcasehistoriesService.create(record as never);
}

/* -------------------------------------------------------------------------- *
 * Reference data used by lookup controls
 * -------------------------------------------------------------------------- */

export async function listCustomers(): Promise<LddCustomer[]> {
  const res = await Ava_lddcustomersService.getAll({ orderBy: ['ava_name asc'], ...PAGE });
  return unwrap(res, 'Load customers') ?? [];
}

export async function listTransactions(): Promise<LddTransaction[]> {
  const res = await Ava_lddtransactionsService.getAll({ orderBy: ['ava_name asc'], ...PAGE });
  return unwrap(res, 'Load transactions') ?? [];
}

export async function listComplianceFindings(): Promise<LddComplianceFinding[]> {
  const res = await Ava_lddcompliancefindingsService.getAll({ orderBy: ['ava_name asc'], ...PAGE });
  return unwrap(res, 'Load compliance findings') ?? [];
}

export async function listQualityReviews(): Promise<LddQualityReview[]> {
  const res = await Ava_lddqualityreviewsService.getAll({ orderBy: ['ava_name asc'], ...PAGE });
  return unwrap(res, 'Load quality reviews') ?? [];
}

export async function listRiskProfiles(): Promise<LddRiskProfile[]> {
  const res = await Ava_lddriskprofilesService.getAll({ orderBy: ['ava_name asc'], ...PAGE });
  return unwrap(res, 'Load risk profiles') ?? [];
}

export async function listOversightCases(): Promise<LddOversightCase[]> {
  const res = await Ava_lddoversightcasesService.getAll({ orderBy: ['ava_name asc'], ...PAGE });
  return unwrap(res, 'Load oversight cases') ?? [];
}

export async function listResolutionSummaries(): Promise<LddResolutionSummary[]> {
  const res = await Ava_lddresolutionsummariesService.getAll({ orderBy: ['ava_name asc'], ...PAGE });
  return unwrap(res, 'Load resolution summaries') ?? [];
}

export interface LookupOption {
  id: string;
  label: string;
}

/** Every lookup source the dynamic form renderer can bind to, keyed by data class. */
export type LookupSources = Record<string, LookupOption[]>;

export async function loadLookupSources(): Promise<LookupSources> {
  const [txns, customers, findings, reviews, profiles, oversight, summaries] = await Promise.all([
    listTransactions(),
    listCustomers(),
    listComplianceFindings(),
    listQualityReviews(),
    listRiskProfiles(),
    listOversightCases(),
    listResolutionSummaries(),
  ]);

  return {
    LendingTransaction: txns.map((t) => ({
      id: t.ava_lddtransactionid,
      label: `${t.ava_name}${t.ava_customername ? ` - ${t.ava_customername}` : ''}`,
    })),
    Customer: customers.map((c) => ({ id: c.ava_lddcustomerid, label: c.ava_name })),
    ComplianceFinding: findings.map((f) => ({ id: f.ava_lddcompliancefindingid, label: f.ava_name })),
    QualityReview: reviews.map((r) => ({ id: r.ava_lddqualityreviewid, label: r.ava_name })),
    RiskAssessment: profiles.map((p) => ({ id: p.ava_lddriskprofileid, label: p.ava_name })),
    OversightCase: oversight.map((o) => ({ id: o.ava_lddoversightcaseid, label: o.ava_name })),
    ResolutionSummary: summaries.map((s) => ({ id: s.ava_lddresolutionsummaryid, label: s.ava_name })),
  };
}
