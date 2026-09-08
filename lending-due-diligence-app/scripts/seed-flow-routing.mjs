// Loads the decision branch routing extracted from the Pega flow rule bodies
// into Dataverse, so the engine reads real routing rather than inferring it.
//
// Source: prototype/flow-routing.json, produced by
//   python scripts/extract-decision-routing.py <export.zip> --json prototype/flow-routing.json
//
// Usage: node scripts/seed-flow-routing.mjs [--file prototype/flow-routing.json]
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const ORG = process.env.LDD_ORG_URL || 'https://org07a06763.crm.dynamics.com';
const API = `${ORG}/api/data/v9.2`;

const fileFlag = process.argv.indexOf('--file');
const FILE =
  fileFlag !== -1 && process.argv[fileFlag + 1]
    ? process.argv[fileFlag + 1]
    : 'prototype/flow-routing.json';

const token = JSON.parse(
  execSync(`az account get-access-token --resource ${ORG}`, { encoding: 'utf8' })
).accessToken;

async function call(method, path, body, prefer = 'return=representation') {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'OData-MaxVersion': '4.0',
    'OData-Version': '4.0',
  };
  if (body) headers['Content-Type'] = 'application/json';
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${API}/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

async function upsert(set, filter, body) {
  const found = await call('GET', `${set}?$filter=${encodeURIComponent(filter)}&$top=1`);
  const rows = found?.value ?? [];
  if (rows.length) {
    const id = rows[0][`${set.slice(0, -1)}id`];
    await call('PATCH', `${set}(${id})`, body, 'return=minimal');
    return id;
  }
  const created = await call('POST', set, body);
  return created[`${set.slice(0, -1)}id`];
}

async function main() {
  if (!fs.existsSync(FILE)) {
    console.error(`Missing ${FILE}. Run scripts/extract-decision-routing.py first.`);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const withDecision = data.flows.filter((f) => f.decision && f.stage);

  if (!withDecision.length) {
    console.error('No decision-bearing flows in the routing file - refusing to seed.');
    process.exit(1);
  }

  console.log(`Seeding decision routing from ${FILE} into ${ORG}\n`);
  let branches = 0;
  let terminal = 0;

  for (const flow of withDecision) {
    const [caseTypeCode, stageCode, stageName] = flow.stage;
    let order = 1;
    for (const e of flow.edges) {
      if (e.when !== 'STATUS' || !e.result) continue;
      const isTerminal = String(e.to || '').startsWith('END');
      const name = `${caseTypeCode}/${stageCode}/${e.result}`;
      await upsert('ava_lddflowbranchs', `ava_name eq ${q(name)}`, {
        ava_name: name,
        ava_casetypecode: caseTypeCode,
        ava_stagecode: stageCode,
        ava_stagename: stageName,
        ava_decisionname: flow.decision,
        ava_resultvalue: e.result,
        ava_targettask: e.to ?? '',
        ava_transitionid: e.id ?? '',
        ava_isterminal: isTerminal,
        ava_sortorder: order++,
        statecode: 0,
      });
      branches += 1;
      if (isTerminal) terminal += 1;
    }
  }

  console.log(`flows with routing: ${withDecision.length}`);
  console.log(`branches seeded   : ${branches}`);
  console.log(`  terminal        : ${terminal} (these end the stage early)`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
