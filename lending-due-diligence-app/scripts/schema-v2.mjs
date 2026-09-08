// Dataverse schema for the "The Lending Due Diligence (LDD)" prototype model.
//
// Design:
//  - Process CONFIGURATION tables drive a generic case engine (case types, stages,
//    steps, view field layouts, choice sets, decision tables). Changing process
//    behaviour is a data change, not a code change - this mirrors how Pega works.
//  - Business DATA OBJECT tables hold the reference entities the cases point at.
//  - One common WORK CASE envelope plus five typed DETAIL tables keep the worklist
//    a single query while preserving strong typing per case type.
//  - RUNTIME tables carry assignments, approvals and the audit trail.
//
// Existing tables from the first iteration (ava_lddtransaction, ava_lddemployee,
// ava_lddrefdata, ...) are reused where the prototype maps onto them.
export const PREFIX = 'ava';
export const SOLUTION = 'LendingDueDiligence';

const S = (name, len = 200) => ({ kind: 'string', name, len });
const M = (name) => ({ kind: 'memo', name });
const I = (name) => ({ kind: 'int', name });
const DT = (name) => ({ kind: 'datetime', name });
const DO = (name) => ({ kind: 'dateonly', name });
const B = (name) => ({ kind: 'bool', name });
const L = (name, target) => ({ kind: 'lookup', name, target });

/* ------------------------------------------------------------------ *
 * 1. Process configuration - drives the engine
 * ------------------------------------------------------------------ */
const configTables = [
  {
    schema: 'ava_LddCaseType',
    display: 'LDD Case Type',
    plural: 'LDD Case Types',
    description: 'Case type definitions imported from the Pega prototype.',
    primary: { schema: 'ava_Name', display: 'Case Type Name', len: 200 },
    columns: [
      S('ava_Code', 100),
      S('ava_PegaClass', 200),
      S('ava_CasePrefix', 10),
      S('ava_Icon', 60),
      S('ava_Urgency', 20),
      M('ava_Description'),
      S('ava_DetailTable', 100),
      I('ava_SortOrder'),
    ],
  },
  {
    schema: 'ava_LddStage',
    display: 'LDD Stage',
    plural: 'LDD Stages',
    description: 'Stage within a case type lifecycle.',
    primary: { schema: 'ava_Name', display: 'Stage Name', len: 200 },
    columns: [
      S('ava_StageCode', 20),
      S('ava_StageType', 20),
      S('ava_Transition', 30),
      S('ava_ProcessName', 200),
      I('ava_SortOrder'),
      L('ava_CaseTypeId', 'ava_lddcasetype'),
    ],
  },
  {
    schema: 'ava_LddStep',
    display: 'LDD Step',
    plural: 'LDD Steps',
    description: 'Step within a stage: assignment, utility, decision or sub-process.',
    primary: { schema: 'ava_Name', display: 'Step Name', len: 200 },
    columns: [
      S('ava_Kind', 30),
      S('ava_Impl', 100),
      S('ava_ViewName', 100),
      S('ava_RoutingType', 30),
      S('ava_Workbasket', 100),
      S('ava_NotificationName', 100),
      S('ava_TargetStageCode', 20),
      S('ava_ApproverType', 40),
      S('ava_DecisionName', 100),
      I('ava_SlaDays'),
      I('ava_SortOrder'),
      M('ava_Params'),
      L('ava_StageId', 'ava_lddstage'),
    ],
  },
  {
    schema: 'ava_LddView',
    display: 'LDD View',
    plural: 'LDD Views',
    description: 'Form definition rendered for an assignment step.',
    primary: { schema: 'ava_Name', display: 'View Name', len: 100 },
    columns: [S('ava_Label', 200), S('ava_CaseTypeCode', 100), I('ava_SortOrder')],
  },
  {
    schema: 'ava_LddViewField',
    display: 'LDD View Field',
    plural: 'LDD View Fields',
    description: 'A single field on a view, including its control type and binding.',
    primary: { schema: 'ava_Name', display: 'Field Name', len: 100 },
    columns: [
      S('ava_Label', 200),
      S('ava_Control', 40),
      S('ava_ChoiceSet', 100),
      S('ava_LookupTable', 100),
      S('ava_Region', 100),
      B('ava_Required'),
      B('ava_ReadOnly'),
      I('ava_SortOrder'),
      L('ava_ViewId', 'ava_lddview'),
    ],
  },
  {
    schema: 'ava_LddChoiceSet',
    display: 'LDD Choice Set',
    plural: 'LDD Choice Sets',
    description: 'Named list of allowed values, equivalent to a Pega field-value list.',
    primary: { schema: 'ava_Name', display: 'Choice Set Name', len: 100 },
    columns: [S('ava_Label', 200), S('ava_OwningClass', 200)],
  },
  {
    schema: 'ava_LddChoiceValue',
    display: 'LDD Choice Value',
    plural: 'LDD Choice Values',
    description: 'A single allowed value within a choice set.',
    primary: { schema: 'ava_Name', display: 'Value', len: 200 },
    columns: [S('ava_LabelFr', 200), I('ava_SortOrder'), L('ava_ChoiceSetId', 'ava_lddchoiceset')],
  },
  {
    schema: 'ava_LddDecision',
    display: 'LDD Decision Table',
    plural: 'LDD Decision Tables',
    description: 'Decision table evaluated by the engine at a Decision step.',
    primary: { schema: 'ava_Name', display: 'Decision Name', len: 100 },
    columns: [
      S('ava_CaseTypeCode', 100),
      M('ava_Description'),
      M('ava_Conditions'),
      S('ava_Otherwise', 200),
    ],
  },
  {
    schema: 'ava_LddDecisionRow',
    display: 'LDD Decision Row',
    plural: 'LDD Decision Rows',
    description: 'One if / else-if row of a decision table.',
    primary: { schema: 'ava_Name', display: 'Row', len: 200 },
    columns: [
      S('ava_Operator', 20),
      M('ava_WhenValues'),
      S('ava_Result', 200),
      I('ava_SortOrder'),
      L('ava_DecisionId', 'ava_ldddecision'),
    ],
  },
  {
    schema: 'ava_LddRole',
    display: 'LDD Role',
    plural: 'LDD Roles',
    description: 'Access group / persona from the prototype security model.',
    primary: { schema: 'ava_Name', display: 'Role Name', len: 200 },
    columns: [S('ava_AccessGroup', 200), S('ava_Workbasket', 100), B('ava_IsManager')],
  },
  {
    schema: 'ava_LddFlowBranch',
    display: 'LDD Flow Branch',
    plural: 'LDD Flow Branches',
    description:
      'A decision outcome and where the Pega flow routes it. Extracted from the ' +
      'flow rule bodies and validated against the decision table that owns it.',
    primary: { schema: 'ava_Name', display: 'Branch', len: 250 },
    columns: [
      S('ava_CaseTypeCode', 100),
      S('ava_StageCode', 20),
      S('ava_StageName', 200),
      S('ava_DecisionName', 200),
      S('ava_ResultValue', 200),
      S('ava_TargetTask', 100),
      S('ava_TransitionId', 50),
      // A branch landing on an END shape completes the stage, so the remaining
      // steps must be skipped rather than run.
      B('ava_IsTerminal'),
      I('ava_SortOrder'),
    ],
  },
];

/* ------------------------------------------------------------------ *
 * 2. Data objects referenced by the cases
 * ------------------------------------------------------------------ */
const dataTables = [
  {
    schema: 'ava_LddCustomer',
    display: 'LDD Customer',
    plural: 'LDD Customers',
    description: 'Customer associated with a lending transaction.',
    primary: { schema: 'ava_Name', display: 'Customer Name', len: 256 },
    columns: [S('ava_CustomerNumber', 50), S('ava_Segment', 100), S('ava_EmailAddress', 200)],
  },
  {
    schema: 'ava_LddComplianceFinding',
    display: 'LDD Compliance Finding',
    plural: 'LDD Compliance Findings',
    description: 'Compliance finding raised against a transaction or case.',
    primary: { schema: 'ava_Name', display: 'Compliance Finding Name', len: 256 },
    columns: [
      S('ava_FindingType', 100),
      S('ava_RiskLevel', 20),
      S('ava_UniqueFindingId', 100),
      M('ava_Details'),
    ],
  },
  {
    schema: 'ava_LddQualityReview',
    display: 'LDD Quality Review',
    plural: 'LDD Quality Reviews',
    description: 'Quality review record referenced by recommendation cases.',
    primary: { schema: 'ava_Name', display: 'Quality Review Name', len: 256 },
    columns: [S('ava_ReviewType', 60), S('ava_ReviewStatus', 60), DO('ava_ReviewDate')],
  },
  {
    schema: 'ava_LddRiskProfile',
    display: 'LDD Risk Profile',
    plural: 'LDD Risk Profiles',
    description: 'Risk assessment data object referenced by cases (distinct from the Risk Assessment case type).',
    primary: { schema: 'ava_Name', display: 'Risk Assessment Name', len: 256 },
    columns: [
      S('ava_InternalRiskGrade', 60),
      S('ava_RiskStatus', 60),
      S('ava_RiskScoreId', 100),
      I('ava_RiskScore'),
    ],
  },
  {
    schema: 'ava_LddOversightCase',
    display: 'LDD Oversight Case',
    plural: 'LDD Oversight Cases',
    description: 'Oversight case reference.',
    primary: { schema: 'ava_Name', display: 'Oversight Case Name', len: 256 },
    columns: [S('ava_OversightTeam', 100)],
  },
  {
    schema: 'ava_LddResolutionSummary',
    display: 'LDD Resolution Summary',
    plural: 'LDD Resolution Summaries',
    description: 'Resolution summary reference.',
    primary: { schema: 'ava_Name', display: 'Resolution Summary Name', len: 256 },
    columns: [M('ava_Summary')],
  },
  {
    schema: 'ava_LddEscalationLog',
    display: 'LDD Escalation Log',
    plural: 'LDD Escalation Logs',
    description: 'Escalation event recorded against a case.',
    primary: { schema: 'ava_Name', display: 'Escalation Log Name', len: 256 },
    columns: [
      DT('ava_EscalationEventDate'),
      S('ava_EscalationReason', 500),
      S('ava_RaisedBy', 100),
    ],
  },
  {
    schema: 'ava_LddRecommendationItem',
    display: 'LDD Recommendation Item',
    plural: 'LDD Recommendation Items',
    description: 'Individual recommendation captured on a risk assessment case.',
    primary: { schema: 'ava_Name', display: 'Recommendation Name', len: 256 },
    columns: [M('ava_RecommendationDescription'), S('ava_RecommendationType', 100)],
  },
  {
    schema: 'ava_LddRoleAssignment',
    display: 'LDD Role Assignment',
    plural: 'LDD Role Assignments',
    description: 'Team member assigned to a role on a case.',
    primary: { schema: 'ava_Name', display: 'Role Assignment Name', len: 256 },
    columns: [S('ava_Role', 100), S('ava_TeamMemberName', 200), S('ava_OperatorId', 50)],
  },
];

/* ------------------------------------------------------------------ *
 * 3. Work case envelope + runtime
 * ------------------------------------------------------------------ */
const commonCaseColumns = [
  S('ava_CaseTypeCode', 100),
  S('ava_StageCode', 20),
  S('ava_StageName', 200),
  S('ava_Status', 80),
  S('ava_Urgency', 20),
  I('ava_Priority'),
  S('ava_AssignedTo', 200),
  S('ava_AssignmentType', 30),
  S('ava_Workbasket', 100),
  I('ava_CurrentStepIndex'),
  S('ava_CreatedByUser', 200),
  DT('ava_SlaDeadline'),
  DT('ava_ResolvedOn'),
  S('ava_ResolvedBy', 200),
  S('ava_ResolutionCode', 100),
  M('ava_LastDecisionResult'),
  L('ava_CaseTypeId', 'ava_lddcasetype'),
  L('ava_CustomerId', 'ava_lddcustomer'),
  L('ava_TransactionId', 'ava_lddtransaction'),
];

const workTables = [
  {
    schema: 'ava_LddWorkCase',
    display: 'LDD Work Case',
    plural: 'LDD Work Cases',
    description: 'Common case envelope shared by all five LDD case types.',
    primary: { schema: 'ava_Name', display: 'Case ID', len: 50 },
    columns: commonCaseColumns,
  },
  {
    schema: 'ava_LddAssignment',
    display: 'LDD Assignment',
    plural: 'LDD Assignments',
    description: 'Open work item generated by an Assignment step.',
    primary: { schema: 'ava_Name', display: 'Assignment Name', len: 200 },
    columns: [
      S('ava_StepName', 200),
      S('ava_ViewName', 100),
      S('ava_StageCode', 20),
      S('ava_Status', 40),
      S('ava_AssignedTo', 200),
      S('ava_AssignmentType', 30),
      S('ava_Workbasket', 100),
      DT('ava_Goal'),
      DT('ava_Deadline'),
      DT('ava_AssignmentDate'),
      DT('ava_CompletedOn'),
      S('ava_CompletedBy', 200),
      I('ava_StepIndex'),
      L('ava_WorkCaseId', 'ava_lddworkcase'),
    ],
  },
  {
    schema: 'ava_LddApproval',
    display: 'LDD Approval',
    plural: 'LDD Approvals',
    description: 'Approval requested by a pxApproval sub-process step.',
    primary: { schema: 'ava_Name', display: 'Approval Name', len: 200 },
    columns: [
      S('ava_ApproverType', 40),
      S('ava_Approver', 200),
      S('ava_Decision', 40),
      M('ava_Comments'),
      S('ava_Status', 40),
      DT('ava_DecidedOn'),
      S('ava_RejectionStatus', 100),
      L('ava_WorkCaseId', 'ava_lddworkcase'),
    ],
  },
  {
    schema: 'ava_LddCaseHistory',
    display: 'LDD Case History',
    plural: 'LDD Case History',
    description: 'Audit trail of every stage change, step completion and decision.',
    primary: { schema: 'ava_Name', display: 'Event', len: 300 },
    columns: [
      S('ava_EventType', 60),
      S('ava_FromStage', 200),
      S('ava_ToStage', 200),
      S('ava_StepName', 200),
      S('ava_PerformedBy', 200),
      M('ava_Details'),
      DT('ava_EventDate'),
      L('ava_WorkCaseId', 'ava_lddworkcase'),
    ],
  },
  {
    schema: 'ava_LddNotification',
    display: 'LDD Notification',
    plural: 'LDD Notifications',
    description:
      'Outbox for notifications raised by a case. The code app writes a Pending ' +
      'row; a Power Automate flow triggers on create, sends it and stamps the ' +
      'result back. Keeps delivery out of the browser and gives retries for free.',
    primary: { schema: 'ava_Name', display: 'Notification', len: 250 },
    columns: [
      S('ava_Subject', 250),
      M('ava_Body'),
      S('ava_Recipient', 250),
      S('ava_RecipientRole', 100),
      S('ava_CaseNumber', 50),
      S('ava_CaseTypeCode', 100),
      S('ava_StepName', 200),
      // Pending -> Sent | Failed. The flow owns everything after Pending.
      S('ava_Status', 20),
      DT('ava_QueuedOn'),
      DT('ava_SentOn'),
      M('ava_ErrorMessage'),
      L('ava_WorkCaseId', 'ava_lddworkcase'),
    ],
  },
];

/* ------------------------------------------------------------------ *
 * 4. Typed detail tables, one per case type
 * ------------------------------------------------------------------ */
const detail = (schema, display, plural, description, columns) => ({
  schema,
  display,
  plural,
  description,
  primary: { schema: 'ava_Name', display: 'Case ID', len: 50 },
  columns: [...columns, L('ava_WorkCaseId', 'ava_lddworkcase')],
});

const detailTables = [
  detail(
    'ava_LddLendingReview',
    'LDD Lending Review Detail',
    'LDD Lending Review Details',
    'Type-specific fields for the Lending Review case type.',
    [
      S('ava_LendingReviewName', 256),
      S('ava_LendingReviewReason', 500),
      S('ava_ReviewType', 60),
      S('ava_EscalationStatus', 60),
      S('ava_QualityReviewOutcome', 60),
      S('ava_RiskRating', 60),
      S('ava_RecommendedActions', 500),
      S('ava_RequiredControls', 500),
      S('ava_ReviewAssignedManager', 200),
      DO('ava_ReviewRequestedDate'),
      B('ava_RegulatoryComplianceCheck'),
      S('ava_BusinessUnit', 200),
      M('ava_SupportingDocumentation'),
    ]
  ),
  detail(
    'ava_LddRiskAssessmentCase',
    'LDD Risk Assessment Detail',
    'LDD Risk Assessment Details',
    'Type-specific fields for the Risk Assessment case type.',
    [
      S('ava_RiskAssessmentName', 256),
      S('ava_RiskType', 60),
      S('ava_RiskRating', 60),
      S('ava_Outcome', 60),
      S('ava_AssessmentMethod', 60),
      S('ava_AssessorName', 200),
      M('ava_AssessmentSummary'),
      DT('ava_AssessmentDatetime'),
      M('ava_ControlsApplied'),
      M('ava_MitigationSteps'),
    ]
  ),
  detail(
    'ava_LddComplianceCase',
    'LDD Compliance Monitoring Detail',
    'LDD Compliance Monitoring Details',
    'Type-specific fields for the Compliance Monitoring case type.',
    [
      S('ava_ComplianceMonitoringName', 256),
      S('ava_ComplianceReviewType', 60),
      S('ava_BusinessUnit', 200),
      S('ava_BusinessControlsTeam', 200),
      S('ava_QualityAssuranceReviewer', 200),
      S('ava_AssessmentOutcome', 60),
      S('ava_ReviewMethodology', 60),
      S('ava_ResolutionStatus', 60),
      S('ava_IssueSeverity', 20),
      S('ava_RegulatoryRequirement', 60),
      DO('ava_ReviewDate'),
      DO('ava_ClosureDate'),
      B('ava_EscalationRequired'),
      M('ava_CorrectiveActionPlan'),
      M('ava_RootCauseAnalysis'),
      M('ava_Comments'),
      M('ava_SupportingEvidence'),
    ]
  ),
  detail(
    'ava_LddEscalationCase',
    'LDD Escalation Management Detail',
    'LDD Escalation Management Details',
    'Type-specific fields for the Escalation Management case type.',
    [
      S('ava_EscalationManagementName', 256),
      S('ava_EscalationReason', 500),
      S('ava_EscalationInitiatedBy', 200),
      S('ava_EscalationCategory', 60),
      S('ava_EscalationUrgencyLevel', 20),
      S('ava_AssignedTeam', 100),
      S('ava_DecisionMaker', 200),
      S('ava_RecommendationOutcome', 100),
      M('ava_AssessmentSummary'),
      M('ava_ResolutionDetails'),
      DO('ava_DateEscalated'),
      DO('ava_AssessmentDate'),
      DO('ava_DateResolved'),
      B('ava_FollowupRequired'),
      M('ava_SupportingDocuments'),
      L('ava_ComplianceFindingId', 'ava_lddcompliancefinding'),
      L('ava_RiskProfileId', 'ava_lddriskprofile'),
    ]
  ),
  detail(
    'ava_LddQualityRecCase',
    'LDD Quality Recommendation Detail',
    'LDD Quality Recommendation Details',
    'Type-specific fields for the Quality Recommendation case type.',
    [
      S('ava_QualityRecommendationName', 256),
      M('ava_RecommendationDescription'),
      S('ava_RecommendationType', 100),
      S('ava_RecommendationStatus', 60),
      S('ava_RecommendationPriority', 20),
      S('ava_ResponsibleOversightTeam', 100),
      S('ava_ValidationOutcome', 60),
      S('ava_AssignedOwner', 200),
      S('ava_StakeholderContactEmail', 200),
      M('ava_AssessmentRationale'),
      M('ava_RecommendedAction'),
      M('ava_ResolutionDetails'),
      M('ava_AuditTrail'),
      M('ava_BusinessOutcomeTracked'),
      DO('ava_TargetResolutionDate'),
      DO('ava_ActualResolutionDate'),
      B('ava_ValidationRequired'),
      B('ava_EscalationRequired'),
      L('ava_QualityReviewId', 'ava_lddqualityreview'),
      L('ava_RiskProfileId', 'ava_lddriskprofile'),
      L('ava_ComplianceFindingId', 'ava_lddcompliancefinding'),
      L('ava_OversightCaseId', 'ava_lddoversightcase'),
      L('ava_ResolutionSummaryId', 'ava_lddresolutionsummary'),
    ]
  ),
];

export const tables = [...configTables, ...dataTables, ...workTables, ...detailTables];
