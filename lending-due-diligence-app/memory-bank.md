# Lending Due Diligence — Memory Bank

## Project

- Path: `lending-due-diligence-app/` (repo `parclarke/LDD`)
- App name: **Lending Due Diligence** (Power Apps code app)
- Environment: **Patrick Clarke** (`158bbd11-b487-e44e-b175-46d9e2809617`)
- Org URL: https://org07a06763.crm.dynamics.com
- Solution: **Lending Due Diligence** (`LendingDueDiligence`), publisher `Avanade`, prefix `ava`
- App ID: `175161cf-c385-4c35-8b29-133f0b397d0d`
- App URL: https://apps.powerapps.com/play/e/158bbd11-b487-e44e-b175-46d9e2809617/app/175161cf-c385-4c35-8b29-133f0b397d0d
- CLI: global `pa` (`@microsoft/power-apps-cli@1.0.0`)

## Source

Converted from the Pega **CIBC Lending Due Diligence Application** (Business Control case type /
RM Escalation flow). Screens reproduce `RMEscalationFlowScreenShots.docx`; the data model follows
`Data_model_CIBCLDD_01.01.01.pdf`.

## Completed Steps

- [x] Prerequisites validated (Node 24, git, `pa` CLI)
- [x] Scaffold (`npx degit microsoft/PowerAppsCodeApps/templates/vite`)
- [x] `pa app init`
- [x] Dataverse schema provisioned into the solution (`scripts/provision-dataverse.mjs`)
- [x] Demo data seeded (`scripts/seed-data.mjs`)
- [x] 9 Dataverse data sources added
- [x] UI implemented (worklist, case creation, triage, review, response)
- [x] Deployed and end-to-end verified in the Power Apps player
- [x] Code app added to the `LendingDueDiligence` solution (9 Entities + 1 Canvas App)

## Dataverse tables (all `ava_` prefixed, all in the solution)

| Table | Purpose | Pega origin |
| --- | --- | --- |
| `ava_lddrefdata` | Queue types, channels, product types, purposes, dispositions | `AppRefData` |
| `ava_lddemployee` | Operators + manager hierarchy | `Employee` |
| `ava_lddreviewtemplate` | Review templates / SLA | `ReviewType` |
| `ava_ldderror` | Bilingual error catalogue | `Error` / `ErrorReason` |
| `ava_lddtransaction` | Lending application records | `Transaction` |
| `ava_lddcase` | Business Control case (work object) | `Work-BusinessControl` |
| `ava_lddrating` | Per-role rating & recommendation | `RatingRecommendation` |
| `ava_lddcaseerror` | Errors selected on a rating (primary flag) | `Error` list |
| `ava_lddcasetask` | Assignments / worklist entries | Pega assignments |

Lookup navigation properties: `ava_TransactionId`, `ava_CaseId`, `ava_RatingId`, `ava_ErrorId`.

## Screens

| Screen | File | Pega equivalent |
| --- | --- | --- |
| My Worklist | `screens/WorklistScreen.tsx` | All Pending Tasks |
| Business Control Cases | `screens/CaseListScreen.tsx` | case list |
| Collect transaction information | `screens/NewCaseTransactionScreen.tsx` | Initialization step 1 |
| Collect Case Parameter | `screens/NewCaseParametersScreen.tsx` | Initialization step 2 |
| Case workspace | `screens/CaseScreen.tsx` + `CaseSections.tsx` | case view + left nav |
| Triage Decision | `screens/tasks/TriageDecisionForm.tsx` | Triage assignment |
| Review Case Details | `screens/tasks/ReviewCaseDetailsForm.tsx` | Review assignment |
| Provide Response for Escalation/Coaching | `screens/tasks/ProvideResponseForm.tsx` | Branch response |

## Case lifecycle

`Initialization` → `Triage` → `Review` → `Recommendation and action`

Statuses: `New` → `Open-Triage` → `Open-Review` → `Pending-Branch Response` →
`Resolved-Review Completed` (reopenable).

## Re-running the scripts

Both scripts are idempotent and authenticate with `az account get-access-token`:

```bash
node scripts/provision-dataverse.mjs   # create/verify tables + columns + lookups
node scripts/seed-data.mjs             # upsert reference + demo data
```

## Redeploy

```bash
cd lending-due-diligence-app
npm run build && pa app push
```

## Next steps / not yet built

- Attachment List section is a placeholder (no file column yet)
- French UI toggle is presentational only (French error text is stored and displayed)
- Reversal request flow (`RM reversal request`) not implemented
- Role-based routing (Business Control vs Frontline Manager) is currently a fixed user constant in
  `src/App.tsx`; wire to `getContext()` from `@microsoft/power-apps/app` when identity is needed
