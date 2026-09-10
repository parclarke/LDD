/**
 * Registry for the Records Manager screen.
 *
 * Pega's Records Manager browses the application's *data* objects (as opposed
 * to its case types). The LDD model declares ten of them and each one is backed
 * by its own Dataverse table, so the screen is driven by this table rather than
 * a switch at every call site. Tab order follows the original Pega portal.
 */
import { Ava_lddtransactionsService } from '../generated/services/Ava_lddtransactionsService';
import { Ava_lddcustomersService } from '../generated/services/Ava_lddcustomersService';
import { Ava_lddqualityreviewsService } from '../generated/services/Ava_lddqualityreviewsService';
import { Ava_lddriskprofilesService } from '../generated/services/Ava_lddriskprofilesService';
import { Ava_lddoversightcasesService } from '../generated/services/Ava_lddoversightcasesService';
import { Ava_lddcompliancefindingsService } from '../generated/services/Ava_lddcompliancefindingsService';
import { Ava_lddrecommendationitemsService } from '../generated/services/Ava_lddrecommendationitemsService';
import { Ava_lddescalationlogsService } from '../generated/services/Ava_lddescalationlogsService';
import { Ava_lddresolutionsummariesService } from '../generated/services/Ava_lddresolutionsummariesService';
import { Ava_lddroleassignmentsService } from '../generated/services/Ava_lddroleassignmentsService';

export type RecordCellKind = 'text' | 'number' | 'money' | 'date' | 'chip';

export interface RecordColumn {
  /** Dataverse logical name of the column. */
  field: string;
  label: string;
  kind?: RecordCellKind;
}

export interface RecordSource {
  /** Data-object short name from the Pega model, e.g. `LendingTransaction`. */
  key: string;
  label: string;
  /** Pega class the data object maps to; shown on the record detail panel. */
  pegaClass: string;
  idField: string;
  columns: RecordColumn[];
  load: () => Promise<Record<string, unknown>[]>;
}

interface OperationResult<T> {
  success: boolean;
  data: T;
  error?: unknown;
}

interface GenericService {
  getAll(options?: Record<string, unknown>): Promise<OperationResult<unknown[]>>;
}

/** Wraps a generated service so every source loads and errors the same way. */
function loader(service: unknown, label: string) {
  return async (): Promise<Record<string, unknown>[]> => {
    const res = await (service as GenericService).getAll({
      orderBy: ['ava_name asc'],
      top: 500,
    });
    if (!res.success) {
      const message =
        (res.error as { message?: string } | undefined)?.message ?? 'Unknown Dataverse error';
      throw new Error(`Load ${label} failed: ${message}`);
    }
    return (res.data as Record<string, unknown>[]) ?? [];
  };
}

export const RECORD_SOURCES: RecordSource[] = [
  {
    key: 'LendingTransaction',
    label: 'Lending Transaction',
    pegaClass: 'MyOrg-TheLending-Data-LendingTransaction',
    idField: 'ava_lddtransactionid',
    columns: [
      { field: 'ava_name', label: 'Lending transaction name' },
      { field: 'ava_applicationnumber', label: 'Application identifier' },
      { field: 'ava_producttype', label: 'Loan type' },
      { field: 'ava_customername', label: 'Customer' },
      { field: 'ava_requestedamount', label: 'Requested amount', kind: 'money' },
      { field: 'ava_fundedamount', label: 'Funded amount', kind: 'money' },
      { field: 'ava_creditscore', label: 'Credit score', kind: 'number' },
      { field: 'ava_status', label: 'Status', kind: 'chip' },
    ],
    load: loader(Ava_lddtransactionsService, 'lending transactions'),
  },
  {
    key: 'Customer',
    label: 'Customer',
    pegaClass: 'MyOrg-TheLending-Data-Customer',
    idField: 'ava_lddcustomerid',
    columns: [
      { field: 'ava_name', label: 'Customer name' },
      { field: 'ava_customernumber', label: 'Customer number' },
      { field: 'ava_segment', label: 'Segment', kind: 'chip' },
      { field: 'ava_emailaddress', label: 'Email address' },
    ],
    load: loader(Ava_lddcustomersService, 'customers'),
  },
  {
    key: 'QualityReview',
    label: 'Quality Review',
    pegaClass: 'MyOrg-TheLending-Data-QualityReview',
    idField: 'ava_lddqualityreviewid',
    columns: [
      { field: 'ava_name', label: 'Quality review name' },
      { field: 'ava_reviewtype', label: 'Review type' },
      { field: 'ava_reviewstatus', label: 'Review status', kind: 'chip' },
      { field: 'ava_reviewdate', label: 'Review date', kind: 'date' },
    ],
    load: loader(Ava_lddqualityreviewsService, 'quality reviews'),
  },
  {
    key: 'RiskAssessment',
    label: 'Risk Assessment',
    pegaClass: 'MyOrg-TheLending-Data-RiskAssessment',
    idField: 'ava_lddriskprofileid',
    columns: [
      { field: 'ava_name', label: 'Risk assessment name' },
      { field: 'ava_riskscoreid', label: 'Risk score identifier' },
      { field: 'ava_riskscore', label: 'Risk score', kind: 'number' },
      { field: 'ava_internalriskgrade', label: 'Internal risk grade', kind: 'chip' },
      { field: 'ava_riskstatus', label: 'Risk status', kind: 'chip' },
    ],
    load: loader(Ava_lddriskprofilesService, 'risk assessments'),
  },
  {
    key: 'OversightCase',
    label: 'Oversight Case',
    pegaClass: 'MyOrg-TheLending-Data-OversightCase',
    idField: 'ava_lddoversightcaseid',
    columns: [
      { field: 'ava_name', label: 'Oversight case name' },
      { field: 'ava_oversightteam', label: 'Oversight team' },
    ],
    load: loader(Ava_lddoversightcasesService, 'oversight cases'),
  },
  {
    key: 'ComplianceFinding',
    label: 'Compliance Finding',
    pegaClass: 'MyOrg-TheLending-Data-ComplianceFinding',
    idField: 'ava_lddcompliancefindingid',
    columns: [
      { field: 'ava_name', label: 'Compliance finding name' },
      { field: 'ava_uniquefindingid', label: 'Unique finding ID' },
      { field: 'ava_findingtype', label: 'Finding type' },
      { field: 'ava_risklevel', label: 'Risk level', kind: 'chip' },
      { field: 'ava_details', label: 'Details' },
    ],
    load: loader(Ava_lddcompliancefindingsService, 'compliance findings'),
  },
  {
    key: 'Recommendation',
    label: 'Recommendation',
    pegaClass: 'MyOrg-TheLending-Data-Recommendation',
    idField: 'ava_lddrecommendationitemid',
    columns: [
      { field: 'ava_name', label: 'Recommendation name' },
      { field: 'ava_recommendationtype', label: 'Recommendation type' },
      { field: 'ava_recommendationdescription', label: 'Description' },
    ],
    load: loader(Ava_lddrecommendationitemsService, 'recommendations'),
  },
  {
    key: 'EscalationLog',
    label: 'Escalation Log',
    pegaClass: 'MyOrg-TheLending-Data-EscalationLog',
    idField: 'ava_lddescalationlogid',
    columns: [
      { field: 'ava_name', label: 'Escalation log name' },
      { field: 'ava_escalationreason', label: 'Escalation reason' },
      { field: 'ava_raisedby', label: 'Raised by' },
      { field: 'ava_escalationeventdate', label: 'Escalation event date', kind: 'date' },
    ],
    load: loader(Ava_lddescalationlogsService, 'escalation logs'),
  },
  {
    key: 'ResolutionSummary',
    label: 'Resolution Summary',
    pegaClass: 'MyOrg-TheLending-Data-ResolutionSummary',
    idField: 'ava_lddresolutionsummaryid',
    columns: [
      { field: 'ava_name', label: 'Resolution summary name' },
      { field: 'ava_summary', label: 'Summary' },
    ],
    load: loader(Ava_lddresolutionsummariesService, 'resolution summaries'),
  },
  {
    key: 'RoleAssignment',
    label: 'Role Assignment',
    pegaClass: 'MyOrg-TheLending-Data-RoleAssignment',
    idField: 'ava_lddroleassignmentid',
    columns: [
      { field: 'ava_name', label: 'Role assignment name' },
      { field: 'ava_teammembername', label: 'Team member' },
      { field: 'ava_operatorid', label: 'Operator ID' },
      { field: 'ava_role', label: 'Role', kind: 'chip' },
    ],
    load: loader(Ava_lddroleassignmentsService, 'role assignments'),
  },
];
