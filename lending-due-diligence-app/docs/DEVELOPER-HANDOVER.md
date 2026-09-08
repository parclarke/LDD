# Lending Due Diligence - Developer Handover

This document describes what the Power Apps Code App does today, how it is put
together, and the concrete work a developer must complete before the app can
replace the Pega application in production.

- **Environment:** Patrick Clarke (`158bbd11-b487-e44e-b175-46d9e2809617`)
- **Dataverse org:** `https://org07a06763.crm.dynamics.com`
- **Solution:** `LendingDueDiligence` (publisher `Avanade`, prefix `ava`)
- **App:** `175161cf-c385-4c35-8b29-133f0b397d0d`
- **Source of truth for process:** the Pega export `myapp.zip`
  (5 case types, 39 stages, 80 steps, 24 views, 26 choice sets, 10 decision
  tables, 19 access groups)

---

## 1. Architecture

The app is a **metadata-driven case engine**. Nothing about the process is
hard-coded in React: case types, stages, steps, view layouts, choice sets and
decision tables all live as rows in Dataverse, imported from the Pega export.
Changing the process is a data change, not a code change - which is how Pega
itself behaves.

```
Pega export (myapp.zip)
        |
        |  scripts/extract-prototype.mjs
        v
prototype/ldd-prototype-config.json      <-- portable, reviewable process config
        |
        |  scripts/seed-prototype.mjs
        v
Dataverse configuration tables           <-- ava_lddcasetype, ava_lddstage, ...
        |
        |  src/lib/data.ts (generated Dataverse services)
        v
src/lib/engine.ts        pure planner - no I/O, fully unit-testable
        |
src/lib/orchestrator.ts  turns engine plans into Dataverse writes
        |
src/screens + components React UI
```

### Layer responsibilities

| Layer | File | Responsibility |
|---|---|---|
| Config extraction | `scripts/extract-prototype.mjs` | Pega JSON -> normalised config JSON |
| Config load | `scripts/seed-prototype.mjs` | Config JSON -> Dataverse (idempotent upserts) |
| Schema | `scripts/schema-v2.mjs` | The 27 Dataverse tables |
| Data access | `src/lib/data.ts` | Thin wrappers over the generated Dataverse services |
| Engine | `src/lib/engine.ts` | `planNextActions`, `evaluateDecision`, `utilityEffect`. Pure functions. |
| Orchestration | `src/lib/orchestrator.ts` | `createCase`, `advanceCase`, `submitAssignment`, `submitApproval` |
| UI | `src/screens`, `src/components` | Worklist, case list, new case, case workspace, dynamic forms |

### Data model groups

- **Configuration (10 tables)** - `ava_lddcasetype`, `ava_lddstage`,
  `ava_lddstep`, `ava_lddview`, `ava_lddviewfield`, `ava_lddchoiceset`,
  `ava_lddchoicevalue`, `ava_ldddecision`, `ava_ldddecisionrow`, `ava_lddrole`
- **Data objects (9 tables)** - customers, lending transactions, etc.
- **Work / runtime (4 tables)** - `ava_lddworkcase` (shared case envelope),
  `ava_lddassignment`, `ava_lddapproval`, `ava_lddcasehistory` (audit trail)
- **Detail (5 tables)** - one strongly-typed detail row per case type

The split between a shared `ava_lddworkcase` envelope and per-type detail tables
keeps the worklist queryable across all case types while still giving each case
type real, typed columns.

---

## 2. What the engine does

`planNextActions(record, stages, steps, options)` walks the case from its
current stage and step index and returns an ordered `EngineAction[]` that always
terminates at an assignment, an approval, or a resolution:

| Action | Meaning |
|---|---|
| `createAssignment` | Pause: a human must complete a form |
| `createApproval` | Pause: a human must approve or reject |
| `evaluateDecision` | Run a Pega decision table against the case values |
| `runUtility` | Notification / data transform / document / stage change |
| `skipStep` | A guarded stage-change step whose condition was not met |
| `changeStage` | Move to another stage |
| `resolve` | Terminal - the case is closed |

### The rework-loop guard (important)

Pega's `when` conditions on stage-change steps are **not present in the export** -
they live inside compiled flow rules in the `.jar` binaries. Without them,
`Change to previous stage` in a resolution stage fires unconditionally and the
case ping-pongs forever. Two mitigations are in place:

1. **Inferred guards.** `extract-prototype.mjs` walks backwards from each
   backward stage-change step to the nearest preceding `Decision` step, reads
   that decision table's real result values, and allows the step to fire only on
   the non-terminal ones. These land in `ava_lddstep.ava_guarddecision` and
   `ava_lddstep.ava_guardresults`. Current inferred guards:

   | Case type | Stage | Step | Decision | Fires on |
   |---|---|---|---|---|
   | ComplianceMonitoring | PRIM2 | Change to specific stage | DecisionOutcomes | Escalate Immediately, Corrective Action |
   | ComplianceMonitoring | PRIM4 | Change to specific stage | ValidateResolution | Pending Closure, Action Required, Incomplete |
   | ComplianceMonitoring | PRIM4 | Change to previous stage | ValidateResolution | Pending Closure, Action Required, Incomplete |
   | RiskAssessment | PRIM4 | Change to previous stage | OutcomeDecision | Escalated, Under Review, Pending Review |

2. **A hard re-visit cap.** `PlanOptions.maxStageRevisits` (default 2) means a
   wrong guard can never produce an infinite loop; the engine emits `skipStep`
   and carries on. `advanceCase` derives the visit counts from the
   `ava_lddcasehistory` audit trail, so the cap survives across sessions.

> **Action required:** replace the inferred guards with the real Pega `when`
> conditions. Because the guards are Dataverse rows, this is a data edit - no
> code change and no redeploy. See section 4.1.

---

## 3. What is fully working today

- All 5 case types create, advance stage by stage, and reach a resolved status.
- Assignment forms render dynamically from `ava_lddview` / `ava_lddviewfield`,
  including text, date, decimal, currency, boolean, choice (from the imported
  choice sets) and lookup (`ObjectReference`) controls.
- Approvals create an approval record and pause the case; approve/reject routes
  the case onward or into the rejection path.
- All 10 decision tables evaluate against live case data and drive routing.
- Every step writes an audit entry to `ava_lddcasehistory`.
- SLA goal/deadline are calculated in business days per step.
- Worklist, case list, new case wizard, case workspace with stage stepper,
  case summary rail and read-only section views.

**Verification:** `node scripts/verify-engine.mjs` imports the *real* shipped
`src/lib/engine.ts` and drives full lifecycles against live Dataverse.
Current result: **49 passed, 0 failed**, covering config integrity, decision
evaluation, utility classification, dry-run planning, and a live end-to-end
lifecycle for each of the 5 case types.

---

## 3a. Pega rule coverage

The export declares **6 rulesets** - `TheLending`, `MyOrg`, `MyOrgInt` and a
`_Branch_BP-1` branch of each, all at version `01-01-01`. Rulesets are Pega's
versioning containers and have no Power Platform equivalent, so what matters is
which *rules inside them* were imported. Counts below are from the export's own
`coverage.inventory` and were verified against live Dataverse row counts.

### Applied

| Pega rule type | In export | In Dataverse |
|---|---|---|
| `RULE-OBJ-CASETYPE` | 5 | 5 |
| Stages (derived from case types) | 39 | 39 |
| Steps (derived from case types) | 80 | 80 |
| `RULE-DECLARE-DECISIONTABLE` | 10 | 10 tables + 28 rows |
| `RULE-UI-VIEW` (step-bound only) | 24 of 191 | 24 views + 59 fields |
| Choice sets / `RULE-OBJ-FIELDVALUE` | 26 | 26 sets + 107 values |
| `RULE-ACCESS-ROLE-NAME` | 19 | 19 rows (**not enforced** - see 4.4) |
| `RULE-DATAOBJECT` | 10 | 9 tables |

### Not applied

| Pega rule type | Count | Why / where it is handled |
|---|---|---|
| `RULE-OBJ-FLOW` / `RULE-OBJ-FLOWACTION` | 35 / 39 | Only present in the compiled `.jar` binaries. This is where the stage-change `when` guards live - worked around by the inferred guards and the re-visit cap (section 2). |
| `RULE-NOTIFICATION` / `RULE-OBJ-CORR` | 27 / 27 | Simulated - see 4.3 |
| `RULE-OBJ-MODEL` (data transforms) | 5 | Simulated - see 4.3 |
| `RULE-ACCESS-ROLE-OBJ` (privilege grants) | 30 | Not enforced - see 4.4 |
| `DATA-ADMIN-WORKBASKET` | 18 | Held as strings; not mapped to Dataverse teams - see 4.4 |
| `RULE-OBJ-ATTACHMENTCATEGORY` | 12 | No document store wired - see 4.5 |
| `RULE-OBJ-REPORT-DEFINITION` | 30 | Reporting not in scope; use Power BI over Dataverse |
| `RULE-UI-VIEW` (remainder) | 167 | Landing pages, list views and insights that are not bound to a step |
| `RULE-UI-INSIGHT` / `RULE-PORTAL` / `RULE-PERSONA` | 30 / 3 / 16 | Portal chrome, replaced by the React UI |

### Checked and deliberately skipped

`RULE-DECLARE-EXPRESSIONS` (36) are recoverable from `raw/document.txt`. All 36
were extracted and inspected: every one sets a **literal default value**
(for example `.IsActive = true`, `.OutstandingBalance = 0`, and fixed date
constants) rather than performing a calculation. No business logic is lost by
not importing them. If Pega later adds real calculated properties, they would
need to become either Dataverse calculated columns or logic in the orchestrator.

`RULE-DECLARE-PAGES` (30) are data page definitions - the Dataverse tables and
generated services replace them.

---

## 4. What a developer must do for production

Ordered by priority. Items 4.1 to 4.4 are required; 4.5 onwards are hardening.

### 4.1 Replace the inferred stage-change guards (required)

The four guards in the table above are heuristics. Extract the real `when`
conditions from the Pega flow rules and update the corresponding
`ava_lddstep` rows (`ava_guarddecision`, `ava_guardresults`). If a guard needs
more than "last decision result is in this list" - for example a compound
expression over case fields - extend `guardAllows()` in `src/lib/engine.ts` to
evaluate an expression string, and store that expression in `ava_guardresults`.

Keep `maxStageRevisits` in place afterwards as a safety net.

### 4.2 Real user identity (required)

`src/App.tsx` currently uses a hard-coded `CurrentUser` constant. Replace it with
the Power Apps context:

```ts
import { getContext } from '@microsoft/power-apps/app';

const ctx = await getContext();
// ctx.user -> displayName, email, objectId
```

This value flows into assignment routing (`ava_assignedto`), the audit trail
(`ava_lddcasehistory.ava_performedby`) and resolution stamps, so it must be real
before any pilot.

### 4.3 Execute the simulated utility steps (required)

37 of the 80 steps are notification or data-transform utilities. They are
currently logged to the audit trail but **not executed** - see
`SIMULATED_EFFECTS` in `src/lib/orchestrator.ts`.

| Pega implementation | Count | What to build |
|---|---|---|
| `pzNotifyWrapper` | 17 | Email/Teams notification. Add the Office 365 Outlook connector (`/add-office365`) or call a Power Automate flow. Recipient comes from the step's workbasket or the assigned user. |
| `pzRunDataTransform` | 20 | Field derivation between steps. Each named transform needs its own implementation. Recommended: a `dataTransforms` registry keyed by transform name in `src/lib/transforms.ts`, dispatched from the `runUtility` branch of `advanceCase`. |
| `pxGenerateAndAttachDocument` | 4 | Document generation. Options: Power Automate + Word Online templates, or a Dataverse file column populated from a server-side template. |

Remove each `kind` from `SIMULATED_EFFECTS` as it becomes real.

### 4.4 Security: map roles to Dataverse (required)

The 19 Pega access groups are imported into `ava_lddrole` but are **not yet
enforced**. Required work:

- Create matching Dataverse security roles and map each `TheLending:*` access
  group to one.
- Set table privileges so users only see the case types they own.
- Implement workbasket routing: `ava_lddassignment.ava_workbasket` currently
  holds the Pega workbasket name as a string. Map each workbasket to a Dataverse
  team so `WorkBasket` assignments appear in the right users' worklists.
- Add row-level security on `ava_lddworkcase` (business unit or team ownership).

Until this is done every user sees every case.

### 4.5 Attachments and document storage

Attachment fields render as a plain text reference; there is no document store
wired. Add a file or image column to the detail tables, or link to SharePoint
via `/add-sharepoint`, and update `DynamicForm.tsx` to render a real upload
control for those field types.

### 4.6 SLA escalation

`ava_sladeadline` is calculated and stored per assignment but nothing acts on it.
Add a scheduled Power Automate flow (or a Dataverse job) that finds overdue
pending assignments and escalates or notifies. The urgency values from Pega are
already on `ava_lddcasetype.ava_urgency`.

### 4.7 Retire the phase-1 tables

The first iteration of this app created `ava_lddcase`, `ava_lddrating` and
related tables. They are **legacy** and unused by the current build. Confirm no
other artefact depends on them, then delete them from the solution.

### 4.8 Testing

`scripts/verify-engine.mjs` is an integration harness that needs a live
environment. Add fast unit tests around `src/lib/engine.ts` (it is pure, so this
is straightforward) covering: guard evaluation, the re-visit cap, decision
evaluation edge cases, and stage navigation from alternate stages.

### 4.9 ALM

Everything currently lives in an unmanaged solution edited directly in the dev
environment. Set up a proper pipeline: export managed, environment variables for
the org URL, and a build that runs `npm run build` plus `pa app push` per
environment.

---

## 5. Operating the app

### Re-import the process after a Pega change

```bash
cd lending-due-diligence-app
node scripts/extract-prototype.mjs <prototype-dir> prototype/ldd-prototype-config.json
node scripts/seed-prototype.mjs --no-demo      # omit --no-demo to also reseed demo cases
```

The seeder upserts by natural key, so it is safe to re-run.

### Change the schema

```bash
node scripts/gen-detail-columns.mjs            # regenerate src/lib/detail-columns.ts
LDD_SCHEMA=schema-v2.mjs node scripts/provision-dataverse.mjs
pa app add data-source --connector dataverse --table <table>   # refresh generated types
```

### Build, verify, deploy

```bash
npm run build
npm run lint
node scripts/verify-engine.mjs                 # live E2E, cleans up after itself
pa app push
```

`verify-engine.mjs` accepts `--keep` to leave its records behind for inspection.

---

## 6. Known limitations

- Guards on backward stage changes are inferred, not extracted (section 4.1).
- Notification, data transform and document generation are logged, not executed
  (section 4.3).
- Current user is hard-coded (section 4.2).
- No row-level security; all users see all cases (section 4.4).
- Attachment fields are text references only (section 4.5).
- SLA deadlines are recorded but not enforced (section 4.6).
- Unmapped Pega fields (for example `pyNote`) are reported as `skipped` by the
  detail-column mapper rather than failing the save - check the console when
  adding new fields.
