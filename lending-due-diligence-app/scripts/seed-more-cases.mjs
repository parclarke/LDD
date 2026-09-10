// Seeds a larger volume of demo work cases so the My Work / Explore screens show a
// realistic worklist instead of a handful of rows.
//
// Everything is derived from the live configuration already in Dataverse - case
// types, their primary stages and the assignment steps on each stage - so every
// generated case sits on a real stage and its assignment points at a real view.
//
// Idempotent: cases are upserted on ava_name, and the generator is seeded with a
// fixed PRNG, so re-running produces the same rows rather than duplicating them.
//
// Usage: node scripts/seed-more-cases.mjs [--per-type 8] [--dry-run]
import { execFileSync } from 'node:child_process';

const ORG = process.env.LDD_ORG_URL || 'https://org07a06763.crm.dynamics.com';
const API = `${ORG}/api/data/v9.2`;
const SOLUTION = 'LendingDueDiligence';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const PER_TYPE = Number(arg('--per-type', '8'));
const DRY_RUN = process.argv.includes('--dry-run');

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
      'MSCRM.SolutionUniqueName': SOLUTION,
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

const ID = {
  ava_lddworkcases: 'ava_lddworkcaseid',
  ava_lddassignments: 'ava_lddassignmentid',
  ava_lddcasehistories: 'ava_lddcasehistoryid',
};

const q = (v) => `'${String(v).replace(/'/g, "''")}'`;

async function upsert(set, filter, record) {
  const key = ID[set];
  const found = await call('GET', `${set}?$select=${key}&$filter=${encodeURIComponent(filter)}&$top=1`, null, null);
  if (found.value?.length) {
    const id = found.value[0][key];
    await call('PATCH', `${set}(${id})`, record, 'return=minimal');
    return id;
  }
  const created = await call('POST', set, record);
  return created[key];
}

// Deterministic PRNG (mulberry32) so repeated runs generate identical rows.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const OPERATORS = [
  { name: 'BEL, MM01025_RSA', role: 'OperationsManager' },
  { name: 'FEU, OT00207_RSA', role: 'RiskManager' },
  { name: 'Singh,Amit', role: 'CreditRiskAnalyst' },
  { name: 'Tester', role: 'ComplianceOfficer' },
  { name: 'Nakamura,Yuki', role: 'Underwriter' },
  { name: 'Okafor,Chidi', role: 'LoanOfficer' },
  { name: 'Dubois,Claire', role: 'SeniorCreditOfficer' },
];

const WORKBASKET = {
  LendingReview: 'TheLending:LoanOfficer',
  RiskAssessment: 'TheLending:RiskManager',
  ComplianceMonitoring: 'TheLending:ComplianceOfficer',
  EscalationManagement: 'TheLending:FraudFinancialCrimeOfficer',
  QualityRecommendation: 'TheLending:OperationsManager',
};

const urgencyLabel = (priority) => (priority >= 70 ? 'High' : priority >= 35 ? 'Medium' : 'Low');

async function main() {
  const caseTypes = (
    await call('GET', 'ava_lddcasetypes?$select=ava_lddcasetypeid,ava_code,ava_name,ava_caseprefix', null, null)
  ).value;

  const stages = (
    await call(
      'GET',
      'ava_lddstages?$select=ava_lddstageid,ava_name,ava_stagecode,ava_stagetype,ava_sortorder,_ava_casetypeid_value&$top=200&$orderby=ava_sortorder',
      null,
      null
    )
  ).value;

  const steps = (
    await call(
      'GET',
      'ava_lddsteps?$select=ava_name,ava_kind,ava_viewname,ava_sortorder,_ava_stageid_value&$top=500&$orderby=ava_sortorder',
      null,
      null
    )
  ).value;

  const customers = (await call('GET', 'ava_lddcustomers?$select=ava_lddcustomerid,ava_name&$top=50', null, null)).value;
  const transactions = (
    await call('GET', 'ava_lddtransactions?$select=ava_lddtransactionid,ava_name&$top=50', null, null)
  ).value;

  // Highest existing sequence per prefix, so generated ids never collide.
  const existing = (await call('GET', 'ava_lddworkcases?$select=ava_name&$top=5000', null, null)).value;

  const stepsByStage = new Map();
  for (const s of steps) {
    if (!stepsByStage.has(s._ava_stageid_value)) stepsByStage.set(s._ava_stageid_value, []);
    stepsByStage.get(s._ava_stageid_value).push(s);
  }

  const now = Date.now();
  const iso = (h) => new Date(now + h * 3600 * 1000).toISOString();
  const day = (h) => iso(h).slice(0, 10);

  let created = 0;
  let assignments = 0;

  for (const ct of caseTypes) {
    const prefix = ct.ava_caseprefix || ct.ava_code.slice(0, 1);
    const primary = stages
      .filter((s) => s._ava_casetypeid_value === ct.ava_lddcasetypeid && s.ava_stagetype !== 'Alternate')
      .sort((a, b) => (a.ava_sortorder ?? 0) - (b.ava_sortorder ?? 0));

    if (!primary.length) {
      console.warn(`  ${ct.ava_code}: no primary stages, skipped`);
      continue;
    }

    const used = existing
      .filter((c) => c.ava_name?.startsWith(`${prefix}-`))
      .map((c) => Number(c.ava_name.slice(-4)))
      .filter((n) => Number.isFinite(n));
    let seq = used.length ? Math.max(...used) : 1;

    const rand = rng(ct.ava_code.split('').reduce((a, ch) => a + ch.charCodeAt(0), 0));

    for (let i = 0; i < PER_TYPE; i += 1) {
      seq += 1;
      const name = `${prefix}-2609${String(seq).padStart(4, '0')}`;

      // Spread cases across the primary stages, weighted towards the middle of the
      // lifecycle so the worklist is not dominated by intake.
      const stage = primary[Math.min(primary.length - 1, Math.floor(rand() * primary.length))];
      const stageIndex = primary.indexOf(stage);
      const isLast = stageIndex === primary.length - 1;

      const roll = rand();
      const status = isLast && roll < 0.6
        ? `Resolved-${stage.ava_name}`
        : roll < 0.15
          ? `Pending-Approval`
          : `Open-${stage.ava_name}`;
      const resolved = status.startsWith('Resolved');

      const stageSteps = (stepsByStage.get(stage.ava_lddstageid) ?? []).sort(
        (a, b) => (a.ava_sortorder ?? 0) - (b.ava_sortorder ?? 0)
      );
      const assignmentSteps = stageSteps.filter((s) => s.ava_kind === 'Assignment');
      const step = assignmentSteps[Math.floor(rand() * Math.max(1, assignmentSteps.length))] ?? stageSteps[0];

      const operator = OPERATORS[Math.floor(rand() * OPERATORS.length)];
      const priority = 10 + Math.floor(rand() * 85);
      // Roughly a fifth of the open work is already past its deadline.
      const dueHours = Math.round(-36 + rand() * 260);
      const customer = customers.length ? customers[Math.floor(rand() * customers.length)] : null;
      const txn = transactions.length ? transactions[Math.floor(rand() * transactions.length)] : null;

      const record = {
        ava_name: name,
        ava_casetypecode: ct.ava_code,
        ava_stagecode: stage.ava_stagecode,
        ava_stagename: stage.ava_name,
        ava_status: status,
        ava_urgency: urgencyLabel(priority),
        ava_priority: priority,
        ava_assignedto: operator.name,
        ava_assignmenttype: 'WorkBasket',
        ava_workbasket: WORKBASKET[ct.ava_code] ?? 'TheLending:Users',
        ava_currentstepindex: step ? stageSteps.indexOf(step) : 0,
        ava_createdbyuser: operator.name,
        ava_sladeadline: iso(dueHours),
        'ava_CaseTypeId@odata.bind': `/ava_lddcasetypes(${ct.ava_lddcasetypeid})`,
        statecode: 0,
      };
      if (resolved) record.ava_resolutioncode = 'Resolved-Completed';
      if (customer) record['ava_CustomerId@odata.bind'] = `/ava_lddcustomers(${customer.ava_lddcustomerid})`;
      if (txn) record['ava_TransactionId@odata.bind'] = `/ava_lddtransactions(${txn.ava_lddtransactionid})`;

      if (DRY_RUN) {
        console.log(`  ${name}  ${stage.ava_stagecode} ${status} urgency=${priority} due=${day(dueHours)}`);
        created += 1;
        continue;
      }

      const caseId = await upsert('ava_lddworkcases', `ava_name eq ${q(name)}`, record);
      created += 1;

      if (step && !resolved) {
        await upsert(
          'ava_lddassignments',
          `_ava_workcaseid_value eq ${caseId} and ava_name eq ${q(step.ava_name)}`,
          {
            ava_name: step.ava_name,
            ava_stepname: step.ava_name,
            ava_viewname: step.ava_viewname ?? '',
            ava_stagecode: stage.ava_stagecode,
            ava_status: 'Pending',
            ava_assignedto: operator.name,
            ava_assignmenttype: 'WorkBasket',
            ava_workbasket: WORKBASKET[ct.ava_code] ?? 'TheLending:Users',
            ava_goal: iso(Math.round(dueHours / 2)),
            ava_deadline: iso(dueHours),
            ava_assignmentdate: iso(-48 - Math.floor(rand() * 96)),
            ava_stepindex: stageSteps.indexOf(step),
            'ava_WorkCaseId@odata.bind': `/ava_lddworkcases(${caseId})`,
            statecode: 0,
          }
        );
        assignments += 1;
      }

      await upsert(
        'ava_lddcasehistories',
        `_ava_workcaseid_value eq ${caseId} and ava_eventtype eq ${q('Created')}`,
        {
          ava_name: `Case ${name} created`,
          ava_eventtype: 'Created',
          ava_tostage: stage.ava_name,
          ava_performedby: operator.name,
          ava_eventdate: iso(-72 - Math.floor(rand() * 120)),
          'ava_WorkCaseId@odata.bind': `/ava_lddworkcases(${caseId})`,
          statecode: 0,
        }
      );
    }

    console.log(`  ${ct.ava_code}: ${PER_TYPE} cases`);
  }

  console.log(`\n${DRY_RUN ? '[dry run] would create' : 'upserted'} ${created} cases, ${assignments} assignments`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
