// Loads the extracted prototype configuration into Dataverse: case types, stages,
// steps, views, view fields, choice sets, decision tables and roles, plus a set of
// reference data objects and demo cases.
//
// Idempotent - every write is an upsert keyed on a natural key.
// Usage: node scripts/seed-prototype.mjs [--config <path>] [--no-demo]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ORG = process.env.LDD_ORG_URL || 'https://org07a06763.crm.dynamics.com';
const API = `${ORG}/api/data/v9.2`;

// Resolve the config path relative to this script unless one is passed explicitly.
const configFlag = process.argv.indexOf('--config');
const CONFIG_PATH =
  configFlag !== -1 && process.argv[configFlag + 1]
    ? process.argv[configFlag + 1]
    : fileURLToPath(new URL('../prototype/ldd-prototype-config.json', import.meta.url));
const WITH_DEMO = !process.argv.includes('--no-demo');

const TOKEN = execFileSync(
  'az',
  ['account', 'get-access-token', '--resource', ORG, '--query', 'accessToken', '-o', 'tsv'],
  { encoding: 'utf8', shell: true }
).trim();

async function call(method, path, body, prefer = 'return=representation') {
  const res = await fetch(`${API}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json',
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

const ID = {
  ava_lddcasetypes: 'ava_lddcasetypeid',
  ava_lddstages: 'ava_lddstageid',
  ava_lddsteps: 'ava_lddstepid',
  ava_lddviews: 'ava_lddviewid',
  ava_lddviewfields: 'ava_lddviewfieldid',
  ava_lddchoicesets: 'ava_lddchoicesetid',
  ava_lddchoicevalues: 'ava_lddchoicevalueid',
  ava_ldddecisions: 'ava_ldddecisionid',
  ava_ldddecisionrows: 'ava_ldddecisionrowid',
  ava_lddroles: 'ava_lddroleid',
  ava_lddcustomers: 'ava_lddcustomerid',
  ava_lddcompliancefindings: 'ava_lddcompliancefindingid',
  ava_lddqualityreviews: 'ava_lddqualityreviewid',
  ava_lddriskprofiles: 'ava_lddriskprofileid',
  ava_lddoversightcases: 'ava_lddoversightcaseid',
  ava_lddresolutionsummaries: 'ava_lddresolutionsummaryid',
  ava_lddescalationlogs: 'ava_lddescalationlogid',
  ava_lddrecommendationitems: 'ava_lddrecommendationitemid',
  ava_lddroleassignments: 'ava_lddroleassignmentid',
  ava_lddworkcases: 'ava_lddworkcaseid',
  ava_lddassignments: 'ava_lddassignmentid',
  ava_lddapprovals: 'ava_lddapprovalid',
  ava_lddcasehistories: 'ava_lddcasehistoryid',
  ava_lddlendingreviews: 'ava_lddlendingreviewid',
  ava_lddriskassessmentcases: 'ava_lddriskassessmentcaseid',
  ava_lddcompliancecases: 'ava_lddcompliancecaseid',
  ava_lddescalationcases: 'ava_lddescalationcaseid',
  ava_lddqualityreccases: 'ava_lddqualityreccaseid',
  ava_lddtransactions: 'ava_lddtransactionid',
};

const q = (v) => `'${String(v).replace(/'/g, "''")}'`;

async function upsert(set, filter, record) {
  const key = ID[set];
  if (!key) throw new Error(`No id column registered for ${set}`);
  const found = await call(
    'GET',
    `${set}?$select=${key}&$filter=${encodeURIComponent(filter)}&$top=1`,
    null,
    null
  );
  if (found.value?.length) {
    const id = found.value[0][key];
    await call('PATCH', `${set}(${id})`, record, 'return=minimal');
    return id;
  }
  const created = await call('POST', set, record);
  return created[key];
}

const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const counts = {};
const bump = (k, n = 1) => (counts[k] = (counts[k] ?? 0) + n);

async function main() {
  console.log(`Seeding "${cfg.app.name}" v${cfg.app.version} into ${ORG}\n`);

  /* --------------------------- choice sets --------------------------- */
  for (const cs of cfg.choiceSets) {
    const setId = await upsert('ava_lddchoicesets', `ava_name eq ${q(cs.name)}`, {
      ava_name: cs.name,
      ava_label: cs.label,
      ava_owningclass: cs.owningClass,
      statecode: 0,
    });
    bump('choiceSets');
    let order = 1;
    for (const v of cs.values) {
      await upsert(
        'ava_lddchoicevalues',
        `ava_name eq ${q(v)} and _ava_choicesetid_value eq ${setId}`,
        {
          ava_name: v,
          ava_sortorder: order++,
          'ava_ChoiceSetId@odata.bind': `/ava_lddchoicesets(${setId})`,
          statecode: 0,
        }
      );
      bump('choiceValues');
    }
  }
  console.log(`choice sets: ${counts.choiceSets}, values: ${counts.choiceValues}`);

  /* ------------------------------ roles ------------------------------ */
  for (const r of cfg.roles) {
    await upsert('ava_lddroles', `ava_name eq ${q(r.name)}`, {
      ava_name: r.name,
      ava_accessgroup: r.accessGroup,
      ava_workbasket: `TheLending:${r.name}`,
      ava_ismanager: r.isManager,
      statecode: 0,
    });
    bump('roles');
  }
  console.log(`roles: ${counts.roles}`);

  /* ------------------------------ views ------------------------------ */
  const viewIds = new Map();
  for (const v of cfg.views) {
    const viewId = await upsert('ava_lddviews', `ava_name eq ${q(v.name)}`, {
      ava_name: v.name,
      ava_label: v.name.replace(/([a-z0-9])([A-Z])/g, '$1 $2'),
      ava_casetypecode: v.caseTypeCode,
      statecode: 0,
    });
    viewIds.set(v.name, viewId);
    bump('views');
    let order = 1;
    for (const f of v.fields) {
      await upsert(
        'ava_lddviewfields',
        `ava_name eq ${q(f.name)} and _ava_viewid_value eq ${viewId}`,
        {
          ava_name: f.name,
          ava_label: f.label.replace(/([a-z0-9])([A-Z])/g, '$1 $2'),
          ava_control: f.control,
          ava_choiceset: f.choiceSet ?? null,
          ava_lookuptable: f.targetClass ? f.targetClass.replace('MyOrg-TheLending-Data-', '') : null,
          ava_region: f.region,
          ava_required: Boolean(f.required),
          ava_readonly: Boolean(f.readOnly),
          ava_sortorder: order++,
          'ava_ViewId@odata.bind': `/ava_lddviews(${viewId})`,
          statecode: 0,
        }
      );
      bump('viewFields');
    }
  }
  console.log(`views: ${counts.views}, fields: ${counts.viewFields}`);

  /* ---------------------------- decisions ---------------------------- */
  for (const d of cfg.decisions) {
    const decId = await upsert('ava_ldddecisions', `ava_name eq ${q(d.name)}`, {
      ava_name: d.name,
      ava_casetypecode: d.caseTypeCode,
      ava_description: d.description,
      ava_conditions: JSON.stringify(d.conditions),
      ava_otherwise: d.otherwise,
      statecode: 0,
    });
    bump('decisions');
    for (const r of d.rows) {
      await upsert(
        'ava_ldddecisionrows',
        `_ava_decisionid_value eq ${decId} and ava_sortorder eq ${r.sortOrder}`,
        {
          ava_name: `${r.operator} ${r.when.join(' + ')} -> ${r.result}`.slice(0, 200),
          ava_operator: r.operator,
          ava_whenvalues: JSON.stringify(r.when),
          ava_result: r.result,
          ava_sortorder: r.sortOrder,
          'ava_DecisionId@odata.bind': `/ava_ldddecisions(${decId})`,
          statecode: 0,
        }
      );
      bump('decisionRows');
    }
  }
  console.log(`decisions: ${counts.decisions}, rows: ${counts.decisionRows}`);

  /* ------------------- case types / stages / steps ------------------- */
  const DETAIL_TABLE = {
    LendingReview: 'ava_lddlendingreviews',
    RiskAssessment: 'ava_lddriskassessmentcases',
    ComplianceMonitoring: 'ava_lddcompliancecases',
    EscalationManagement: 'ava_lddescalationcases',
    QualityRecommendation: 'ava_lddqualityreccases',
  };

  const caseTypeIds = new Map();
  for (const ct of cfg.caseTypes) {
    const ctId = await upsert('ava_lddcasetypes', `ava_code eq ${q(ct.code)}`, {
      ava_name: ct.name,
      ava_code: ct.code,
      ava_pegaclass: ct.pegaClass,
      ava_caseprefix: ct.prefix,
      ava_icon: ct.icon,
      ava_urgency: ct.urgency,
      ava_detailtable: DETAIL_TABLE[ct.code] ?? '',
      ava_sortorder: ct.sortOrder,
      statecode: 0,
    });
    caseTypeIds.set(ct.code, ctId);
    bump('caseTypes');

    for (const s of ct.stages) {
      const stageId = await upsert(
        'ava_lddstages',
        `ava_stagecode eq ${q(s.code)} and _ava_casetypeid_value eq ${ctId}`,
        {
          ava_name: s.name,
          ava_stagecode: s.code,
          ava_stagetype: s.type,
          ava_transition: s.transition,
          ava_processname: s.processName,
          ava_sortorder: s.sortOrder,
          'ava_CaseTypeId@odata.bind': `/ava_lddcasetypes(${ctId})`,
          statecode: 0,
        }
      );
      bump('stages');

      for (const st of s.steps) {
        await upsert(
          'ava_lddsteps',
          `ava_sortorder eq ${st.sortOrder} and _ava_stageid_value eq ${stageId}`,
          {
            ava_name: st.name,
            ava_kind: st.kind,
            ava_impl: st.impl,
            ava_viewname: st.view,
            ava_routingtype: st.routingType,
            ava_workbasket: st.workbasket,
            ava_notificationname: st.notificationName,
            ava_targetstagecode: st.targetStageCode,
            ava_approvertype: st.approverType,
            ava_decisionname: st.decisionName,
            ava_guarddecision: st.guardDecision ?? null,
            ava_guardresults: st.guardResults ?? null,
            ava_sladays: st.kind === 'Assignment' ? 2 : null,
            ava_sortorder: st.sortOrder,
            ava_params: JSON.stringify(st.params ?? {}),
            'ava_StageId@odata.bind': `/ava_lddstages(${stageId})`,
            statecode: 0,
          }
        );
        bump('steps');
      }
    }
  }
  console.log(`case types: ${counts.caseTypes}, stages: ${counts.stages}, steps: ${counts.steps}`);

  if (!WITH_DEMO) {
    console.log('\nSkipping demo data (--no-demo).');
    return;
  }

  /* --------------------------- reference data --------------------------- */
  const customers = [
    { ava_name: 'CRYSTAL SNIDER', ava_customernumber: 'C-100241', ava_segment: 'Retail', ava_emailaddress: 'crystal.snider@example.com' },
    { ava_name: 'DAVID MORRISON', ava_customernumber: 'C-100518', ava_segment: 'Retail', ava_emailaddress: 'david.morrison@example.com' },
    { ava_name: 'ANITA PATEL', ava_customernumber: 'C-100773', ava_segment: 'Small Business', ava_emailaddress: 'anita.patel@example.com' },
    { ava_name: 'MARC LEBLANC', ava_customernumber: 'C-101002', ava_segment: 'Retail', ava_emailaddress: 'marc.leblanc@example.com' },
    { ava_name: 'JORDAN WHITE', ava_customernumber: 'C-101455', ava_segment: 'Commercial', ava_emailaddress: 'jordan.white@example.com' },
  ];
  const customerIds = new Map();
  for (const c of customers) {
    customerIds.set(
      c.ava_name,
      await upsert('ava_lddcustomers', `ava_customernumber eq ${q(c.ava_customernumber)}`, { ...c, statecode: 0 })
    );
    bump('customers');
  }

  const findings = [
    { ava_name: 'Income documentation incomplete', ava_findingtype: 'Documentation error', ava_risklevel: 'High', ava_uniquefindingid: 'F-0001' },
    { ava_name: 'KYC refresh overdue', ava_findingtype: 'Regulatory violation', ava_risklevel: 'High', ava_uniquefindingid: 'F-0002' },
    { ava_name: 'Approval outside delegated authority', ava_findingtype: 'Policy breach', ava_risklevel: 'Medium', ava_uniquefindingid: 'F-0003' },
    { ava_name: 'Appraisal not on file', ava_findingtype: 'Process deficiency', ava_risklevel: 'Medium', ava_uniquefindingid: 'F-0004' },
    { ava_name: 'Client complaint logged post-funding', ava_findingtype: 'Customer complaint', ava_risklevel: 'Low', ava_uniquefindingid: 'F-0005' },
  ];
  const findingIds = new Map();
  for (const f of findings) {
    findingIds.set(
      f.ava_uniquefindingid,
      await upsert('ava_lddcompliancefindings', `ava_uniquefindingid eq ${q(f.ava_uniquefindingid)}`, { ...f, statecode: 0 })
    );
    bump('findings');
  }

  const riskProfiles = [
    { ava_name: 'RP-2026-0001', ava_internalriskgrade: 'IRG-4', ava_riskstatus: 'In review', ava_riskscoreid: 'RS-0001', ava_riskscore: 68 },
    { ava_name: 'RP-2026-0002', ava_internalriskgrade: 'IRG-2', ava_riskstatus: 'Open', ava_riskscoreid: 'RS-0002', ava_riskscore: 34 },
    { ava_name: 'RP-2026-0003', ava_internalriskgrade: 'IRG-6', ava_riskstatus: 'Escalated', ava_riskscoreid: 'RS-0003', ava_riskscore: 88 },
  ];
  const riskProfileIds = new Map();
  for (const r of riskProfiles) {
    riskProfileIds.set(r.ava_name, await upsert('ava_lddriskprofiles', `ava_name eq ${q(r.ava_name)}`, { ...r, statecode: 0 }));
    bump('riskProfiles');
  }

  const qualityReviews = [
    { ava_name: 'QR-2026-0001', ava_reviewtype: 'Routine', ava_reviewstatus: 'Completed', ava_reviewdate: '2026-06-15' },
    { ava_name: 'QR-2026-0002', ava_reviewtype: 'Targeted', ava_reviewstatus: 'In review', ava_reviewdate: '2026-07-02' },
    { ava_name: 'QR-2026-0003', ava_reviewtype: 'Escalation', ava_reviewstatus: 'Escalated', ava_reviewdate: '2026-08-11' },
  ];
  const qualityReviewIds = new Map();
  for (const r of qualityReviews) {
    qualityReviewIds.set(r.ava_name, await upsert('ava_lddqualityreviews', `ava_name eq ${q(r.ava_name)}`, { ...r, statecode: 0 }));
    bump('qualityReviews');
  }

  for (const o of [
    { ava_name: 'Business Controls oversight 2026', ava_oversightteam: 'Business Controls' },
    { ava_name: 'Risk Management oversight 2026', ava_oversightteam: 'Risk Management' },
  ]) {
    await upsert('ava_lddoversightcases', `ava_name eq ${q(o.ava_name)}`, { ...o, statecode: 0 });
    bump('oversightCases');
  }

  for (const r of [
    { ava_name: 'Remediation completed and validated', ava_summary: 'Corrective actions implemented and confirmed by second line.' },
    { ava_name: 'Closed with no further action', ava_summary: 'Review found no policy breach.' },
  ]) {
    await upsert('ava_lddresolutionsummaries', `ava_name eq ${q(r.ava_name)}`, { ...r, statecode: 0 });
    bump('resolutionSummaries');
  }

  console.log(
    `reference data: customers=${counts.customers} findings=${counts.findings} ` +
      `riskProfiles=${counts.riskProfiles} qualityReviews=${counts.qualityReviews}`
  );

  /* ------------------------------ demo cases ------------------------------ */
  // Existing transactions from the first iteration are reused as the subject of cases.
  const txns = await call(
    'GET',
    'ava_lddtransactions?$select=ava_lddtransactionid,ava_name,ava_customername&$top=10',
    null,
    null
  );
  const txById = new Map((txns.value ?? []).map((t) => [t.ava_name, t]));

  const demoCases = [
    {
      code: 'LendingReview',
      name: 'L-26090001',
      stage: 'PRIM2',
      stageName: 'Review Assessment',
      status: 'Open-Review Assessment',
      assignedTo: 'BEL, MM01025_RSA',
      assignmentType: 'WorkBasket',
      workbasket: 'TheLending:LoanOfficer',
      stepIndex: 0,
      txn: 'CLASS_amit9911',
      customer: 'CRYSTAL SNIDER',
      detailSet: 'ava_lddlendingreviews',
      detail: {
        ava_lendingreviewname: 'Mortgage file review - Snider',
        ava_lendingreviewreason: 'Routine quality assurance sample',
        ava_reviewtype: 'Routine',
        ava_escalationstatus: 'None',
        ava_riskrating: 'Medium',
        ava_reviewassignedmanager: 'Tester',
        ava_reviewrequesteddate: '2026-09-01',
        ava_regulatorycompliancecheck: true,
        ava_businessunit: 'Retail Lending',
      },
      assignment: { name: 'Review Documentation', view: 'ReviewDocumentation', type: 'WorkBasket', hours: 26 },
    },
    {
      code: 'RiskAssessment',
      name: 'R-26090001',
      stage: 'PRIM2',
      stageName: 'Detailed Assessment',
      status: 'Open-Detailed Assessment',
      assignedTo: 'FEU, OT00207_RSA',
      assignmentType: 'WorkBasket',
      workbasket: 'TheLending:RiskManager',
      stepIndex: 1,
      txn: 'CLASS_8962690_1',
      customer: 'DAVID MORRISON',
      detailSet: 'ava_lddriskassessmentcases',
      detail: {
        ava_riskassessmentname: 'Credit risk assessment - Morrison',
        ava_risktype: 'Credit',
        ava_riskrating: 'High',
        ava_assessmentmethod: 'Hybrid',
        ava_assessorname: 'Singh,Amit',
        ava_assessmentsummary: 'Elevated TDSR with limited verified income history.',
        ava_controlsapplied: 'Second-line review; income re-verification.',
      },
      assignment: { name: 'Analyze Risk Profile', view: 'AnalyzeRiskProfile', type: 'WorkBasket', hours: 8 },
    },
    {
      code: 'ComplianceMonitoring',
      name: 'C-26090001',
      stage: 'PRIM2',
      stageName: 'Issue Assessment',
      status: 'Open-Issue Assessment',
      assignedTo: 'BCGeneralWB',
      assignmentType: 'WorkBasket',
      workbasket: 'TheLending:ComplianceOfficer',
      stepIndex: 0,
      txn: 'CLASS_8962690_2',
      customer: 'ANITA PATEL',
      detailSet: 'ava_lddcompliancecases',
      detail: {
        ava_compliancemonitoringname: 'Periodic AML review - Q3',
        ava_compliancereviewtype: 'Periodic review',
        ava_businessunit: 'Retail Lending',
        ava_businesscontrolsteam: 'Business Controls',
        ava_issueseverity: 'High',
        ava_regulatoryrequirement: 'AML',
        ava_reviewmethodology: 'Sampling',
        ava_resolutionstatus: 'Open',
        ava_reviewdate: '2026-08-20',
      },
      assignment: { name: 'Evaluate Issue', view: 'EvaluateIssue', type: 'WorkBasket', hours: 4 },
    },
    {
      code: 'EscalationManagement',
      name: 'E-26090001',
      stage: 'PRIM2',
      stageName: 'Specialist Assessment',
      status: 'Open-Specialist Assessment',
      assignedTo: 'FEU, OT00207_RSA',
      assignmentType: 'WorkBasket',
      workbasket: 'TheLending:FraudFinancialCrimeOfficer',
      stepIndex: 0,
      txn: 'RCS_5518890',
      customer: 'JORDAN WHITE',
      detailSet: 'ava_lddescalationcases',
      detail: {
        ava_escalationmanagementname: 'Suspected fraud - White',
        ava_escalationreason: 'Transaction pattern inconsistent with declared income',
        ava_escalationinitiatedby: 'Singh,Amit',
        ava_escalationcategory: 'Fraud risk',
        ava_escalationurgencylevel: 'High',
        ava_assignedteam: 'Risk management',
        ava_dateescalated: '2026-09-02',
        ava_followuprequired: true,
      },
      assignment: { name: 'Review Transaction', view: 'ReviewTransaction', type: 'WorkBasket', hours: 2 },
    },
    {
      code: 'QualityRecommendation',
      name: 'Q-26090001',
      stage: 'PRIM1',
      stageName: 'Assessment Analysis',
      status: 'Open-Assessment Analysis',
      assignedTo: 'BEL, MM01025_RSA',
      assignmentType: 'WorkBasket',
      workbasket: 'TheLending:OperationsManager',
      stepIndex: 0,
      txn: 'CLASS_7741220',
      customer: 'MARC LEBLANC',
      detailSet: 'ava_lddqualityreccases',
      detail: {
        ava_qualityrecommendationname: 'Strengthen income verification controls',
        ava_recommendationdescription:
          'Introduce a mandatory second-line check where declared income is unverified and TDSR exceeds 40 percent.',
        ava_recommendationtype: 'Process improvement',
        ava_recommendationstatus: 'Draft',
        ava_recommendationpriority: 'High',
        ava_responsibleoversightteam: 'Business Controls',
        ava_assignedowner: 'Tester',
        ava_stakeholdercontactemail: 'business.controls@example.com',
        ava_targetresolutiondate: '2026-11-30',
        ava_validationrequired: true,
      },
      assignment: { name: 'Evaluate Risk Factors', view: 'EvaluateRiskFactors', type: 'WorkBasket', hours: 40 },
    },
  ];

  const now = Date.now();
  const iso = (h) => new Date(now + h * 3600 * 1000).toISOString();

  for (const c of demoCases) {
    const ctId = caseTypeIds.get(c.code);
    const tx = txById.get(c.txn);
    const record = {
      ava_name: c.name,
      ava_casetypecode: c.code,
      ava_stagecode: c.stage,
      ava_stagename: c.stageName,
      ava_status: c.status,
      ava_urgency: 'Medium',
      ava_priority: 10,
      ava_assignedto: c.assignedTo,
      ava_assignmenttype: c.assignmentType,
      ava_workbasket: c.workbasket,
      ava_currentstepindex: c.stepIndex,
      ava_createdbyuser: 'BEL, MM01025_RSA',
      ava_sladeadline: iso(c.assignment.hours),
      'ava_CaseTypeId@odata.bind': `/ava_lddcasetypes(${ctId})`,
      statecode: 0,
    };
    if (customerIds.has(c.customer)) {
      record['ava_CustomerId@odata.bind'] = `/ava_lddcustomers(${customerIds.get(c.customer)})`;
    }
    if (tx) record['ava_TransactionId@odata.bind'] = `/ava_lddtransactions(${tx.ava_lddtransactionid})`;

    const caseId = await upsert('ava_lddworkcases', `ava_name eq ${q(c.name)}`, record);
    bump('cases');

    await upsert('ava_lddassignments', `ava_name eq ${q(c.assignment.name)} and _ava_workcaseid_value eq ${caseId}`, {
      ava_name: c.assignment.name,
      ava_stepname: c.assignment.name,
      ava_viewname: c.assignment.view,
      ava_stagecode: c.stage,
      ava_status: 'Pending',
      ava_assignedto: c.assignedTo,
      ava_assignmenttype: c.assignment.type,
      ava_workbasket: c.workbasket,
      ava_goal: iso(c.assignment.hours / 2),
      ava_deadline: iso(c.assignment.hours),
      ava_assignmentdate: iso(-2),
      ava_stepindex: c.stepIndex,
      'ava_WorkCaseId@odata.bind': `/ava_lddworkcases(${caseId})`,
      statecode: 0,
    });
    bump('assignments');

    const detail = { ...c.detail, ava_name: c.name, 'ava_WorkCaseId@odata.bind': `/ava_lddworkcases(${caseId})`, statecode: 0 };
    if (c.code === 'EscalationManagement') {
      detail['ava_ComplianceFindingId@odata.bind'] = `/ava_lddcompliancefindings(${findingIds.get('F-0002')})`;
      detail['ava_RiskProfileId@odata.bind'] = `/ava_lddriskprofiles(${riskProfileIds.get('RP-2026-0003')})`;
    }
    if (c.code === 'QualityRecommendation') {
      detail['ava_QualityReviewId@odata.bind'] = `/ava_lddqualityreviews(${qualityReviewIds.get('QR-2026-0002')})`;
      detail['ava_RiskProfileId@odata.bind'] = `/ava_lddriskprofiles(${riskProfileIds.get('RP-2026-0001')})`;
      detail['ava_ComplianceFindingId@odata.bind'] = `/ava_lddcompliancefindings(${findingIds.get('F-0001')})`;
    }
    await upsert(c.detailSet, `_ava_workcaseid_value eq ${caseId}`, detail);
    bump('details');

    await upsert(
      'ava_lddcasehistories',
      `_ava_workcaseid_value eq ${caseId} and ava_eventtype eq ${q('Created')}`,
      {
        ava_name: `Case ${c.name} created`,
        ava_eventtype: 'Created',
        ava_tostage: c.stageName,
        ava_performedby: 'BEL, MM01025_RSA',
        ava_eventdate: iso(-48),
        'ava_WorkCaseId@odata.bind': `/ava_lddworkcases(${caseId})`,
        statecode: 0,
      }
    );
    bump('history');
  }

  console.log(`demo cases: ${counts.cases}, assignments: ${counts.assignments}, details: ${counts.details}`);
  console.log('\nSeed complete.');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
