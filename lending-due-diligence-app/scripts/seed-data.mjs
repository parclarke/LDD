// Seeds demo data into the LDD Dataverse tables so the app mirrors the Pega screenshots.
// Usage: node scripts/seed-data.mjs
import { execFileSync } from 'node:child_process';

const ORG = process.env.LDD_ORG_URL || 'https://org07a06763.crm.dynamics.com';
const API = `${ORG}/api/data/v9.2`;
const TOKEN = execFileSync(
  'az',
  ['account', 'get-access-token', '--resource', ORG, '--query', 'accessToken', '-o', 'tsv'],
  { encoding: 'utf8', shell: true }
).trim();

async function call(method, path, body) {
  const res = await fetch(`${API}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json',
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
      Prefer: 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

const idKey = {
  ava_lddrefdatas: 'ava_lddrefdataid',
  ava_lddemployees: 'ava_lddemployeeid',
  ava_lddreviewtemplates: 'ava_lddreviewtemplateid',
  ava_ldderrors: 'ava_ldderrorid',
  ava_lddtransactions: 'ava_lddtransactionid',
  ava_lddcases: 'ava_lddcaseid',
  ava_lddratings: 'ava_lddratingid',
  ava_lddcaseerrors: 'ava_lddcaseerrorid',
  ava_lddcasetasks: 'ava_lddcasetaskid',
};

async function upsert(set, filter, record) {
  const existing = await call('GET', `${set}?$select=${idKey[set]}&$filter=${encodeURIComponent(filter)}&$top=1`);
  if (existing.value?.length) {
    const id = existing.value[0][idKey[set]];
    await call('PATCH', `${set}(${id})`, record);
    return id;
  }
  const created = await call('POST', set, record);
  return created[idKey[set]];
}

const q = (v) => `'${String(v).replace(/'/g, "''")}'`;

async function main() {
  // ---------- Reference data ----------
  const refs = [
    ['QueueType', 'Income Queue', "File d'attente des revenus", 1],
    ['QueueType', 'Annual Review Queue', "File d'attente de revue annuelle", 2],
    ['QueueType', 'Random Queue', "File d'attente aléatoire", 3],
    ['QueueType', 'National Queue', "File d'attente nationale", 4],
    ['QueueType', 'OICC Queue', 'File OICC', 5],
    ['Channel', 'Mobile Advice', 'Conseil mobile', 1],
    ['Channel', 'Banking Centre', 'Centre bancaire', 2],
    ['Channel', 'Broker', 'Courtier', 3],
    ['Channel', 'Direct', 'Direct', 4],
    ['ProductType', 'Mortgage', 'Prêt hypothécaire', 1],
    ['ProductType', 'Personal Loan', 'Prêt personnel', 2],
    ['ProductType', 'Line of Credit', 'Marge de crédit', 3],
    ['ProductType', 'HPP', 'PPH', 4],
    ['Purpose', 'First Time Home Buyer', "Premier acheteur d'une maison", 1],
    ['Purpose', 'Refinance CIBC Mortgage', 'Refinancement hypothèque CIBC', 2],
    ['Purpose', 'Purchase', 'Achat', 3],
    ['Purpose', 'Debt Consolidation', 'Consolidation de dettes', 4],
    ['BcDueDiligence', 'Escalation', 'Escalade', 1],
    ['BcDueDiligence', 'Coaching', 'Encadrement', 2],
    ['BcDueDiligence', 'FYI', 'Pour information', 3],
    ['BcDueDiligence', 'No Action Required', 'Aucune action requise', 4],
    ['YesNo', 'Yes', 'Oui', 1],
    ['YesNo', 'No', 'Non', 2],
    ['Source', 'Class', 'Class', 1],
    ['Source', 'RCS', 'RCS', 2],
    ['Source', 'PAT', 'PAT', 3],
    ['ReversalReason', 'Documentation subsequently provided', 'Documentation fournie ultérieurement', 1],
    ['ReversalReason', 'Error raised against wrong employee', "Erreur imputée au mauvais employé", 2],
    ['ReversalReason', 'Policy interpretation - reduced to coaching', 'Interprétation de la politique - réduit à encadrement', 3],
  ];
  for (const [type, name, fr, order] of refs) {
    await upsert(
      'ava_lddrefdatas',
      `ava_reftype eq ${q(type)} and ava_name eq ${q(name)}`,
      {
        ava_name: name,
        ava_reftype: type,
        ava_refcode: name.replace(/\s+/g, '').toUpperCase().slice(0, 40),
        ava_refvalue: name,
        ava_namefr: fr,
        ava_sortorder: order,
      }
    );
  }
  console.log(`Reference data: ${refs.length}`);

  // ---------- Employees ----------
  const employees = [
    {
      ava_name: 'Singh,Amit',
      ava_operatorid: 'AL00032',
      ava_coinsid: 'AL00032',
      ava_emailaddress: 'amit.singh@cibc.com',
      ava_jobtitle: 'Mobile Mortgage Advisor',
      ava_transit: '8700',
      ava_region: 'ONTARIO EAST',
      ava_market: 'RICHMOND HILL',
      ava_city: 'Richmond Hill',
      ava_province: 'ON',
      ava_channel: 'Mobile Advice',
      ava_manageroperatorid: 'OT00207',
      ava_managername: 'Tester',
      ava_l2manageroperatorid: 'OT00208',
      ava_l2managername: 'QAterster',
    },
    {
      ava_name: 'Tester',
      ava_operatorid: 'OT00207',
      ava_coinsid: 'OT00207',
      ava_emailaddress: 'test@cibc.com',
      ava_jobtitle: 'QA',
      ava_transit: '33037',
      ava_region: 'ONTARIO EAST',
      ava_market: 'RICHMOND HILL',
      ava_channel: 'Mobile Advice',
    },
    {
      ava_name: 'QAterster',
      ava_operatorid: 'OT00208',
      ava_coinsid: 'OT00208',
      ava_emailaddress: 'qatester@cibc.com',
      ava_jobtitle: 'QE',
      ava_transit: '33037',
      ava_region: 'ONTARIO EAST',
      ava_market: 'RICHMOND HILL',
      ava_channel: 'Mobile Advice',
    },
    {
      ava_name: 'BEL, MM01025_RSA',
      ava_operatorid: 'MM01025',
      ava_coinsid: 'MM01025',
      ava_emailaddress: 'bc.analyst@cibc.com',
      ava_jobtitle: 'Business Control Analyst',
      ava_transit: '02392',
      ava_region: 'NATIONAL',
      ava_market: 'TORONTO',
      ava_channel: 'Business Control',
    },
    {
      ava_name: 'Nguyen,Kim',
      ava_operatorid: 'AL00099',
      ava_coinsid: 'AL00099',
      ava_emailaddress: 'kim.nguyen@cibc.com',
      ava_jobtitle: 'Underwriter',
      ava_transit: '8700',
      ava_region: 'ONTARIO WEST',
      ava_market: 'MISSISSAUGA',
      ava_channel: 'Banking Centre',
      ava_manageroperatorid: 'OT00207',
      ava_managername: 'Tester',
    },
  ];
  for (const e of employees) {
    await upsert('ava_lddemployees', `ava_operatorid eq ${q(e.ava_operatorid)}`, e);
  }
  console.log(`Employees: ${employees.length}`);

  // ---------- Review templates ----------
  const templates = [
    {
      ava_name: 'RT38144 - Review template-1112',
      ava_reviewtypeid: 'RT38144',
      ava_reviewname: 'Banking Centre Loans, Lines and HPP',
      ava_queuetype: 'Income Queue',
      ava_recommendsla: 1,
      ava_activationdate: '2024-01-01',
    },
    {
      ava_name: 'RT38145 - Review template-1113',
      ava_reviewtypeid: 'RT38145',
      ava_reviewname: 'Mobile Advice Mortgages',
      ava_queuetype: 'Annual Review Queue',
      ava_recommendsla: 3,
      ava_activationdate: '2024-01-01',
    },
    {
      ava_name: 'RT38146 - Review template-1114',
      ava_reviewtypeid: 'RT38146',
      ava_reviewname: 'National Random Sampling',
      ava_queuetype: 'Random Queue',
      ava_recommendsla: 5,
      ava_activationdate: '2024-01-01',
    },
  ];
  for (const t of templates) {
    await upsert('ava_lddreviewtemplates', `ava_reviewtypeid eq ${q(t.ava_reviewtypeid)}`, t);
  }
  console.log(`Review templates: ${templates.length}`);

  // ---------- Errors ----------
  const errors = [
    {
      ava_errorcode: 'CAP-001',
      ava_category: 'Capital',
      ava_name: 'Capital \u2013 Client name not on statements used as verification',
      ava_namefr: 'Capital \u2013 Nom du client absent des relev\u00e9s utilis\u00e9s pour la v\u00e9rification',
    },
    {
      ava_errorcode: 'CAP-002',
      ava_category: 'Capital',
      ava_name: 'Capital \u2013 Down payment source not evidenced',
      ava_namefr: 'Capital \u2013 Source de la mise de fonds non justifi\u00e9e',
    },
    {
      ava_errorcode: 'CPY-001',
      ava_category: 'Capacity',
      ava_name: 'Capacity \u2013 Income calculation does not match supporting documents',
      ava_namefr: 'Capacit\u00e9 \u2013 Le calcul du revenu ne correspond pas aux documents justificatifs',
    },
    {
      ava_errorcode: 'CHR-001',
      ava_category: 'Character',
      ava_name: 'Character \u2013 Credit bureau not reviewed or documented',
      ava_namefr: 'Moralit\u00e9 \u2013 Dossier de cr\u00e9dit non examin\u00e9 ou non document\u00e9',
    },
    {
      ava_errorcode: 'COL-001',
      ava_category: 'Collateral',
      ava_name: 'Collateral \u2013 Appraisal not on file',
      ava_namefr: 'Garantie \u2013 \u00c9valuation absente du dossier',
    },
    {
      ava_errorcode: 'CND-001',
      ava_category: 'Conditions',
      ava_name: 'Conditions \u2013 Approval conditions not satisfied prior to funding',
      ava_namefr: 'Conditions \u2013 Conditions d\u2019approbation non remplies avant le financement',
    },
  ];
  const errorIds = {};
  for (const e of errors) {
    errorIds[e.ava_errorcode] = await upsert('ava_ldderrors', `ava_errorcode eq ${q(e.ava_errorcode)}`, e);
  }
  console.log(`Errors: ${errors.length}`);

  // ---------- Transactions ----------
  const transactions = [
    {
      ava_name: 'CLASS_amit9911',
      ava_source: 'Class',
      ava_applicationnumber: '991111111',
      ava_applicationdate: '2023-04-26',
      ava_approvaldate: '2023-05-05',
      ava_fundeddate: '2020-12-18',
      ava_piddescription: '599 - CONV Regular',
      ava_ciddescription: 'CID 150 - Unsecured CIBC Tenure',
      ava_status: 'In Progress',
      ava_approvaltype: 'Approve',
      ava_purpose: 'First Time Home Buyer',
      ava_propertyusage: 'Owner Occupied',
      ava_incometype: 'Self Employed',
      ava_customername: 'CRYSTAL SNIDER',
      ava_producttype: 'Mortgage',
      ava_channel: 'Mobile Advice',
      ava_transit: '8700',
      ava_mortgagenumber: '1111111',
      ava_classnumber: '991111111',
      ava_operatorid: 'AL00032',
      ava_overriderid: 'OT00207',
      ava_region: 'ONTARIO EAST',
      ava_market: 'RICHMOND HILL',
      ava_requestedamount: 620000,
      ava_fundedamount: 615000,
      ava_creditscore: 742,
      ava_loantovalue: 78.5,
      ava_gdsr: 31.2,
      ava_tdsr: 38.4,
    },
    {
      ava_name: 'CLASS_8962690_1',
      ava_source: 'Class',
      ava_applicationnumber: '8962690',
      ava_applicationdate: '2021-04-26',
      ava_approvaldate: '2021-05-05',
      ava_fundeddate: '2021-05-20',
      ava_piddescription: '599 - CONV Regular',
      ava_ciddescription: 'CID 150 - Unsecured CIBC Tenure',
      ava_status: 'In Progress',
      ava_approvaltype: 'Approve',
      ava_purpose: 'Refinance CIBC Mortgage',
      ava_propertyusage: 'Owner Occupied',
      ava_incometype: 'Self Employed',
      ava_customername: 'DAVID MORRISON',
      ava_producttype: 'Mortgage',
      ava_channel: 'Mobile Advice',
      ava_transit: '8700',
      ava_mortgagenumber: '2233445',
      ava_classnumber: '8962690',
      ava_operatorid: 'AL00032',
      ava_region: 'ONTARIO EAST',
      ava_market: 'RICHMOND HILL',
      ava_requestedamount: 410000,
      ava_fundedamount: 410000,
      ava_creditscore: 715,
      ava_loantovalue: 72.1,
      ava_gdsr: 29.8,
      ava_tdsr: 35.6,
    },
    {
      ava_name: 'CLASS_8962690_2',
      ava_source: 'Class',
      ava_applicationnumber: '8962690',
      ava_applicationdate: '2021-04-26',
      ava_approvaldate: '2021-05-05',
      ava_fundeddate: '2021-06-02',
      ava_piddescription: '599 - CONV Regular',
      ava_ciddescription: 'CID 150 - Unsecured CIBC Tenure',
      ava_status: 'In Progress',
      ava_approvaltype: 'Approve',
      ava_purpose: 'Refinance CIBC Mortgage',
      ava_propertyusage: 'Owner Occupied',
      ava_incometype: 'Self Employed',
      ava_customername: 'ANITA PATEL',
      ava_producttype: 'Mortgage',
      ava_channel: 'Mobile Advice',
      ava_transit: '8700',
      ava_mortgagenumber: '2233446',
      ava_classnumber: '8962690',
      ava_operatorid: 'AL00099',
      ava_region: 'ONTARIO WEST',
      ava_market: 'MISSISSAUGA',
      ava_requestedamount: 288000,
      ava_fundedamount: 288000,
      ava_creditscore: 689,
      ava_loantovalue: 80.0,
      ava_gdsr: 33.4,
      ava_tdsr: 41.2,
    },
    {
      ava_name: 'CLASS_7741220',
      ava_source: 'Class',
      ava_applicationnumber: '7741220',
      ava_applicationdate: '2022-09-14',
      ava_approvaldate: '2022-09-20',
      ava_fundeddate: '2022-10-01',
      ava_piddescription: '612 - HELOC Regular',
      ava_ciddescription: 'CID 210 - Secured Line of Credit',
      ava_status: 'Funded',
      ava_approvaltype: 'Approve',
      ava_purpose: 'Debt Consolidation',
      ava_propertyusage: 'Owner Occupied',
      ava_incometype: 'Salaried',
      ava_customername: 'MARC LEBLANC',
      ava_producttype: 'Line of Credit',
      ava_channel: 'Banking Centre',
      ava_transit: '00512',
      ava_mortgagenumber: '9911223',
      ava_classnumber: '7741220',
      ava_operatorid: 'AL00099',
      ava_region: 'QUEBEC',
      ava_market: 'MONTREAL',
      ava_requestedamount: 150000,
      ava_fundedamount: 150000,
      ava_creditscore: 771,
      ava_loantovalue: 55.4,
      ava_gdsr: 22.1,
      ava_tdsr: 30.9,
    },
    {
      ava_name: 'RCS_5518890',
      ava_source: 'RCS',
      ava_applicationnumber: '5518890',
      ava_applicationdate: '2023-11-02',
      ava_approvaldate: '2023-11-08',
      ava_fundeddate: '2023-11-30',
      ava_piddescription: '480 - Personal Loan',
      ava_ciddescription: 'CID 120 - Unsecured Personal Loan',
      ava_status: 'Funded',
      ava_approvaltype: 'Override',
      ava_purpose: 'Purchase',
      ava_propertyusage: 'N/A',
      ava_incometype: 'Salaried',
      ava_customername: 'JORDAN WHITE',
      ava_producttype: 'Personal Loan',
      ava_channel: 'Direct',
      ava_transit: '01188',
      ava_classnumber: '5518890',
      ava_operatorid: 'AL00032',
      ava_overriderid: 'OT00207',
      ava_region: 'PRAIRIES',
      ava_market: 'CALGARY',
      ava_requestedamount: 45000,
      ava_fundedamount: 45000,
      ava_creditscore: 654,
      ava_loantovalue: 0,
      ava_gdsr: 18.0,
      ava_tdsr: 39.9,
    },
  ];
  const txIds = {};
  for (const t of transactions) {
    txIds[t.ava_name] = await upsert('ava_lddtransactions', `ava_name eq ${q(t.ava_name)}`, t);
  }
  console.log(`Transactions: ${transactions.length}`);

  // ---------- Cases + tasks + ratings ----------
  const now = new Date();
  const iso = (offsetHours) => new Date(now.getTime() + offsetHours * 3600 * 1000).toISOString();

  const baseCase = {
    ava_queuetype: 'Income Queue',
    ava_reviewname: 'Banking Centre Loans, Lines and HPP',
    ava_reviewtemplatename: 'RT38144 - Review template-1112',
    ava_channel: 'Mobile Advice',
    ava_producttype: 'Mortgage',
    ava_purpose: 'First Time Home Buyer',
    ava_piddescription: '599 - CONV Regular',
    ava_caseowner: 'BEL, MM01025_RSA',
    ava_createdbyuser: 'BEL, MM01025_RSA',
  };

  const cases = [
    {
      ava_name: 'BC-26012600015',
      ...baseCase,
      ava_stage: 'Recommendation and action',
      ava_status: 'Pending-Branch Response',
      ava_assignedto: 'FEU, OT00207_RSA',
      ava_sladays: 1,
      ava_triagenotes: 'ok',
      ava_bcduediligence: 'Escalation',
      ava_employeeaccountable: 'Yes',
      ava_alignmentchange: false,
      ava_analystcomments: 'ok',
      ava_escalationcount: 2,
      ava_coachingcount: 6,
      ava_fyicount: 0,
      ava_mgr1operatorid: 'OT00207',
      ava_mgr1coinsid: 'OT00207',
      ava_mgr1name: 'Tester',
      ava_mgr1email: 'test@cibc.com',
      ava_mgr1jobtitle: 'QA',
      ava_mgr1transit: '33037',
      ava_mgr2operatorid: 'OT00208',
      ava_mgr2coinsid: 'OT00208',
      ava_mgr2name: 'QAterster',
      ava_mgr2email: 'qatester@cibc.com',
      ava_mgr2jobtitle: 'QE',
      ava_mgr2transit: '33037',
      ava_reviewquestion: 'Was the income documentation reviewed and validated?',
      ava_reviewanswer: 'No',
      ava_TransactionId: txIds['CLASS_amit9911'],
      task: {
        ava_name: 'Provide Response for Escalation',
        ava_taskkey: 'ProvideResponseForEscalation',
        ava_stage: 'Recommendation and action',
        ava_assignedto: 'FEU, OT00207_RSA',
        ava_status: 'Pending',
        ava_goal: iso(1),
        ava_deadline: iso(2),
        ava_assignmentdate: iso(0),
      },
      rating: {
        role: 'Lender',
        operatorid: 'AL00032',
        employee: 'Singh,Amit',
        errors: [['CAP-001', true]],
      },
    },
    {
      ava_name: 'BC-25020400001',
      ...baseCase,
      ava_stage: 'Recommendation and action',
      ava_status: 'Pending-Branch Response',
      ava_assignedto: 'FEU, OT00207_RSA',
      ava_sladays: 3,
      ava_bcduediligence: 'Coaching',
      ava_employeeaccountable: 'Yes',
      ava_analystcomments: 'Income calculation requires coaching.',
      ava_escalationcount: 0,
      ava_coachingcount: 3,
      ava_fyicount: 1,
      ava_TransactionId: txIds['CLASS_8962690_1'],
      task: {
        ava_name: 'Provide Response for Coaching',
        ava_taskkey: 'ProvideResponseForCoaching',
        ava_stage: 'Recommendation and action',
        ava_assignedto: 'FEU, OT00207_RSA',
        ava_status: 'Pending',
        ava_goal: iso(-24 * 330),
        ava_deadline: iso(-24 * 330),
        ava_assignmentdate: iso(-24 * 335),
      },
      rating: {
        role: 'Lender',
        operatorid: 'AL00032',
        employee: 'Singh,Amit',
        errors: [['CPY-001', true]],
      },
    },
    {
      ava_name: 'BC-24112900004',
      ...baseCase,
      ava_queuetype: 'Annual Review Queue',
      ava_stage: 'Recommendation and action',
      ava_status: 'Pending-Branch Response',
      ava_assignedto: 'FEU, OT00207_RSA',
      ava_sladays: 5,
      ava_bcduediligence: 'Coaching',
      ava_employeeaccountable: 'Yes',
      ava_escalationcount: 1,
      ava_coachingcount: 2,
      ava_fyicount: 0,
      ava_TransactionId: txIds['CLASS_8962690_2'],
      task: {
        ava_name: 'Provide Response for Coaching',
        ava_taskkey: 'ProvideResponseForCoaching',
        ava_stage: 'Recommendation and action',
        ava_assignedto: 'FEU, OT00207_RSA',
        ava_status: 'Pending',
        ava_goal: iso(-24 * 400),
        ava_deadline: iso(-24 * 400),
        ava_assignmentdate: iso(-24 * 405),
      },
      rating: {
        role: 'Lender',
        operatorid: 'AL00099',
        employee: 'Nguyen,Kim',
        errors: [['COL-001', true]],
      },
    },
    {
      ava_name: 'BC-24112900003',
      ...baseCase,
      ava_queuetype: 'Annual Review Queue',
      ava_stage: 'Recommendation and action',
      ava_status: 'Pending-Branch Response',
      ava_assignedto: 'FEU, OT00207_RSA',
      ava_sladays: 5,
      ava_bcduediligence: 'FYI',
      ava_employeeaccountable: 'No',
      ava_escalationcount: 0,
      ava_coachingcount: 1,
      ava_fyicount: 2,
      ava_TransactionId: txIds['CLASS_7741220'],
      task: {
        ava_name: 'Provide Response for Coaching',
        ava_taskkey: 'ProvideResponseForCoaching',
        ava_stage: 'Recommendation and action',
        ava_assignedto: 'FEU, OT00207_RSA',
        ava_status: 'Pending',
        ava_goal: iso(-24 * 400),
        ava_deadline: iso(-24 * 400),
        ava_assignmentdate: iso(-24 * 405),
      },
      rating: {
        role: 'Lender',
        operatorid: 'AL00099',
        employee: 'Nguyen,Kim',
        errors: [['CHR-001', true]],
      },
    },
    {
      ava_name: 'BC-26012600021',
      ...baseCase,
      ava_stage: 'Triage',
      ava_status: 'Open-Triage',
      ava_assignedto: 'BCGeneralWB',
      ava_TransactionId: txIds['RCS_5518890'],
      task: {
        ava_name: 'Triage Decision',
        ava_taskkey: 'TriageDecision',
        ava_stage: 'Triage',
        ava_assignedto: 'BCGeneralWB',
        ava_status: 'Pending',
        ava_assignmentdate: iso(0),
      },
      rating: null,
    },
  ];

  for (const c of cases) {
    const { task, rating, ...record } = c;
    const bind = record.ava_TransactionId;
    delete record.ava_TransactionId;
    if (bind) record['ava_TransactionId@odata.bind'] = `/ava_lddtransactions(${bind})`;
    const caseId = await upsert('ava_lddcases', `ava_name eq ${q(record.ava_name)}`, record);

    if (task) {
      await upsert(
        'ava_lddcasetasks',
        `ava_taskkey eq ${q(task.ava_taskkey)} and _ava_caseid_value eq ${caseId}`,
        { ...task, 'ava_CaseId@odata.bind': `/ava_lddcases(${caseId})` }
      );
    }

    if (rating) {
      const ratingId = await upsert(
        'ava_lddratings',
        `ava_role eq ${q(rating.role)} and _ava_caseid_value eq ${caseId}`,
        {
          ava_name: rating.role,
          ava_role: rating.role,
          ava_operatorid: rating.operatorid,
          ava_employeename: rating.employee,
          ava_bcduediligence: record.ava_bcduediligence,
          ava_employeeaccountable: record.ava_employeeaccountable,
          ava_comments: record.ava_analystcomments || '',
          ava_sortorder: 1,
          'ava_CaseId@odata.bind': `/ava_lddcases(${caseId})`,
        }
      );
      for (const [code, isPrimary] of rating.errors) {
        const err = errors.find((e) => e.ava_errorcode === code);
        await upsert(
          'ava_lddcaseerrors',
          `_ava_ratingid_value eq ${ratingId} and _ava_errorid_value eq ${errorIds[code]}`,
          {
            ava_name: err.ava_name,
            ava_namefr: err.ava_namefr,
            ava_isprimary: isPrimary,
            'ava_RatingId@odata.bind': `/ava_lddratings(${ratingId})`,
            'ava_ErrorId@odata.bind': `/ava_ldderrors(${errorIds[code]})`,
          }
        );
      }
    }
  }
  console.log(`Cases: ${cases.length}`);
  console.log('Seed complete.');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
