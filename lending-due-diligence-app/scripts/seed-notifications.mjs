// Adds the recovered notification content to ava_lddstep and populates it.
//
// Source: prototype/notifications.json, produced by
//   python scripts/extract-notifications.py <export.zip> --json prototype/notifications.json
//
// The notification rules are named after their step with a _0 suffix
// (step "Acknowledge Submission" -> rule ACKNOWLEDGESUBMISSION_0), so the
// content is matched to steps on a normalised name within the same case type.
//
// Usage: node scripts/seed-notifications.mjs
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const ORG = process.env.LDD_ORG_URL || 'https://org07a06763.crm.dynamics.com';
const API = `${ORG}/api/data/v9.2`;
const SOLUTION = 'LendingDueDiligence';

const token = JSON.parse(
  execSync(`az account get-access-token --resource ${ORG}`, { encoding: 'utf8' })
).accessToken;

async function call(method, path, body, prefer = 'return=representation') {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'OData-MaxVersion': '4.0',
    'OData-Version': '4.0',
    'MSCRM.SolutionUniqueName': SOLUTION,
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

async function addColumn(schema, display, maxLength, format) {
  const attr = {
    '@odata.type': '#Microsoft.Dynamics.CRM.StringAttributeMetadata',
    SchemaName: schema,
    MaxLength: maxLength,
    RequiredLevel: { Value: 'None' },
    DisplayName: {
      '@odata.type': '#Microsoft.Dynamics.CRM.Label',
      LocalizedLabels: [
        { '@odata.type': '#Microsoft.Dynamics.CRM.LocalizedLabel', Label: display, LanguageCode: 1033 },
      ],
    },
  };
  if (format) attr.FormatName = { Value: format };
  try {
    await call('POST', "EntityDefinitions(LogicalName='ava_lddstep')/Attributes", attr, null);
    console.log(`  + ${schema}`);
  } catch (err) {
    if (/already exists|duplicate/i.test(err.message)) console.log(`  = ${schema} already exists`);
    else throw err;
  }
}

const norm = (s) => String(s).toUpperCase().replace(/[^A-Z0-9]/g, '');

async function main() {
  const file = 'prototype/notifications.json';
  if (!fs.existsSync(file)) {
    console.error(`Missing ${file}. Run scripts/extract-notifications.py first.`);
    process.exit(1);
  }
  const notes = JSON.parse(fs.readFileSync(file, 'utf8'));
  const usable = notes.filter((n) => n.subject && n.body);
  if (!usable.length) {
    console.error('No notification content in the file - refusing to seed.');
    process.exit(1);
  }

  console.log(`Adding notification columns to ava_lddstep in ${ORG}`);
  await addColumn('ava_NotifySubject', 'Notification Subject', 250);
  await addColumn('ava_NotifyBody', 'Notification Body', 4000, 'TextArea');

  console.log('\nMatching notification content to steps...');
  const steps = (
    await call('GET', "ava_lddsteps?$filter=ava_impl eq 'pzNotifyWrapper'&$top=200")
  ).value;

  let matched = 0;
  const unmatched = [];
  for (const step of steps) {
    const want = norm(step.ava_name);
    const hit = usable.find((n) => {
      const rule = norm(n.name).replace(/0$/, '');
      return rule === want;
    });
    if (!hit) {
      unmatched.push(step.ava_name);
      continue;
    }
    await call(
      'PATCH',
      `ava_lddsteps(${step.ava_lddstepid})`,
      { ava_notifysubject: hit.subject, ava_notifybody: hit.body },
      'return=minimal'
    );
    matched += 1;
  }

  console.log(`\nnotification steps : ${steps.length}`);
  console.log(`content applied    : ${matched}`);
  if (unmatched.length) console.log(`unmatched          : ${unmatched.join(', ')}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
