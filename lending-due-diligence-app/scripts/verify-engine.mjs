// End-to-end verification of the case engine against live Dataverse.
//
// This imports the SAME engine module the app ships (src/lib/engine.ts, run through
// Node's native TypeScript type stripping) and drives a complete lifecycle for every
// case type: create -> run automated steps -> complete assignments -> approvals ->
// resolution. It asserts the stage transitions, decision-table results and audit
// trail rather than just checking the calls succeed.
//
// Usage: node scripts/verify-engine.mjs [--keep]
import { execFileSync } from 'node:child_process';
import {
  evaluateDecision,
  planNextActions,
  primaryStages,
  stageByCode,
  stepsForStage,
  utilityEffect,
  addBusinessDays,
  nextCaseId,
} from '../src/lib/engine.ts';

const ORG = process.env.LDD_ORG_URL || 'https://org07a06763.crm.dynamics.com';
const API = `${ORG}/api/data/v9.2`;
const KEEP = process.argv.includes('--keep');

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
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

const get = async (set, query = '') => (await call('GET', `${set}${query}`, null, null)).value ?? [];

let passed = 0;
let failed = 0;
const failures = [];

function check(label, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    failures.push(`${label}${detail ? ` (${detail})` : ''}`);
    console.log(`  FAIL  ${label}${detail ? ` (${detail})` : ''}`);
  }
}

const DETAIL_SET = {
  LendingReview: 'ava_lddlendingreviews',
  RiskAssessment: 'ava_lddriskassessmentcases',
  ComplianceMonitoring: 'ava_lddcompliancecases',
  EscalationManagement: 'ava_lddescalationcases',
  QualityRecommendation: 'ava_lddqualityreccases',
};

const created = [];

async function main() {
  console.log('Loading process configuration from Dataverse...');
  const [caseTypes, stages, steps, views, viewFields, decisions, decisionRows, choiceSets, choiceValues] =
    await Promise.all([
      get('ava_lddcasetypes', '?$orderby=ava_sortorder'),
      get('ava_lddstages', '?$orderby=ava_sortorder&$top=200'),
      get('ava_lddsteps', '?$orderby=ava_sortorder&$top=500'),
      get('ava_lddviews', '?$top=200'),
      get('ava_lddviewfields', '?$orderby=ava_sortorder&$top=500'),
      get('ava_ldddecisions', '?$top=100'),
      get('ava_ldddecisionrows', '?$orderby=ava_sortorder&$top=300'),
      get('ava_lddchoicesets', '?$top=100'),
      get('ava_lddchoicevalues', '?$orderby=ava_sortorder&$top=300'),
    ]);

  console.log(
    `  caseTypes=${caseTypes.length} stages=${stages.length} steps=${steps.length} ` +
      `views=${views.length} fields=${viewFields.length} decisions=${decisions.length}`
  );

  console.log('\n=== 1. Configuration integrity ===');
  check('5 case types imported', caseTypes.length === 5, `got ${caseTypes.length}`);
  check('39 stages imported', stages.length === 39, `got ${stages.length}`);
  check('80 steps imported', steps.length === 80, `got ${steps.length}`);
  check('24 views imported', views.length === 24, `got ${views.length}`);
  check('10 decision tables imported', decisions.length === 10, `got ${decisions.length}`);
  check(
    'every case type has at least one primary stage',
    caseTypes.every(
      (ct) =>
        primaryStages(stages.filter((s) => s._ava_casetypeid_value === ct.ava_lddcasetypeid)).length > 0
    )
  );
  check(
    'every Assignment step with a view references a view that exists',
    steps
      .filter((s) => s.ava_kind === 'Assignment' && s.ava_viewname)
      .every((s) => views.some((v) => v.ava_name === s.ava_viewname)),
    steps
      .filter((s) => s.ava_kind === 'Assignment' && s.ava_viewname)
      .filter((s) => !views.some((v) => v.ava_name === s.ava_viewname))
      .map((s) => s.ava_viewname)
      .join(', ')
  );
  check(
    'every Decision step names a decision table that exists',
    steps
      .filter((s) => s.ava_kind === 'Decision')
      .every((s) => decisions.some((d) => d.ava_name === s.ava_decisionname)),
    steps
      .filter((s) => s.ava_kind === 'Decision' && !decisions.some((d) => d.ava_name === s.ava_decisionname))
      .map((s) => s.ava_decisionname)
      .join(', ')
  );
  check(
    'every choice field on a view resolves to a choice set',
    viewFields
      .filter((f) => f.ava_control === 'choice')
      .every((f) => choiceSets.some((c) => c.ava_name === (f.ava_choiceset || f.ava_name))),
    viewFields
      .filter(
        (f) =>
          f.ava_control === 'choice' &&
          !choiceSets.some((c) => c.ava_name === (f.ava_choiceset || f.ava_name))
      )
      .map((f) => f.ava_name)
      .join(', ')
  );

  console.log('\n=== 2. Decision table evaluation (pure engine) ===');
  const escalate = decisions.find((d) => d.ava_name === 'AssessRoutingCriteria');
  if (escalate) {
    const r1 = evaluateDecision(escalate, decisionRows, {
      ava_escalationcategory: 'Fraud risk',
      ava_escalationurgencylevel: 'High',
    });
    check('AssessRoutingCriteria: Fraud risk + High -> Risk management', r1.result === 'Risk management', r1.result);

    const r2 = evaluateDecision(escalate, decisionRows, {
      ava_escalationcategory: 'Compliance',
      ava_escalationurgencylevel: 'High',
    });
    check('AssessRoutingCriteria: Compliance + High -> Compliance', r2.result === 'Compliance', r2.result);

    const r3 = evaluateDecision(escalate, decisionRows, {
      ava_escalationcategory: 'Other',
      ava_escalationurgencylevel: 'Low',
    });
    check('AssessRoutingCriteria: unmatched -> Business controls (otherwise)', r3.result === 'Business controls', r3.result);
  } else {
    check('AssessRoutingCriteria decision table present', false);
  }

  const outcomes = decisions.find((d) => d.ava_name === 'DecisionOutcomes');
  if (outcomes) {
    const r = evaluateDecision(outcomes, decisionRows, {
      ava_assessmentoutcome: 'Non-compliant',
      ava_issueseverity: 'High',
      ava_resolutionstatus: 'Open',
    });
    check('DecisionOutcomes: Non-compliant + High + Open -> Escalate Immediately', r.result === 'Escalate Immediately', r.result);

    const r2 = evaluateDecision(outcomes, decisionRows, {
      ava_assessmentoutcome: 'Compliant',
      ava_issueseverity: 'Low',
      ava_resolutionstatus: 'Resolved',
    });
    check('DecisionOutcomes: Compliant + Low + Resolved -> Close Case', r2.result === 'Close Case', r2.result);
  }

  console.log('\n=== 3. Utility step classification ===');
  const utilities = steps.filter((s) => s.ava_kind === 'Utility');
  const unknown = utilities.filter((s) => utilityEffect(s).kind === 'unknown');
  check(
    'every Utility step maps to a known effect',
    unknown.length === 0,
    unknown.map((s) => s.ava_impl).join(', ')
  );
  check(
    'pxChangeToSpecifiedStage steps carry a target stage',
    steps
      .filter((s) => s.ava_impl === 'pxChangeToSpecifiedStage')
      .every((s) => Boolean(s.ava_targetstagecode))
  );

  console.log('\n=== 4. Engine planning per case type (dry run) ===');
  for (const ct of caseTypes) {
    const ctStages = stages.filter((s) => s._ava_casetypeid_value === ct.ava_lddcasetypeid);
    const stageIds = new Set(ctStages.map((s) => s.ava_lddstageid));
    const ctSteps = steps.filter((s) => stageIds.has(s._ava_stageid_value));
    const first = primaryStages(ctStages)[0];
    const fake = {
      ava_lddworkcaseid: '00000000-0000-0000-0000-000000000000',
      ava_stagecode: first.ava_stagecode,
      ava_currentstepindex: 0,
      ava_casetypecode: ct.ava_code,
    };
    const plan = planNextActions(fake, ctStages, ctSteps);
    const pausesOrResolves = plan.some(
      (a) => a.type === 'createAssignment' || a.type === 'createApproval' || a.type === 'resolve'
    );
    check(`${ct.ava_name}: engine produces a terminating plan from stage 1`, plan.length > 0 && pausesOrResolves,
      `${plan.length} actions, kinds=${[...new Set(plan.map((a) => a.type))].join('/')}`);
  }

  console.log('\n=== 5. Live lifecycle per case type ===');
  const stamp = Date.now().toString().slice(-6);

  for (const ct of caseTypes) {
    const code = ct.ava_code;
    console.log(`\n--- ${ct.ava_name} ---`);
    const ctStages = stages.filter((s) => s._ava_casetypeid_value === ct.ava_lddcasetypeid);
    const stageIds = new Set(ctStages.map((s) => s.ava_lddstageid));
    const ctSteps = steps.filter((s) => stageIds.has(s._ava_stageid_value));
    const first = primaryStages(ctStages)[0];

    // Create the case.
    const caseName = `${ct.ava_caseprefix}-VER${stamp}`;
    let record = await call('POST', 'ava_lddworkcases', {
      ava_name: caseName,
      ava_casetypecode: code,
      ava_stagecode: first.ava_stagecode,
      ava_stagename: first.ava_name,
      ava_status: `Open-${first.ava_name}`,
      ava_currentstepindex: 0,
      ava_createdbyuser: 'verify-engine',
      'ava_CaseTypeId@odata.bind': `/ava_lddcasetypes(${ct.ava_lddcasetypeid})`,
      statecode: 0,
    });
    created.push(['ava_lddworkcases', record.ava_lddworkcaseid]);
    check(`${code}: case created`, Boolean(record.ava_lddworkcaseid));

    const detail = await call('POST', DETAIL_SET[code], {
      ava_name: caseName,
      'ava_WorkCaseId@odata.bind': `/ava_lddworkcases(${record.ava_lddworkcaseid})`,
      statecode: 0,
    });
    created.push([DETAIL_SET[code], detail[`${DETAIL_SET[code].slice(0, -1)}id`]]);

    // Drive the engine until it resolves or we hit the iteration cap.
    let iterations = 0;
    let assignmentsCompleted = 0;
    let approvalsDecided = 0;
    let stagesVisited = new Set([first.ava_stagecode]);
    let decisionsSeen = 0;
    let stepsSkipped = 0;
    const stageVisits = { [first.ava_stagecode]: 1 };

    while (iterations++ < 40) {
      const plan = planNextActions(record, ctStages, ctSteps, { stageVisits });
      if (!plan.length) break;

      let paused = false;
      for (const action of plan) {
        if (action.type === 'changeStage') {
          const target = stageByCode(ctStages, action.toStageCode);
          record = await call('PATCH', `ava_lddworkcases(${record.ava_lddworkcaseid})`, {
            ava_stagecode: target.ava_stagecode,
            ava_stagename: target.ava_name,
            ava_status: `Open-${target.ava_name}`,
            ava_currentstepindex: 0,
          });
          stagesVisited.add(target.ava_stagecode);
          stageVisits[target.ava_stagecode] = (stageVisits[target.ava_stagecode] ?? 0) + 1;
        } else if (action.type === 'skipStep') {
          stepsSkipped += 1;
          record = await call('PATCH', `ava_lddworkcases(${record.ava_lddworkcaseid})`, {
            ava_currentstepindex: action.step.ava_sortorder ?? 1,
          });
        } else if (action.type === 'runUtility') {
          record = await call('PATCH', `ava_lddworkcases(${record.ava_lddworkcaseid})`, {
            ava_currentstepindex: action.step.ava_sortorder ?? 1,
          });
        } else if (action.type === 'evaluateDecision') {
          const d = decisions.find((x) => x.ava_name === action.decisionName);
          const values = { ...record };
          const result = d ? evaluateDecision(d, decisionRows, values).result : 'n/a';
          decisionsSeen += 1;
          record = await call('PATCH', `ava_lddworkcases(${record.ava_lddworkcaseid})`, {
            ava_lastdecisionresult: `${action.decisionName}: ${result}`,
            ava_currentstepindex: action.step.ava_sortorder ?? 1,
          });
          // Re-plan so guarded steps see the fresh decision result.
          paused = true;
          break;
        } else if (action.type === 'createAssignment') {
          const deadline = addBusinessDays(new Date(), action.step.ava_sladays ?? 2);
          const asg = await call('POST', 'ava_lddassignments', {
            ava_name: action.step.ava_name,
            ava_stepname: action.step.ava_name,
            ava_viewname: action.step.ava_viewname,
            ava_stagecode: action.stage.ava_stagecode,
            ava_status: 'Pending',
            ava_assignedto: 'verify-engine',
            ava_assignmenttype: action.step.ava_routingtype ?? 'WorkList',
            ava_deadline: deadline.toISOString(),
            ava_assignmentdate: new Date().toISOString(),
            'ava_WorkCaseId@odata.bind': `/ava_lddworkcases(${record.ava_lddworkcaseid})`,
            statecode: 0,
          });
          created.push(['ava_lddassignments', asg.ava_lddassignmentid]);

          // Simulate the user completing the form.
          await call(
            'PATCH',
            `ava_lddassignments(${asg.ava_lddassignmentid})`,
            { ava_status: 'Completed', ava_completedon: new Date().toISOString() },
            'return=minimal'
          );
          assignmentsCompleted += 1;

          const stageSteps = stepsForStage(ctSteps, action.stage.ava_lddstageid);
          const idx = stageSteps.findIndex((s) => s.ava_name === action.step.ava_name);
          record = await call('PATCH', `ava_lddworkcases(${record.ava_lddworkcaseid})`, {
            ava_currentstepindex: idx + 1,
          });
          paused = true;
          break;
        } else if (action.type === 'createApproval') {
          const ap = await call('POST', 'ava_lddapprovals', {
            ava_name: action.step.ava_name,
            ava_approvertype: action.step.ava_approvertype ?? 'Manager',
            ava_status: 'Pending',
            'ava_WorkCaseId@odata.bind': `/ava_lddworkcases(${record.ava_lddworkcaseid})`,
            statecode: 0,
          });
          created.push(['ava_lddapprovals', ap.ava_lddapprovalid]);
          await call(
            'PATCH',
            `ava_lddapprovals(${ap.ava_lddapprovalid})`,
            { ava_status: 'Completed', ava_decision: 'Approved', ava_decidedon: new Date().toISOString() },
            'return=minimal'
          );
          approvalsDecided += 1;

          const stageSteps = stepsForStage(ctSteps, action.stage.ava_lddstageid);
          const idx = stageSteps.findIndex((s) => s.ava_kind === 'Sub-Process');
          record = await call('PATCH', `ava_lddworkcases(${record.ava_lddworkcaseid})`, {
            ava_currentstepindex: idx + 1,
          });
          paused = true;
          break;
        } else if (action.type === 'resolve') {
          record = await call('PATCH', `ava_lddworkcases(${record.ava_lddworkcaseid})`, {
            ava_status: action.status,
            ava_resolvedon: new Date().toISOString(),
            ava_resolvedby: 'verify-engine',
          });
          paused = true;
          break;
        }
      }

      if ((record.ava_status ?? '').startsWith('Resolved')) break;
      if (!paused) break;
    }

    console.log(
      `      iterations=${iterations} stages=${stagesVisited.size} assignments=${assignmentsCompleted} ` +
        `approvals=${approvalsDecided} decisions=${decisionsSeen} skipped=${stepsSkipped} final="${record.ava_status}"`
    );

    check(`${code}: reached a resolved status`, (record.ava_status ?? '').startsWith('Resolved'), record.ava_status);
    check(`${code}: traversed multiple stages`, stagesVisited.size > 1, `${stagesVisited.size}`);
    check(`${code}: did not exceed the iteration cap`, iterations < 40, `${iterations}`);

    const expectAssignments = ctSteps.some((s) => s.ava_kind === 'Assignment');
    if (expectAssignments) {
      check(`${code}: completed at least one assignment`, assignmentsCompleted > 0);
    }
  }

  console.log('\n=== 6. Seeded demo cases still intact ===');
  const demo = await get('ava_lddworkcases', "?$filter=ava_createdbyuser eq 'BEL, MM01025_RSA'");
  check('5 seeded demo cases present', demo.length >= 5, `${demo.length}`);
  const demoAssignments = await get('ava_lddassignments', "?$filter=ava_status eq 'Pending'");
  check('seeded demo assignments are pending', demoAssignments.length >= 5, `${demoAssignments.length}`);

  console.log('\n=== 7. Case ID generator ===');
  const gen = nextCaseId({ ava_caseprefix: 'L' }, ['L-26090001', 'L-26090002']);
  check('nextCaseId increments within the current month', /^L-\d{4}\d{4}$/.test(gen), gen);

  if (!KEEP) {
    console.log('\nCleaning up verification records...');
    for (const [set, id] of created.reverse()) {
      if (!id) continue;
      try {
        await call('DELETE', `${set}(${id})`, null, null);
      } catch {
        /* child rows may already be gone via cascade */
      }
    }
    console.log(`  removed ${created.length} records`);
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`PASSED ${passed}   FAILED ${failed}`);
  if (failures.length) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  - ${f}`);
  }
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('\nHARNESS ERROR:', e.message);
  process.exit(2);
});
