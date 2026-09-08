// Adds the step-guard columns to ava_LddStep.
//
// Pega guards a stage-change step with a `when` condition that the prototype export
// does not carry (it lives inside the compiled flow rules). Without a guard, a
// backward stage change in a resolution stage loops forever. These two columns make
// the guard explicit configuration:
//
//   ava_GuardDecision - the decision table whose result gates this step
//   ava_GuardResults  - comma-separated results that allow the step to fire
//
// Usage: node scripts/add-step-guard-columns.mjs
import { execFileSync } from 'node:child_process';

const ORG = process.env.LDD_ORG_URL || 'https://org07a06763.crm.dynamics.com';
const API = `${ORG}/api/data/v9.2`;
const SOLUTION = 'LendingDueDiligence';

const TOKEN = execFileSync(
  'az',
  ['account', 'get-access-token', '--resource', ORG, '--query', 'accessToken', '-o', 'tsv'],
  { encoding: 'utf8', shell: true }
).trim();

const label = (text) => ({
  '@odata.type': 'Microsoft.Dynamics.CRM.Label',
  LocalizedLabels: [
    { '@odata.type': 'Microsoft.Dynamics.CRM.LocalizedLabel', Label: text, LanguageCode: 1033 },
  ],
});

async function call(method, path, body) {
  const res = await fetch(`${API}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json',
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
      'MSCRM.SolutionUniqueName': SOLUTION,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  return text ? JSON.parse(text) : null;
}

const COLUMNS = [
  { schema: 'ava_GuardDecision', display: 'Guard Decision', len: 100 },
  { schema: 'ava_GuardResults', display: 'Guard Results', len: 500 },
];

for (const col of COLUMNS) {
  const logical = col.schema.toLowerCase();
  try {
    await call(
      'GET',
      `EntityDefinitions(LogicalName='ava_lddstep')/Attributes(LogicalName='${logical}')?$select=LogicalName`
    );
    console.log(`= ${col.schema} already exists`);
    continue;
  } catch (e) {
    if (e.status !== 404) throw e;
  }
  await call('POST', `EntityDefinitions(LogicalName='ava_lddstep')/Attributes`, {
    '@odata.type': 'Microsoft.Dynamics.CRM.StringAttributeMetadata',
    SchemaName: col.schema,
    DisplayName: label(col.display),
    MaxLength: col.len,
    RequiredLevel: { Value: 'None' },
    FormatName: { Value: 'Text' },
  });
  console.log(`+ ${col.schema}`);
}

console.log('Done.');
