# Lending Due Diligence — Memory Bank

## Project

- Path: `lending-due-diligence-app/` (repo `parclarke/LDD`)
- App name: **Lending Due Diligence** (Power Apps code app), version **2.0.0**
- Environment: **Patrick Clarke** (`158bbd11-b487-e44e-b175-46d9e2809617`)
- Org URL: https://org07a06763.crm.dynamics.com
- Solution: **Lending Due Diligence** (`LendingDueDiligence`), publisher `Avanade`, prefix `ava`
- App ID: `175161cf-c385-4c35-8b29-133f0b397d0d`
- App URL: https://apps.powerapps.com/play/e/158bbd11-b487-e44e-b175-46d9e2809617/app/175161cf-c385-4c35-8b29-133f0b397d0d
- CLI: global `pa` (`@microsoft/power-apps-cli@1.0.0`), Node 24

## Source

**v2 (current)** is built from the Pega prototype export `myapp.zip` — "The Lending Due
Diligence (LDD)" v01.01.01. That export contains 5 case types, 39 stages, 80 steps, 24 views,
26 choice sets, 10 decision tables and 19 access groups.

**v1** was built from the Pega Word/PDF documentation (Business Control case type / RM
Escalation flow) and reproduced `RMEscalationFlowScreenShots.docx`. Its tables
(`ava_lddcase`, `ava_lddrating`, `ava_lddcaseerror`, `ava_lddcasetask`, `ava_lddrefdata`,
`ava_lddemployee`, `ava_lddreviewtemplate`, `ava_ldderror`, `ava_lddtransaction`) are now
**legacy** and unused by the current build.

## Architecture — metadata-driven case engine

Process configuration lives in Dataverse rows imported from the prototype, so process changes
are data changes rather than code changes. Business data uses strongly-typed tables.

```
myapp.zip -> scripts/extract-prototype.mjs -> prototype/ldd-prototype-config.json
          -> scripts/seed-prototype.mjs    -> Dataverse config tables
          -> src/lib/engine.ts (pure planner) -> src/lib/orchestrator.ts (Dataverse writes)
          -> src/screens + src/components (React UI)
```

See `docs/DEVELOPER-HANDOVER.md` for the full architecture, verification results, and the
production readiness backlog.

## Dataverse tables — 28, all `ava_` prefixed, all in the solution

- **Configuration (11)** — `ava_lddcasetype`, `ava_lddstage`, `ava_lddstep`, `ava_lddview`,
  `ava_lddviewfield`, `ava_lddchoiceset`, `ava_lddchoicevalue`, `ava_ldddecision`,
  `ava_ldddecisionrow`, `ava_lddrole`, `ava_lddflowbranch`
- **Data objects (9)** — `ava_lddcustomer` and the other prototype data objects
- **Work / runtime (4)** — `ava_lddworkcase` (shared case envelope), `ava_lddassignment`,
  `ava_lddapproval`, `ava_lddcasehistory` (audit trail)
- **Detail (5)** — one strongly-typed detail table per case type

Case types: `LendingReview`, `RiskAssessment`, `ComplianceMonitoring`, `EscalationManagement`,
`QualityRecommendation`.

## Completed Steps

- [x] Prerequisites validated (Node 24, git, `pa` CLI)
- [x] Scaffold + `pa app init`
- [x] v1: 9 tables, demo data, UI, deployed and verified end to end
- [x] v2: prototype analysed; 28-table schema designed and provisioned into the solution
- [x] v2: config seeded — 26 choice sets/107 values, 19 roles, 24 views/59 fields,
      10 decisions/28 rows, 5 case types/39 stages/80 steps, plus 5 demo cases
- [x] v2: 28 Dataverse data sources added to the code app
- [x] v2: engine, orchestrator, dynamic form renderer, 5 screens, 4 components
- [x] v2: rework-loop bug fixed (inferred guards + hard stage re-visit cap)
- [x] v2: `scripts/verify-engine.mjs` — **58 passed / 0 failed** against live Dataverse
- [x] v2: built, linted clean, deployed
- [x] v2: `docs/DEVELOPER-HANDOVER.md` written

## Screens

| Screen | File | Purpose |
| --- | --- | --- |
| My Worklist | `screens/WorklistScreen.tsx` | Pending assignments across all case types |
| Cases | `screens/CaseListScreen.tsx` | All cases, filterable by type and status |
| New case | `screens/NewCaseScreen.tsx` | Pick a case type and create |
| Case workspace | `screens/CaseScreen.tsx` + `CaseSections.tsx` | Stage stepper, summary rail, forms, history |
| Assignment form | `screens/forms/AssignmentForm.tsx` | Renders any view via `DynamicForm` |
| Approval form | `screens/forms/ApprovalForm.tsx` | Approve / reject |
| Configuration | `screens/ConfigScreen.tsx` | Read-only view of the imported process metadata |

## Key implementation notes

- **Engine is pure.** `src/lib/engine.ts` has no I/O, so `scripts/verify-engine.mjs` imports it
  directly (Node 24 strips TS types natively) and tests the real shipped code.
- **Rework-loop guard.** Pega `when` conditions on stage-change steps are not in the export
  (they live in compiled `.jar` flow rules). Guards are *inferred* from the preceding decision
  table's non-terminal results into `ava_lddstep.ava_guarddecision` / `ava_guardresults`, and a
  hard `maxStageRevisits` cap (default 2) guarantees termination regardless. `advanceCase`
  derives visit counts from the `ava_lddcasehistory` audit trail.
- **Re-plan after decisions.** `advanceCase` stops executing a plan once a decision runs and
  re-plans with the fresh result so guarded steps see the correct value.
- **Detail-column mapping** is `ava_${fieldName.toLowerCase()}`; `src/lib/detail-columns.ts` is
  generated, and unmapped prototype fields (e.g. `pyNote`) are reported as `skipped` rather
  than failing the save.
- **`formMapping.ts`** exists because ESLint `react-refresh/only-export-components` forbids
  non-component exports from a component file.
- Scripts authenticate with `az account get-access-token --resource <org>`.

## Re-running the scripts

All scripts are idempotent.

```bash
node scripts/extract-prototype.mjs <prototype-dir> prototype/ldd-prototype-config.json
node scripts/seed-prototype.mjs --no-demo      # omit --no-demo to also reseed demo cases
LDD_SCHEMA=schema-v2.mjs node scripts/provision-dataverse.mjs
node scripts/verify-engine.mjs                 # live E2E; --keep leaves records behind
```

## Redeploy

```bash
cd lending-due-diligence-app
npm run build && npm run lint && pa app push
```

## Next steps / not yet built

Full detail in `docs/DEVELOPER-HANDOVER.md` section 4, with a rule-by-rule
coverage matrix in section 3a. Headlines:

- Replace the four inferred stage-change guards with the real Pega `when` conditions
- Real user identity via `getContext()` from `@microsoft/power-apps/app`
- Execute the simulated utility steps: 17 notifications, 20 data transforms, 4 document generations
- Map the 19 imported roles to Dataverse security roles + workbasket teams + row-level security
- Attachment storage, SLA escalation timers, unit tests for the engine, ALM pipeline
- Delete the legacy v1 tables
