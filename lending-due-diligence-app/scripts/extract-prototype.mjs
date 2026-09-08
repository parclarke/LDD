// Extracts the Pega prototype model into a single JSON config file that the
// Dataverse seeder loads. Keeping extraction separate from loading means the
// prototype can be re-exported and re-imported without touching the seeder.
//
// Usage: node scripts/extract-prototype.mjs <prototypeDir> <out.json>
import fs from 'node:fs';
import path from 'node:path';

const [, , protoDir, outPath] = process.argv;
const model = JSON.parse(fs.readFileSync(path.join(protoDir, 'model.json'), 'utf8'));
const views = JSON.parse(fs.readFileSync(path.join(protoDir, 'raw', 'views.json'), 'utf8'));
const fieldCatalogue = JSON.parse(fs.readFileSync(path.join(protoDir, 'raw', 'fields.json'), 'utf8'));

/* ----------------------------- field metadata ----------------------------- */
// Flatten the Pega field catalogue into  class -> field -> definition.
const fieldsByClass = new Map();
for (const [name, defsRaw] of Object.entries(fieldCatalogue)) {
  for (const d of Array.isArray(defsRaw) ? defsRaw : [defsRaw]) {
    if (!d.classID) continue;
    if (!fieldsByClass.has(d.classID)) fieldsByClass.set(d.classID, new Map());
    fieldsByClass.get(d.classID).set(name, d);
  }
}

/* -------------------------------- views ---------------------------------- */
const CONTROL = {
  TextInput: 'text',
  TextArea: 'multiline',
  Dropdown: 'choice',
  Date: 'date',
  DateTime: 'datetime',
  Checkbox: 'boolean',
  Email: 'email',
  Attachment: 'attachment',
  AutoComplete: 'user',
  Combobox: 'lookup',
  Currency: 'currency',
  Decimal: 'decimal',
  Integer: 'integer',
  Percentage: 'percent',
  Phone: 'phone',
  RichText: 'multiline',
  URL: 'url',
  UserReference: 'user',
  // A reference to another data object renders as a picker.
  ObjectReference: 'lookup',
};

const propName = (v) => (typeof v === 'string' ? v.replace(/^@[A-Z_]+\s*\.?/, '').trim() : '');

function collectFields(node, acc, region) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const n of node) collectFields(n, acc, region);
    return;
  }
  if (node.type === 'Region' && node.name) region = node.name;
  const cfg = node.config ?? {};

  if (node.type && CONTROL[node.type]) {
    // An ObjectReference binds to a page (a lookup); everything else binds to .value.
    const name =
      node.type === 'ObjectReference'
        ? propName(cfg.contextPage)
        : propName(cfg.value) || propName(cfg.caption);
    if (name && !/^py(Assignment|ViewName)|^px/.test(name)) {
      acc.push({
        region: region || 'Fields',
        name,
        label: propName(cfg.label) || name,
        control: CONTROL[node.type],
        required: cfg.required === true || cfg.required === 'true',
        readOnly: cfg.readOnly === true,
        choiceSet:
          typeof cfg.datasource === 'string' && cfg.datasource.startsWith('@ASSOCIATED')
            ? cfg.datasource.replace('@ASSOCIATED', '').replace('.', '').trim()
            : null,
        targetClass: cfg.targetObjectClass ?? null,
        displayField: propName(cfg.displayField)?.split('.').pop() ?? null,
      });
    }
  }
  for (const key of ['children', 'columns']) if (node[key]) collectFields(node[key], acc, region);
}

// views.json is an object keyed by view name.
const extractedViews = [];
for (const [viewName, entry] of Object.entries(views)) {
  const root = Array.isArray(entry) ? entry[0] : entry;
  if (!root) continue;
  // Keep the business step views, not Pega's platform chrome.
  if (/^p[xyz]/.test(viewName)) continue;
  const acc = [];
  collectFields(root, acc, '');
  if (!acc.length) continue;
  extractedViews.push({
    name: viewName,
    caseTypeCode: (root.classID ?? '').replace('MyOrg-TheLending-Work-', ''),
    fields: acc,
  });
}

/* ------------------------------ case types ------------------------------- */

/**
 * Pega guards a stage-change step with a `when` condition that this export does not
 * carry (it lives inside the compiled flow rules). Left ungoverned, a backward stage
 * change inside a resolution stage loops forever.
 *
 * The guard is inferred from the decision table that immediately precedes the
 * stage-change step in the same stage: the step fires only when that decision
 * returned a result that means "more work is needed". Results are matched
 * case-insensitively by the engine.
 */
const TERMINAL_RESULTS = new Set([
  'valid',
  'resolved',
  'close case',
  'closed',
  'complete',
  'completed',
  'approved',
  'monitor',
  'monitor only',
  'no action',
]);

// name -> distinct result values, read straight off the exported decision tables.
const decisionResults = new Map(
  (model.decisions ?? []).map((d) => [
    d.name,
    [...new Set((d.rows ?? []).map((r) => r.then).filter(Boolean).concat(d.otherwise ? [d.otherwise] : []))],
  ])
);

function inferGuard(steps, index) {
  const step = steps[index];
  const isBackwardChange =
    step.impl === 'pxChangeToPreviousStage' || step.impl === 'pxChangeToSpecifiedStage';
  if (!isBackwardChange) return { guardDecision: null, guardResults: null };

  // Find the nearest preceding Decision step in the same stage.
  for (let i = index - 1; i >= 0; i -= 1) {
    if (steps[i].kind !== 'Decision') continue;
    const name = steps[i].impl;
    const results = decisionResults.get(name) ?? [];
    // Rework fires on every outcome of that table except the terminal ones.
    const rework = results.filter((r) => !TERMINAL_RESULTS.has(r.trim().toLowerCase()));
    if (!rework.length) return { guardDecision: null, guardResults: null };
    return { guardDecision: name, guardResults: rework.join(',') };
  }
  // No decision to gate on: leave ungated but the engine's revisit cap still applies.
  return { guardDecision: null, guardResults: null };
}

const caseTypes = model.caseTypes.map((ct, i) => {
  const code = ct.id.replace('MyOrg-TheLending-Work-', '');
  const classFields = fieldsByClass.get(ct.id) ?? new Map();
  return {
    code,
    name: ct.name,
    pegaClass: ct.id,
    prefix: ct.prefix ?? code.slice(0, 1),
    icon: ct.icon ?? '',
    urgency: String(ct.urgency ?? ''),
    sortOrder: i + 1,
    businessFields: [...classFields.entries()]
      .filter(([n]) => !/^p[xyz]/.test(n))
      .map(([n, d]) => ({ name: n, type: d.type, label: d.label, pageClass: d.pageClass ?? null })),
    stages: (ct.stages ?? []).map((s, si) => ({
      code: s.id,
      name: s.name,
      type: s.type,
      transition: s.transition ?? '',
      processName: s.process ?? '',
      sortOrder: si + 1,
      steps: (s.steps ?? []).map((st, sti, all) => ({
        name: st.name,
        kind: st.kind,
        impl: st.impl,
        view: st.view ?? null,
        sortOrder: sti + 1,
        routingType: st.impl === 'WorkList' ? 'WorkList' : st.impl === 'WorkBasket' ? 'WorkBasket' : null,
        notificationName: st.params?.NotificationName ?? null,
        targetStageCode: st.params?.TargetStage ?? null,
        approverType: st.params?.ApproverType ?? null,
        workbasket: st.params?.OperatorID || null,
        // A Decision step names its decision table through impl.
        decisionName: st.kind === 'Decision' ? st.impl : null,
        ...inferGuard(all, sti),
        params: st.params ?? {},
      })),
    })),
  };
});

/* ------------------------------- the rest -------------------------------- */
const choiceSets = Object.values(model.choiceSets ?? {})
  .filter((c) => !/^p[xyz]/.test(c.name))
  .map((c) => ({
    name: c.name,
    label: c.label,
    owningClass: (c.classes ?? [])[0] ?? '',
    values: c.values ?? [],
  }));

const decisions = (model.decisions ?? []).map((d) => ({
  name: d.name,
  caseTypeCode: (d.class ?? '').replace('MyOrg-TheLending-Work-', ''),
  description: d.desc ?? '',
  conditions: d.conditions ?? [],
  otherwise: d.otherwise ?? '',
  rows: (d.rows ?? []).map((r, i) => ({
    operator: r.op,
    when: r.when ?? [],
    result: r.then,
    sortOrder: i + 1,
  })),
}));

// Access groups become roles. Pega emits duplicates and platform groups; keep the
// application's own personas only.
const roles = [
  ...new Map(
    (model.security ?? [])
      .map((s) => s.accessGroup)
      .filter((g) => g.startsWith('TheLending:'))
      .map((g) => {
        const name = g.replace('TheLending:', '');
        return [name, { name, accessGroup: g, isManager: /Manager|Officer|Administrator/.test(name) }];
      })
  ).values(),
];

const dataObjects = (model.dataObjects ?? []).map((d) => ({
  class: d.class,
  short: d.short,
  label: d.label,
  fields: (d.fields ?? []).map((f) => ({ name: f.name, type: f.type, options: f.options ?? null })),
}));

const config = {
  app: model.app,
  caseTypes,
  choiceSets,
  decisions,
  roles,
  dataObjects,
  views: extractedViews,
};

fs.writeFileSync(outPath, JSON.stringify(config, null, 2), 'utf8');
console.log(
  `caseTypes=${caseTypes.length} stages=${caseTypes.reduce((n, c) => n + c.stages.length, 0)} ` +
    `steps=${caseTypes.reduce((n, c) => n + c.stages.reduce((m, s) => m + s.steps.length, 0), 0)} ` +
    `views=${extractedViews.length} choiceSets=${choiceSets.length} decisions=${decisions.length} roles=${roles.length}`
);
