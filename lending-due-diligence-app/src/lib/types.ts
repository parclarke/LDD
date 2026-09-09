/**
 * Domain types for the LDD case management app.
 *
 * The `Ldd*` aliases point at the Power Apps generated Dataverse models so the rest
 * of the app depends on readable names rather than the generated `Ava_*` spelling.
 */
import type { Ava_lddcasetypes } from '../generated/models/Ava_lddcasetypesModel';
import type { Ava_lddstages } from '../generated/models/Ava_lddstagesModel';
import type { Ava_lddsteps } from '../generated/models/Ava_lddstepsModel';
import type { Ava_lddviews } from '../generated/models/Ava_lddviewsModel';
import type { Ava_lddviewfields } from '../generated/models/Ava_lddviewfieldsModel';
import type { Ava_lddchoicesets } from '../generated/models/Ava_lddchoicesetsModel';
import type { Ava_lddchoicevalues } from '../generated/models/Ava_lddchoicevaluesModel';
import type { Ava_ldddecisions } from '../generated/models/Ava_ldddecisionsModel';
import type { Ava_ldddecisionrows } from '../generated/models/Ava_ldddecisionrowsModel';
import type { Ava_lddroles } from '../generated/models/Ava_lddrolesModel';
import type { Ava_lddflowbranchs } from '../generated/models/Ava_lddflowbranchsModel';
import type { Ava_lddnotifications } from '../generated/models/Ava_lddnotificationsModel';
import type { Ava_lddworkcases } from '../generated/models/Ava_lddworkcasesModel';
import type { Ava_lddassignments } from '../generated/models/Ava_lddassignmentsModel';
import type { Ava_lddapprovals } from '../generated/models/Ava_lddapprovalsModel';
import type { Ava_lddcasehistories } from '../generated/models/Ava_lddcasehistoriesModel';
import type { Ava_lddcustomers } from '../generated/models/Ava_lddcustomersModel';
import type { Ava_lddcompliancefindings } from '../generated/models/Ava_lddcompliancefindingsModel';
import type { Ava_lddqualityreviews } from '../generated/models/Ava_lddqualityreviewsModel';
import type { Ava_lddriskprofiles } from '../generated/models/Ava_lddriskprofilesModel';
import type { Ava_lddoversightcases } from '../generated/models/Ava_lddoversightcasesModel';
import type { Ava_lddresolutionsummaries } from '../generated/models/Ava_lddresolutionsummariesModel';
import type { Ava_lddtransactions } from '../generated/models/Ava_lddtransactionsModel';

export type LddCaseType = Ava_lddcasetypes;
export type LddStage = Ava_lddstages;
export type LddStep = Ava_lddsteps;
export type LddView = Ava_lddviews;
export type LddViewField = Ava_lddviewfields;
export type LddChoiceSet = Ava_lddchoicesets;
export type LddChoiceValue = Ava_lddchoicevalues;
export type LddDecision = Ava_ldddecisions;
export type LddDecisionRow = Ava_ldddecisionrows;
export type LddRole = Ava_lddroles;
export type LddFlowBranch = Ava_lddflowbranchs;
export type LddNotification = Ava_lddnotifications;
export type LddWorkCase = Ava_lddworkcases;
export type LddAssignment = Ava_lddassignments;
export type LddApproval = Ava_lddapprovals;
export type LddCaseHistory = Ava_lddcasehistories;
export type LddCustomer = Ava_lddcustomers;
export type LddComplianceFinding = Ava_lddcompliancefindings;
export type LddQualityReview = Ava_lddqualityreviews;
export type LddRiskProfile = Ava_lddriskprofiles;
export type LddOversightCase = Ava_lddoversightcases;
export type LddResolutionSummary = Ava_lddresolutionsummaries;
export type LddTransaction = Ava_lddtransactions;

/** The five case types exported from the Pega prototype. */
export const CASE_TYPE_CODES = [
  'LendingReview',
  'RiskAssessment',
  'ComplianceMonitoring',
  'EscalationManagement',
  'QualityRecommendation',
] as const;
export type CaseTypeCode = (typeof CASE_TYPE_CODES)[number];

/** Dataverse entity set holding the type-specific fields for each case type. */
export const DETAIL_SET: Record<CaseTypeCode, string> = {
  LendingReview: 'ava_lddlendingreviews',
  RiskAssessment: 'ava_lddriskassessmentcases',
  ComplianceMonitoring: 'ava_lddcompliancecases',
  EscalationManagement: 'ava_lddescalationcases',
  QualityRecommendation: 'ava_lddqualityreccases',
};

/** Control types a view field can render as. */
export type ControlType =
  | 'text'
  | 'multiline'
  | 'choice'
  | 'date'
  | 'datetime'
  | 'boolean'
  | 'email'
  | 'attachment'
  | 'lookup'
  | 'user'
  | 'currency'
  | 'decimal'
  | 'integer'
  | 'percent'
  | 'phone'
  | 'url';

/** A case detail row is loosely typed: its shape depends on the case type. */
export type CaseDetail = Record<string, unknown> & { ava_name?: string };

/** Everything the UI needs to render and drive one case. */
export interface CaseBundle {
  record: LddWorkCase;
  caseType: LddCaseType | undefined;
  stages: LddStage[];
  steps: LddStep[];
  detail: CaseDetail | null;
  detailSet: string;
  assignments: LddAssignment[];
  approvals: LddApproval[];
  history: LddCaseHistory[];
  /** Outbox rows raised by this case, newest first. */
  notifications: LddNotification[];
}

/** Process configuration loaded once and shared across screens. */
export interface ProcessConfig {
  caseTypes: LddCaseType[];
  stages: LddStage[];
  steps: LddStep[];
  views: LddView[];
  viewFields: LddViewField[];
  choiceSets: LddChoiceSet[];
  choiceValues: LddChoiceValue[];
  decisions: LddDecision[];
  decisionRows: LddDecisionRow[];
  roles: LddRole[];
  /** Decision branch routing extracted from the Pega flow rule bodies. */
  flowBranches: LddFlowBranch[];
}

export type Route =
  | { name: 'worklist' }
  | { name: 'cases' }
  | { name: 'newCase' }
  | { name: 'case'; caseId: string; openAssignmentId?: string }
  | { name: 'insights' }
  | { name: 'records' }
  | { name: 'config' };

export interface CurrentUser {
  operatorId: string;
  displayName: string;
  initials: string;
  role: string;
  workbaskets: string[];
}
