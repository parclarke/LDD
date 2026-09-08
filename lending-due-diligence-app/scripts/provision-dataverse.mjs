// Provisions the LDD Dataverse tables into the Lending Due Diligence solution.
// Usage: node scripts/provision-dataverse.mjs
import { execFileSync } from 'node:child_process';
const schemaModule = process.env.LDD_SCHEMA ?? './schema.mjs';
const { tables, SOLUTION } = await import(schemaModule);

const ORG = process.env.LDD_ORG_URL || 'https://org07a06763.crm.dynamics.com';
const API = `${ORG}/api/data/v9.2`;

function token() {
  const out = execFileSync(
    'az',
    ['account', 'get-access-token', '--resource', ORG, '--query', 'accessToken', '-o', 'tsv'],
    { encoding: 'utf8', shell: true }
  );
  return out.trim();
}

const TOKEN = token();

const label = (text) => ({
  '@odata.type': 'Microsoft.Dynamics.CRM.Label',
  LocalizedLabels: [
    { '@odata.type': 'Microsoft.Dynamics.CRM.LocalizedLabel', Label: text, LanguageCode: 1033 },
  ],
});

async function call(method, path, body, extraHeaders = {}) {
  const res = await fetch(`${API}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json',
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
      ...extraHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 600)}`);
    err.status = res.status;
    err.body = text;
    throw err;
  }
  return text ? JSON.parse(text) : null;
}

const solutionHeader = { 'MSCRM.SolutionUniqueName': SOLUTION };

function attrPayload(col) {
  const display = col.name
    .replace(/^ava_/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  const base = {
    SchemaName: col.name,
    DisplayName: label(display),
    RequiredLevel: { Value: 'None' },
  };
  switch (col.kind) {
    case 'string':
      return {
        ...base,
        '@odata.type': 'Microsoft.Dynamics.CRM.StringAttributeMetadata',
        MaxLength: col.len,
        FormatName: { Value: 'Text' },
      };
    case 'memo':
      return {
        ...base,
        '@odata.type': 'Microsoft.Dynamics.CRM.MemoAttributeMetadata',
        MaxLength: 4000,
        Format: 'TextArea',
      };
    case 'int':
      return {
        ...base,
        '@odata.type': 'Microsoft.Dynamics.CRM.IntegerAttributeMetadata',
        MinValue: -2147483648,
        MaxValue: 2147483647,
        Format: 'None',
      };
    case 'decimal':
      return {
        ...base,
        '@odata.type': 'Microsoft.Dynamics.CRM.DecimalAttributeMetadata',
        MinValue: -100000000000,
        MaxValue: 100000000000,
        Precision: 4,
      };
    case 'money':
      return {
        ...base,
        '@odata.type': 'Microsoft.Dynamics.CRM.MoneyAttributeMetadata',
        MinValue: -922337203685477,
        MaxValue: 922337203685477,
        Precision: 2,
        PrecisionSource: 2,
      };
    case 'datetime':
      return {
        ...base,
        '@odata.type': 'Microsoft.Dynamics.CRM.DateTimeAttributeMetadata',
        Format: 'DateAndTime',
        DateTimeBehavior: { Value: 'UserLocal' },
      };
    case 'dateonly':
      return {
        ...base,
        '@odata.type': 'Microsoft.Dynamics.CRM.DateTimeAttributeMetadata',
        Format: 'DateOnly',
        DateTimeBehavior: { Value: 'DateOnly' },
      };
    case 'bool':
      return {
        ...base,
        '@odata.type': 'Microsoft.Dynamics.CRM.BooleanAttributeMetadata',
        OptionSet: {
          '@odata.type': 'Microsoft.Dynamics.CRM.BooleanOptionSetMetadata',
          TrueOption: { Value: 1, Label: label('Yes') },
          FalseOption: { Value: 0, Label: label('No') },
        },
        DefaultValue: false,
      };
    default:
      throw new Error(`Unsupported column kind ${col.kind}`);
  }
}

async function ensureTable(t) {
  const logical = t.schema.toLowerCase();
  try {
    await call('GET', `EntityDefinitions(LogicalName='${logical}')?$select=LogicalName`);
    console.log(`  = table ${logical} already exists`);
    return;
  } catch (e) {
    if (e.status !== 404) throw e;
  }
  const payload = {
    '@odata.type': 'Microsoft.Dynamics.CRM.EntityMetadata',
    SchemaName: t.schema,
    DisplayName: label(t.display),
    DisplayCollectionName: label(t.plural),
    Description: label(t.description),
    OwnershipType: 'UserOwned',
    IsActivity: false,
    HasActivities: false,
    HasNotes: false,
    Attributes: [
      {
        '@odata.type': 'Microsoft.Dynamics.CRM.StringAttributeMetadata',
        SchemaName: t.primary.schema,
        DisplayName: label(t.primary.display),
        MaxLength: t.primary.len,
        RequiredLevel: { Value: 'ApplicationRequired' },
        IsPrimaryName: true,
        FormatName: { Value: 'Text' },
      },
    ],
  };
  await call('POST', 'EntityDefinitions', payload, solutionHeader);
  console.log(`  + created table ${logical}`);
}

async function ensureColumn(t, col) {
  const logical = t.schema.toLowerCase();
  const colLogical = col.name.toLowerCase();
  try {
    await call(
      'GET',
      `EntityDefinitions(LogicalName='${logical}')/Attributes(LogicalName='${colLogical}')?$select=LogicalName`
    );
    return 'exists';
  } catch (e) {
    if (e.status !== 404) throw e;
  }

  if (col.kind === 'lookup') {
    const relName = `ava_${col.target.replace(/^ava_/, '')}_${logical.replace(/^ava_/, '')}_${colLogical.replace(/^ava_/, '')}`;
    await call(
      'POST',
      'RelationshipDefinitions',
      {
        '@odata.type': 'Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata',
        SchemaName: relName,
        ReferencedEntity: col.target,
        ReferencingEntity: logical,
        CascadeConfiguration: {
          Assign: 'NoCascade',
          Delete: 'RemoveLink',
          Merge: 'NoCascade',
          Reparent: 'NoCascade',
          Share: 'NoCascade',
          Unshare: 'NoCascade',
        },
        Lookup: {
          '@odata.type': 'Microsoft.Dynamics.CRM.LookupAttributeMetadata',
          SchemaName: col.name,
          DisplayName: label(col.name.replace(/^ava_/, '').replace(/Id$/, '').replace(/([a-z0-9])([A-Z])/g, '$1 $2')),
          RequiredLevel: { Value: 'None' },
        },
        AssociatedMenuConfiguration: {
          Behavior: 'UseCollectionName',
          Group: 'Details',
          Order: 10000,
        },
      },
      solutionHeader
    );
    return 'created';
  }

  await call(
    'POST',
    `EntityDefinitions(LogicalName='${logical}')/Attributes`,
    attrPayload(col),
    solutionHeader
  );
  return 'created';
}

async function main() {
  console.log(`Provisioning ${tables.length} tables into solution ${SOLUTION} @ ${ORG}`);
  // Pass 1: tables + non-lookup columns
  for (const t of tables) {
    console.log(`Table ${t.schema}`);
    await ensureTable(t);
    for (const col of t.columns.filter((c) => c.kind !== 'lookup')) {
      const r = await ensureColumn(t, col);
      if (r === 'created') console.log(`    + ${col.name}`);
    }
  }
  // Pass 2: lookups (all target tables now exist)
  for (const t of tables) {
    for (const col of t.columns.filter((c) => c.kind === 'lookup')) {
      const r = await ensureColumn(t, col);
      console.log(`    ${r === 'created' ? '+' : '='} lookup ${t.schema}.${col.name} -> ${col.target}`);
    }
  }
  console.log('Done.');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

