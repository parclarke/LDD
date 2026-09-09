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

### Why the app is built this way

The client's binding constraint is **requirements elicitation**, not migration
cost. A conventional migration opens with weeks of business workshops to
rediscover what an application already does; this business does not have the
time for that. The whole approach is therefore built to treat **the running
system as the specification** and to reverse-engineer it from artefacts the
Pega estate already holds.

Four artefact sources, none needing a workshop to produce:

| # | Source | How it is obtained | Contributes |
|---|---|---|---|
| 1 | Application export (`.zip`) | Dev Studio product export | SQL schema, rule inventory, and (decoded as UTF-16BE) the flow rule bodies - see section 3b |
| 2 | Application documentation (`.docx`) | Generated from the platform | Stages, flows, decision table logic, security model |
| 3 | pegakit + Pega DX API | Client-credentials OAuth against a sandbox | Screens, fields, choice values, theme - the largest single uplift |
| 4 | Screenshots of the running app | Captured from the live system | Visual fidelity for a like-for-like rebuild |

Everything in the configuration tables below came from those four sources with
**zero business workshops**. The residual 41 step bodies (section 4.3) still
need business input, but each is recovered by name and position, so that
conversation is confirmation rather than discovery.

### Solution architecture

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
| Schema | `scripts/schema-v2.mjs` | The 29 Dataverse tables |
| Data access | `src/lib/data.ts` | Thin wrappers over the generated Dataverse services |
| Engine | `src/lib/engine.ts` | `planNextActions`, `evaluateDecision`, `utilityEffect`. Pure functions. |
| Orchestration | `src/lib/orchestrator.ts` | `createCase`, `advanceCase`, `submitAssignment`, `submitApproval` |
| UI | `src/screens`, `src/components` | Worklist, case list, new case, case workspace, dynamic forms |

### Data model groups

- **Configuration (11 tables)** - `ava_lddcasetype`, `ava_lddstage`,
  `ava_lddstep`, `ava_lddview`, `ava_lddviewfield`, `ava_lddchoiceset`,
  `ava_lddchoicevalue`, `ava_ldddecision`, `ava_ldddecisionrow`, `ava_lddrole`
- **Data objects (9 tables)** - customers, lending transactions, etc.
- **Work / runtime (5 tables)** - `ava_lddworkcase` (shared case envelope),
  `ava_lddassignment`, `ava_lddapproval`, `ava_lddcasehistory` (audit trail),
  `ava_lddnotification` (delivery outbox)
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

Pega's `when` guards on stage-change steps are **not present in the export**.
Without them, `Change to previous stage` in a resolution stage fires
unconditionally and the case ping-pongs forever. Two mitigations are in place:

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

> **Update:** the flow rule bodies were subsequently extracted (section 3b) and
> contain **no** conditional transitions at all. The guards were never missing -
> they do not exist in the source application. The re-visit cap is therefore
> permanent design, and the inferred guards need business validation rather than
> technical recovery.

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
Current result: **58 passed, 0 failed**, covering config integrity, decision
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
| `RULE-OBJ-MODEL` (5) | 5 | Case-type field allow-lists, not data transforms - see 4.3a |
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

### Confirmed by the extraction tool

pegakit's own documentation lists what no Pega artefact exposes:

- Data transform logic (`pzRunDataTransform` steps) - **but see 4.3a: this
  export has none authored, and in a real app they should be recoverable**
- Email / correspondence bodies
- Dashboard and insight definitions
- AI agent prompts and tool bindings

> "Rule bodies in the export (`instances_*.bin`) are a proprietary binary format
> and cannot be decoded outside a Pega instance."

**That last claim is wrong, and this project originally repeated it.** See
section 3b.

---

## 3b. Flow rule bodies ARE recoverable

`instances_*.bin` inside `rules.jar` is a Java-serialised stream whose **payload
strings are UTF-16BE**. An ASCII scan of the file finds nothing, which is why
the format is widely assumed to be opaque. Decoding the member as UTF-16BE makes
the rule bodies directly readable - no Pega instance, no Dev Studio, no
proprietary tooling.

`scripts/extract-flow-rules.py` does this. Run it against the raw export:

```bash
python scripts/extract-flow-rules.py <TheLending.zip> --json flow-rules.json
```

### What the extraction shows

| Measure | Result |
|---|---|
| Flow rules in the export index | 35 |
| Flow bodies recovered | 28 |
| Connector transitions found | 264 |
| ... of type `Always` | 225 |
| ... of type `Action` | 32 |
| ... of type `Else` | 7 |
| **Conditional (`when`-guarded) transitions** | **0** |

The extractor also recovers the stage-change targets directly, for example
ComplianceMonitoring's `pxChangeToSpecifiedStage` resolving to `PRIM3` - which
matches the value this project had inferred independently.

### Why this matters more than the extraction itself

The working assumption throughout was that the rework-loop guards existed in
Pega and were merely unreachable. **They do not exist.** Every connector in the
exported application is unconditional. The source application really would
ping-pong between its resolution and remediation stages; the defect is in the
Pega application, not in the migration.

Three consequences:

1. The inferred guards are **not** a stopgap awaiting the real conditions. There
   are no real conditions. They are a genuine design decision that has to be
   validated against business intent, not recovered from a rule.
2. The engine's stage re-visit cap is **permanent, load-bearing design**, not a
   temporary safety net.
3. Phase 1 effort for "guard and flow logic recovery" drops sharply - the
   recovery is done, and what remains is a business conversation about what the
   rework conditions *should* be.

Note this application was generated (operator `patrick.a.a.clarke@avanade.com`,
created 2026-08-10), so unconditional connectors may be an artefact of how it
was produced. Re-run the extractor against any real candidate application before
assuming the same holds.

---

## 3c. Decision routing extracted from the flow rules

Every Decision shape in a Pega flow has one outgoing connector per decision-table
result, and the connector records which result selects it. Those connectors are
in the flow bodies, so the app no longer has to guess what a decision result
does next.

`scripts/extract-decision-routing.py` recovers them:

```bash
python scripts/extract-decision-routing.py <export.zip> --json prototype/flow-routing.json
node scripts/seed-flow-routing.mjs
```

The parser is positional, so its output is **validated against the decision
table that each flow's stage actually uses** - a branch is kept only if its
result is a real result of its own decision. Candidates that fail are discarded
rather than trusted, and the kept-versus-candidate counts are printed so a weak
extraction is obvious.

| Measure | Result |
|---|---|
| Flows with a transition graph | 35 (all of them) |
| Flows containing a Decision | 7 |
| Branches kept | 26 of 87 candidates |
| Validation | 100% - every kept result is a real result of its own decision |
| Branches that terminate the stage | 2 |

Seeded into `ava_lddflowbranch` and surfaced in the app's **Process model ->
Flow routing** tab.

### What this changed in the engine

Two decision results route to an END shape, which in Pega completes the stage's
flow:

| Case type | Stage | Decision | Result | Effect |
|---|---|---|---|---|
| ComplianceMonitoring | Issue Assessment | DecisionOutcomes | `No Action` | ends the stage |
| LendingReview | Review Assessment | EscalateComplexIssues | `No Escalation` | ends the stage |

Both are the decision's `otherwise` default: when nothing matched, there is
nothing to do, so the process ends. The engine previously ran the remaining
steps of the stage regardless. `isTerminalResult()` in `src/lib/engine.ts` now
skips them, and `verify-engine.mjs` asserts both the positive and the negative
case - a non-terminal result of the same decision must *not* end the stage.

### What is deliberately not wired in

The other 24 branches name a target shape (`Utility3`, `Assignment1_2`). Those
shape IDs cannot be mapped to config steps safely: the flows contain more shapes
than the extracted step list, so an ordinal mapping would be a guess. Wiring
routing on a guess would be worse than the current honest sequential execution.
They are stored and displayed so a developer can use them, but the engine does
not act on them.

To go further, resolve shape ID to step name from the `pyShapes` region of the
flow body and extend the engine to jump to a named step.

## 4. What a developer must do for production

Ordered by priority. Items 4.1 to 4.4 are required; 4.5 onwards are hardening.

### 4.1 Validate the stage-change guards with the business (required)

**This item changed twice - see sections 3b and 3c.** The original plan was to
recover the real `when` conditions from Dev Studio. Extraction of the flow rule
bodies shows there is nothing of that kind to recover: **all 264 connector
transitions are unconditional** (225 `Always`, 32 `Action`, 7 `Else`).

What the flow bodies *do* contain is the **decision branch routing** - which
decision result routes to which shape. That is now extracted, validated and
seeded (section 3c), and it corroborates the four inferred guards: in both
guarded stages every decision result routes to a distinct target, and the
result the guard treats as "done" (`Valid`, `Resolved`) has its own target
separate from the rework ones.

So the guards are a design decision, and the remaining work is a **business
conversation**: confirm with SMEs when a case *should* return to a previous
stage for rework, then encode that in `ava_guarddecision` / `ava_guardresults`.

Keep `maxStageRevisits` permanently. Since the source application's transitions
are unconditional, the cap is the only structural guarantee that a case
terminates - it is load-bearing, not a safety net.

If a guard needs more than "last decision result is in this list" - for example
a compound expression over case fields - extend `guardAllows()` in
`src/lib/engine.ts` to evaluate an expression string, and store that expression
in `ava_guardresults`.

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

41 of the 80 steps are notification, data-transform or document utilities. They
are currently logged to the audit trail but **not executed** - see
`SIMULATED_EFFECTS` in `src/lib/orchestrator.ts`.

| Pega implementation | Count | What to build |
|---|---|---|
| `pzNotifyWrapper` | 17 | Email/Teams notification. Add the Office 365 Outlook connector (`/add-office365`) or call a Power Automate flow. Recipient comes from the step's workbasket or the assigned user. |
| `pzRunDataTransform` | 20 | Field derivation between steps. Recommended: a `dataTransforms` registry keyed by transform name in `src/lib/transforms.ts`, dispatched from the `runUtility` branch of `advanceCase`. **See 4.3a - in this prototype there is no logic to port.** |
| `pxGenerateAndAttachDocument` | 4 | Document generation. Options: Power Automate + Word Online templates, or a Dataverse file column populated from a server-side template. |

Remove each `kind` from `SIMULATED_EFFECTS` as it becomes real.

### 4.3a Data transforms: what they are, and what is in this export

**If you come from Power Platform**, a Pega *data transform* (rule type
`Rule-Obj-Model`) is closest to a **Power Automate flow made only of Compose and
Set variable actions** - or to the mapping code you would write in a plugin or
just before a Dataverse save. It is a declarative list of assignments:

```
.CaseOwner        = .LendingTransaction.RelationshipManager
.RiskCategory     = "Standard"
.TotalExposure    = .PrincipalAmount + .OutstandingBalance
.ReviewDueDate    = @addDays(.SubmittedDate, 5)
```

No UI, no user, no branching to speak of. It copies, defaults, derives and
converts field values. In a case lifecycle it appears as a
`pzRunDataTransform` **utility step**, sitting between two human steps and
running unattended - the direct equivalent of a Power Automate action that runs
between two approvals.

Rough equivalence table:

| Pega data transform does | In Power Platform you would use |
|---|---|
| Copy a value from a related record | A lookup + `Set variable`, or an expression in the app |
| Default a field on case creation | A column default, or logic in `createCase` |
| Derive a field from two others | A Dataverse **calculated column**, or a formula column |
| Aggregate child rows | A Dataverse **rollup column** |
| Convert or format a value | An expression in the app or flow |
| Anything with real branching | A Power Automate flow, or code in `orchestrator.ts` |

**This export contains no authored data transforms.** Verified against the rule
inventory:

| Check | Result |
|---|---|
| Steps calling `pzRunDataTransform` | 20 |
| `RULE-OBJ-MODEL` instances in the export | 5 |
| ... of which are data transforms | **0** - all 5 are `ALLOWEDSTARTINGFIELDS`, which are case-type field allow-lists, not process logic |
| Transform rules matching a step name (e.g. `VERIFYINFORMATION`) | **0** |

The shapes declare a `DataTransformName` parameter but it is never bound to a
rule. The names visible in the flow bodies - *Verify Information*, *Analyze
Records*, *Assign Case Owner* - are **shape display names**, not rule
references.

So the 20 transform steps in this application are **named placeholders with no
behaviour**. There is nothing to port, and the app's current behaviour (log the
step, carry on) is faithful to what the source application actually does.

#### Would Dev Studio show a developer anything more?

This is the obvious challenge, and it is a fair one: if the logic is not in the
export, surely a developer could open Dev Studio and read it there? For this
application the answer is **no, because the rules do not exist to be read**.

| Evidence | Result |
|---|---|
| Is the export complete, or a partial slice? | **Complete** - 6,872 instances matching the manifest's `Instance-Count`, across all application rulesets (`TheLending`, `MyOrg`, `MyOrgInt` and their branches) |
| Does the export carry rule *bodies*, or only headers? | **Bodies** - notification email text, decision table results, 264 flow connector transitions and case type descriptions were all recovered from it |
| Do the 20 transform steps resolve to a transform rule? | **0 of 20.** Two step names appeared to match something in the rule index, but `IdentifyGaps` is a `RULE-DECLARE-DECISIONTABLE` and `Compliance Check` matched a `RULE-OBJ-PROPERTY` - name collisions, not transforms |
| Are the 4 document steps configured? | **No.** Pega's own design-time warning on every `pxGenerateAndAttachDocument` shape reads *"This field cannot be blank"* against `pzRuleParamsHolder.pyDocumentName` |

The last row is the strongest evidence, because it is Pega's own verdict rather
than an inference from the export: the platform flagged these shapes as
unconfigured at design time. A developer opening them in Dev Studio would see
that same warning and an empty field.

So there is no source implementation to port, and nothing a developer can read
and translate. Someone has to decide what the step should do - and "what should
this step do?" is a business question by definition. That is what
`needs_business_input = 24` counts: **not** work being pushed onto the business,
but work that has no technical source to draw on.

> **This finding is specific to this application.** It was generated rather than
> hand-built, which is why the shells are empty. For a real hand-built
> application, expect the opposite - and note that the UTF-16BE technique in
> section 3b reads rule bodies straight out of the export, so even then Dev
> Studio is a convenience rather than a necessity.

#### What a developer does about them

Nothing, until the business says what each should do. When they do, the decision
is where to put the logic, and the Power Platform answer is usually *not* code:

1. **Derived from other columns on the same row** -> Dataverse calculated column.
   No app change at all.
2. **Aggregated from child rows** -> Dataverse rollup column.
3. **Copied from a related record on save** -> handle it in the form save path.
4. **Genuinely procedural, or calls something external** -> a `dataTransforms`
   registry keyed by step name in `src/lib/transforms.ts`, dispatched from the
   `runUtility` branch of `advanceCase`. That is the hook point; the branch
   already receives the step, so adding a lookup there is a small change.

Prefer 1 and 2 wherever the logic fits, because they need no deployment and stay
visible to makers.

> **For a real client application, expect the opposite.** Authored data
> transforms are `Rule-Obj-Model` rules and live in the same `rules.jar` as the
> flow rules, so the UTF-16BE technique in section 3b should recover their
> assignment lists too. That would move much of this workstream from workshops
> to extraction. It could not be tested here because this application has none -
> validate it against the first real candidate before relying on it in an
> estimate.

### 4.3b Notifications: content recovered, delivery is one Power Automate flow

Pega notifications are three linked rules, all present in `rules.jar` and all
readable with the UTF-16BE technique:

| Rule | Holds |
|---|---|
| `Rule-Notification` | the notification bound to a flow step |
| `Rule-Obj-FieldValue` `PYNOTIFICATIONMESSAGE!<name>` | the subject line, in `pyLocalizedValue` |
| `Rule-Obj-Corr` `<name>!EMAIL` | the full email body, in `pySourceStream` |

`scripts/extract-notifications.py` recovers all three:

```bash
python scripts/extract-notifications.py <export.zip> --json prototype/notifications.json
node scripts/seed-notifications.mjs
```

| Measure | Result |
|---|---|
| Notification rules in the export | 27 |
| Subject lines recovered | **27 of 27** |
| Email bodies recovered | **27 of 27** |
| Notification steps in the case model | 17 |
| Steps matched to recovered content | **17 of 17** |

Example - ComplianceMonitoring / *Acknowledge Submission*:

> **Submission Confirmation**
>
> Dear Business Controls Team, This message confirms that lending activity
> records have been successfully submitted for compliance monitoring and intake
> review. Your submission has been received and logged into our system for
> processing...

#### How delivery works: the outbox pattern

The code app runs in the user's browser. It must not hold mail credentials or
own retries, so it does not send anything itself. Instead it uses a standard
**outbox**:

```
Case reaches a pzNotifyWrapper step
        |
        |  orchestrator.ts -> queueNotification()
        v
ava_lddnotification row, ava_Status = 'Pending'
        |
        |  Power Automate: "When a row is added" (Dataverse)
        v
Flow resolves the recipient, sends the mail
        |
        v
Flow patches the row: ava_Status = 'Sent' | 'Failed', ava_SentOn, ava_ErrorMessage
```

**This half is already built.** The app writes the Pending row, with the subject
and body recovered from Pega already populated. What a developer adds is one
flow.

The table, by every name you will need:

| Where you see it | Name |
|---|---|
| Flow designer / maker portal | **LDD Notifications** |
| Logical name | `ava_lddnotification` |
| Schema name | `ava_LddNotification` |
| Entity set (Web API) | `ava_lddnotifications` |
| Primary key / primary name | `ava_lddnotificationid` / `ava_name` |

> **Check the entity set name before writing any Web API call.** Dataverse
> pluralised this one correctly, but it derives the set name naively: the flow
> branch table `ava_lddflowbranch` became `ava_lddflowbranch**s**`, which is what
> a seeder in this repo hit as a 404. Confirm with
> `EntityDefinitions(LogicalName='<table>')?$select=EntitySetName` rather than
> assuming. Note also that metadata entities do not support `startswith`, so
> filter the attribute list client-side.

| Column | Written by | Contains |
|---|---|---|
| `ava_subject` | app | recovered Pega subject |
| `ava_body` | app | recovered Pega email body |
| `ava_recipientrole` | app | the step's workbasket, e.g. `TheLending:Users` |
| `ava_recipient` | **flow** | resolved address - blank on insert |
| `ava_casenumber` / `ava_casetypecode` / `ava_stepname` | app | context for routing and logging |
| `ava_status` | app then flow | `Pending` -> `Sent` / `Failed` |
| `ava_senton`, `ava_errormessage` | flow | delivery outcome |
| `ava_workcaseid` | app | lookup to the case |
| `ava_queuedon` | app | when the case raised it |

**The flow to build** - one flow covers all 17 notification steps, because the
content travels on the row:

1. Trigger: **When a row is added** (Dataverse) on **LDD Notifications**,
   filtered to `ava_status eq 'Pending'`
2. Resolve the recipient from `ava_recipientrole` - a lookup from workbasket to
   a Dataverse team or a distribution list. **This is the one piece the Pega
   export does not carry**, so it needs a business decision (section 4.4)
3. Send an email (Office 365 Outlook) using `ava_subject` and `ava_body`
4. Update the row: `ava_status = 'Sent'`, `ava_senton = utcNow()`
5. Configure run-after on failure: `ava_status = 'Failed'`, write
   `ava_errormessage`

Because the send is decoupled, failures are visible and re-runnable in
Dataverse, and the app is unaffected if mail is down. Queued and sent rows are
visible per case under **Notifications** in the case workspace.

The environment is seeded with demo rows in both states, so a new flow can be
pointed at the table and tested without first driving a case through a
notification step.

> `SIMULATED_EFFECTS` in `orchestrator.ts` still lists `notify`, which now only
> affects the wording of the audit entry. Remove it once the flow is live.

### 4.3c Reports: no logic to port, but the capability was still needed

The export's 30 `RULE-OBJ-REPORT-DEFINITION` instances are **all
platform-generated scaffolding**, not authored business reports:

| Report name | Count | What it is |
|---|---|---|
| `DATATABLEEDITORREPORT` | 15 | Pega's auto-generated "edit this data table" grid, one per class |
| `DATATABLEEDITORREPORTBYPARENTKEY` | 5 | The same, filtered by parent record |
| `PYDEFAULTREPORT` | 5 | Pega's default work-list report, one per case type |
| `PYDEFAULTSUMMARYREPORT` | 5 | Pega's default summary report, one per case type |

All carry `pzIsAutoGenerated`. There are **zero** hand-built reports, so no
report logic needed porting and none was elicited from the business.

**But "no logic to port" is not the same as "no capability needed".** Those 30
rules still gave Pega users three things, and only one of them was covered:

| Pega capability | Count | Covered by |
|---|---|---|
| List cases of a type | 5 | `CaseListScreen` - already present |
| Summarise cases by status | 5 | **Was missing** - now `InsightsScreen` |
| Browse reference data tables | 10 (Data- classes) | **Was missing** - now `InsightsScreen` |

`src/screens/InsightsScreen.tsx` closes that gap with three tabs:

- **Case summary** - totals per case type, split open/resolved, with open cases
  broken down by the stage they are sitting in
- **SLA and ageing** - open cases bucketed past-deadline / due-within-two-days /
  on track, computed against a snapshot taken at load time
- **Reference data** - a read-only browser over the seven data-object tables,
  with columns chosen from whichever fields are actually populated

For richer analytics, Power BI over Dataverse is the natural route; this screen
covers the in-app equivalent of what Pega generated for free.


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

> **Check the extraction fidelity first.** See "Prototype provenance" below. A
> low-fidelity re-extraction will silently wipe out views and choice sets.

```bash
cd lending-due-diligence-app
node scripts/extract-prototype.mjs <prototype-dir> prototype/ldd-prototype-config.json
node scripts/seed-prototype.mjs --no-demo      # omit --no-demo to also reseed demo cases
```

The seeder upserts by natural key, so it is safe to re-run.

### Prototype provenance (read before re-extracting)

The `myapp` prototype directory is produced by **pegakit**, a Python tool that
extracts a Pega application into `model.json` plus a static analysis site. It
accepts three independent sources and **the fidelity of its output depends
entirely on which ones were supplied**:

| pegakit source | Flag | Contributes |
|---|---|---|
| Application export (`.zip`) | `--export` | SQL schema, rule inventory |
| Application document (`.docx`) | `--doc` | Stages, flows, decision tables, security |
| Live instance via DX API | `--host --id --secret` | **Views, fields, choice values, theme** |

**This app was built from a full three-source extraction.** Verify any
replacement before seeding, because an export-plus-document run produces a
structurally valid `model.json` that is missing everything the UI needs:

| | Offline run (export + doc) | Full run (all three) |
|---|---|---|
| Views captured | **0** of 49 | 28 of 49 |
| Choice sets | **0** | 27 |
| Forms | **0** | 31 |
| Theme | absent | present |
| ComplianceMonitoring stages | 10 | 7 |

The stage counts differ because the document-text parser infers the lifecycle
from prose, whereas a DX API run walks real cases and records actual traces.
**Treat the DX API run as authoritative for stages and steps.**

Sanity-check before seeding:

```bash
node -e "const m=require('<prototype-dir>/model.json'); \
  console.log('views', m.coverage.viewsCaptured.length, \
              'choiceSets', Object.keys(m.choiceSets||{}).length, \
              'theme', !!m.theme)"
```

If views or choice sets are `0`, **stop** - the extraction was run without the
DX API and seeding it would delete the 24 views, 59 view fields and 26 choice
sets the assignment forms are rendered from. Re-run pegakit with `--host`,
`--id` and `--secret` against a sandbox. Note that the DX API harvest creates
real cases and advances them through their lifecycles, so never point it at
production.

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

- Guards on backward stage changes are inferred. The flow bodies were extracted
  and contain no conditional transitions, so these need business validation
  rather than technical recovery (sections 3b and 4.1).
- Notification, data transform and document generation are logged, not executed
  (section 4.3). Note the 20 data transform steps have no authored logic in this
  export at all, so logging them is faithful behaviour (section 4.3a).
- Current user is hard-coded (section 4.2).
- No row-level security; all users see all cases (section 4.4).
- Attachment fields are text references only (section 4.5).
- SLA deadlines are recorded but not enforced (section 4.6).
- Unmapped Pega fields (for example `pyNote`) are reported as `skipped` by the
  detail-column mapper rather than failing the save - check the console when
  adding new fields.
