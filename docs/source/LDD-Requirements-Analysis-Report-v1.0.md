# Lending Due Diligence (LDD) — Requirements Analysis Report
## Pega → Power Apps Code App Migration

| Item | Value |
|---|---|
| Project Name | Lending Due Diligence (LDD) Re-Platform — Pega to Power Apps Code App |
| Document | Requirements Analysis Report |
| Version | 1.0 (Draft for review) |
| Date | 27 August 2026 |
| Author | Power Platform Delivery Orchestrator (Requirements Analysis) |
| Status | Awaiting business validation of Open Questions and Blocking Decisions |
| Requirements Baseline | `requirements-baseline.json` (machine-readable companion) |

### Source Material Analysed

| # | Source Document | Ref Code | Coverage |
|---|---|---|---|
| 1 | LDD_ADD_1.3.docx — Application Design Document v1.3 (62 pages, 94 headings, 53 tables) | ADD | Architecture, case lifecycle, admin, reports, security, data model |
| 2 | LDD_Application_document.docx — Pega Application Document (4 pages, 12 images) | APPDOC | Pega-generated application/case-type inventory (largely boilerplate + diagrams) |
| 3 | Lending_Due_Diligence_Ingestion_files_IA_v2.0.docx — Inbound Interface Agreement v2.0 (36 pages, 53 tables) | IA-IN | Inbound file specs: Transaction, Employee, Metric, BC/RM Trigger, OECP |
| 4 | Lending_Due_Diligence_Extract_IA_1.5.docx — Outbound Extract Interface Agreement v1.5 (12 pages) | IA-OUT | BIX extract, manifest/checksum, transmission |
| 5 | RMEscalationFlowScreenShots.docx — 14 UI screenshots of the live Pega app | SCR | Actual UI, case header, stage bar, field labels, task screens |

---

## 1. Executive Summary

CIBC operates a Pega Cloud 8.5.3 application called **Lending Due Diligence (LDD)** that unifies the review processes of two oversight teams — **Business Controls Lending Due Diligence Monitoring (BC, 1st line of defence)** and **Risk Management Quality Assurance (RM, 2nd line of defence)** — for OSFI-mandated due diligence over residential mortgage, secured and unsecured loans and lines across CIBC PBB and Simplii lending channels.

This document converts the existing Pega design and interface artefacts into a structured, traceable requirements baseline for a re-platformed **Power Apps Code App** (code-first React/TypeScript application on Power Platform, using Dataverse as the system of record and Power Automate for orchestration and notifications).

**Scale of the baseline:** 92 Functional Requirements, 26 Non-Functional Requirements, 12 Business Processes, 14 Business Entities, 7 Reporting Requirements, 14 Security Requirements, 8 Integration Requirements, 17 Assumptions, 12 Risks, 14 Gaps, 18 Open Questions (5 of which are **Blocking Decisions**).

**Key volumetrics driving the design (from IA-IN):**

| File | Records | Growth |
|---|---|---|
| Transaction*.txt | 50,000/day; 18,250,000/month (max 50k per file, max 100k/day) | 15%/yr |
| Metric.txt | 91,250,000/month | 30%/yr |
| Employee.txt | 20,000/month | 15%/yr |
| Trigger_bc.txt | 2,600/day | 25%/yr yr1, then 15%/yr |
| Trigger_rm.txt | 2,600/day | 25%/yr yr1, then 15%/yr |
| LDDOECPResponse.txt | 2,600/day | 25%/yr yr1, then 15%/yr |

The Metric and Transaction volumes are the single largest architectural risk to a Dataverse-based re-platform (see **RSK-001**, **OQ-001**) — ~91.25 million Metric rows/month is materially above typical Dataverse transactional patterns and requires an explicit persistence decision (Dataverse vs. Azure SQL/Fabric with virtual tables) before solution design proceeds.

**Migration-specific position:** this is a **like-for-like functional migration with platform modernisation**, not a re-design. Pega-specific constructs must be re-expressed in Power Platform terms:

| Pega Construct | Power Platform Equivalent (proposed) |
|---|---|
| Case Type (BC / RM) | Dataverse table + status/stage columns + Business Process Flow or code-app-driven state machine |
| Stages (Initialization → Triage → Review → Recommendation and action) | Stage column + code-app stepper component |
| Workbaskets (BCGeneralWB, RMLenderWB, …) | Dataverse Queue table + Dataverse row-level security / team ownership |
| Worklist / MyWorklist | Code app "My Work" view over assignment records |
| GetNext | Custom assignment service (Power Automate or Dataverse plug-in) with complexity/eligibility sort |
| SLA (business days) | SLA due-date column + Power Automate scheduled escalation |
| Pega Pulse (Notes) | Dataverse Notes/Annotation + code-app activity feed |
| File Listener + Job Scheduler | Azure Data Factory / Logic Apps ingestion + Power Automate scheduled cloud flows |
| BIX extract | Dataverse → Azure Data Lake / scheduled export job |
| SAML 2.0 SSO via COINS/BranchNet | Microsoft Entra ID (SSO) with COINS profile → security role mapping |
| RBAC via CIBC-Auth-Data-RBAC-AIM | Dataverse security roles, teams, business units, column security profiles |

---

## 2. Business Context

### 2.1 Business Problem
Lending due diligence reviews were historically performed manually using spreadsheets, Access databases and email exchanges between lenders across the organisation. Both teams' original platforms were end-of-life and did not fulfil the business mandate. The Pega LDD application solved that; it is now itself the legacy platform to be replaced by a Power Apps Code App.

### 2.2 Current State (Pega)
- Pega Cloud 8.5.3, application `cibc-lending-due-diligence-application`, built on the AIM/Sales Monitoring Pega One platform.
- Organisation/Division/Unit: **CIBC / RetBnk / LDD**. Ruleset: **CIBCLendingDueDiligence**. Work class: **CIBC-RetBnk-LDD-Work** (table `pc_CIBC_RetBnk_LDD_Work`).
- Two case types — **Business Control (BC-yyyymmddnnnnn)** and **Risk Management (RM-yyyymmddnnnnn)**.
- Four-stage lifecycle observed in the UI: **Initialization → Triage → Review → Recommendation and action**.
- Cases created automatically overnight from daily Trigger files, or manually by an analyst from a transaction search.
- 7 inbound feeds + 1 outbound BIX extract, all over SFTP via Feedhub/NAS.
- Bilingual UI (English / Français toggle observed in every screenshot).

### 2.3 Desired Future State (Power Apps Code App)
A code-first Power Apps application that:
- Reproduces the full BC and RM case lifecycle, stage model, task/assignment model and rating/recommendation workflow.
- Uses **Dataverse** as system of record with Power Automate for notification, SLA and escalation orchestration.
- Preserves regulatory traceability, auditability and the 7-year retention intent that Pega could not deliver.
- Delivers WCAG 2.1 AA accessibility (a known gap in the Pega implementation — see **GAP-004**).
- Retains bilingual (EN/FR) presentation.
- Provides equivalent or better reporting/export, and removes the platform data-purging limitation.

### 2.4 Success Metrics (proposed — require business confirmation, **OQ-016**)
| ID | Metric | Target |
|---|---|---|
| SM-01 | Functional parity with Pega LDD | 100% of FR-001…FR-092 accepted |
| SM-02 | Daily ingestion completes before business start | 100% of batches complete by 06:00 EST |
| SM-03 | Case creation accuracy from Trigger file | 100% of valid trigger rows produce a case |
| SM-04 | Case list / search response time | ≤ 3 seconds at p95 |
| SM-05 | Accessibility conformance | WCAG 2.1 AA verified by audit |
| SM-06 | Zero regression in regulatory reporting | All BC + RM reports reconcile to Pega for parallel-run period |

### 2.5 Business Value
Consistency of review criteria across 1st and 2nd line of defence; OSFI recommendation compliance; front-line coaching driven by risk findings; reduced risk exposure; retirement of end-of-life Pega licensing and specialised Pega skill dependency; consolidation onto the CIBC Microsoft/Power Platform estate.

---

## 3. Personas

| ID | Persona | Description | Key Responsibilities | System Access Level |
|---|---|---|---|---|
| PER-01 | BC Manager | Business Controls team manager | Triage, bulk assignment, bulk cancel, transfer, final rating, share final results, admin oversight | Full BC case + bulk actions + reports |
| PER-02 | BC Senior Analyst | Senior reviewer / peer reviewer | Triage, peer review, second opinion, bulk assignment; **cannot** share final results with partners | Elevated BC case access, no final-share |
| PER-03 | BC Analyst Level 2 | Second-opinion analyst | Second-opinion reviews (`BCSecondOpinionWB`) | BC case access incl. second opinion WB |
| PER-04 | BC Analyst | Core reviewer | GetNext, review case, answer review-type questions, rate roles, create lender task | BC case access, own worklist |
| PER-05 | BC Lender | Front-line lender under review | Respond to lender tasks, provide information, attest/request reversal | Task-scoped, own records only |
| PER-06 | BC Overrider | Approver who overrode a decision | Respond to overrider rating, attest/request reversal | Task-scoped, own records only |
| PER-07 | BC Front Line Manager | Lender's people leader | Respond to escalation/coaching tasks, provide manager comments | Task-scoped to direct/indirect reports |
| PER-08 | BC Partner | Partner channel stakeholder | Receive/act on partner tasks | Task-scoped |
| PER-09 | RM Manager | Risk Management QA manager | Triage, bulk actions, preliminary + final result sharing, create BC case, out-of-scope approval | Full RM case + bulk actions + reports |
| PER-10 | RM Senior Analyst | RM peer reviewer | Peer review, second opinion, bulk assignment; **cannot** share final/preliminary results | Elevated RM case access, no final-share |
| PER-11 | RM QA Analyst | Core RM reviewer | GetNext (by assigned Review Name), review, rate, request second opinion, create fraud task | RM case access, own worklist |
| PER-12 | RM Partner — Underwriter (UW) | Underwriting partner | Respond to UW rating tasks (`RMUnderwriterWB`) | Channel-scoped task access |
| PER-13 | RM Partner — Credit Adjudicator (CA) | Adjudication partner | Respond to CA admin tasks (`RMCreditAdjudicatorWB`) | Channel-scoped task access |
| PER-14 | RM Partner — Funder (RCS) | Funding partner | Respond to funder tasks (`RMFunderWB`) | Channel-scoped task access |
| PER-15 | RM Partner — IVO | Income Verification Officer | Respond to IVO tasks (`RMIVOWB`) | Channel-scoped task access |
| PER-16 | RM Partner — Lender | Lender under RM review | Respond to lender tasks (`RMLenderWB`) | Channel-scoped, own records |
| PER-17 | RM Fraud Reviewer | Fraud team | Respond to fraud review tasks (`RMFraudWB`) | Channel-scoped task access |
| PER-18 | BC Business Administrator | BC configuration owner | Dropdown, PID, Review Type, Communication Method, GetNext, Flags & Conditions maintenance | BC admin screens |
| PER-19 | RM Business Administrator | RM configuration owner | Dropdown, PID, Review Type, RM Realtime Communication, GetNext RM maintenance | RM admin screens |
| PER-20 | BC Analytics Team | Upstream data provider | Produce/QA Transaction, Employee, Metric, Trigger BC, OECP, Migration files; receive error/success notifications | Non-interactive (file interface) + notification recipient |
| PER-21 | RM Analytics Team | Upstream data provider | Produce/QA RM Trigger and related feeds; receive notifications | Non-interactive (file interface) + notification recipient |
| PER-22 | Application Operations / Support | Platform operations | Monitor batches, re-run extracts (up to 3 retries), triage errors | Operational/diagnostic access |
| PER-23 | Auditor / Compliance (OSFI-facing) | Regulatory assurance | Read case history, audit trail, retention evidence | Read-only across all cases |

---

## 4. Functional Requirements

Priority key: **H** = High (parity-critical), **M** = Medium, **L** = Low.

### 4.1 Authentication, Navigation and Landing (FR-001 – FR-006)

| ID | Title | Description | Pri | Source |
|---|---|---|---|---|
| FR-001 | Single Sign-On | The app shall authenticate users via enterprise SSO (Entra ID replacing SAML 2.0 / BranchNet portal launch) with no secondary credential prompt. | H | ADD §1.13.1, SCR |
| FR-002 | Profile-based access provisioning | Access shall be granted based on the user's COINS Profile Code; users sharing a profile code receive the same access level. | H | ADD Assumption 5 |
| FR-003 | Default landing — MyWorklist | MyWorklist shall be the default landing screen for BC, RM QA, Banking Centre and MA Channel users on successful logon. | H | ADD Decision 4 |
| FR-004 | Default landing — RM partners | RM Partner users shall land in their respective **channel + role** workbasket rather than MyWorklist. | H | ADD Decision 4 |
| FR-005 | Bilingual UI | The app shall present all UI labels, messages and rating content in English and French with an in-app language toggle. | H | SCR (Français toggle; dual-language error display) |
| FR-006 | Single-click open | Selecting and opening any list item shall use a single click consistently throughout the application. | M | ADD Decision 7 |

### 4.2 Data Ingestion (FR-007 – FR-024)

| ID | Title | Description | Pri | Source |
|---|---|---|---|---|
| FR-007 | Ingest Transaction files | Ingest `Transaction*.txt` (Transaction1.txt, Transaction2.txt), pipe-delimited, UTF-8, 128 data fields, PK `TRANSACTION_LEVEL_UNIQUE_ID`. | H | IA-IN §3.1.1 |
| FR-008 | Ingest Employee file | Ingest `Employee.txt`, PK `Employee_Level_Unique_ID`; `OPERATOR_ID` also unique. Fields incl. CHANNEL, EMAIL_ADDRESS, JOB_TITLE, JOB_FAMILY, TRANSIT, MANAGER_ID, DLA_SIGNING_AUTHORITY, COINS_ID, Employee_Additional_Detail_1–5. | H | IA-IN §3.1.2 |
| FR-009 | Ingest Metric file | Ingest `Metric.txt` with composite PK on `Unique_ID` (Employee or Transaction level) + criterion; `Entity_Type` ∈ {Employee, Transaction}; `Review_Criteria_Type` 1=String, 2=Numeric, 3=Boolean (rendered "Yes"/"No"). | H | IA-IN §3.1.3 |
| FR-010 | Ingest BC Trigger file | Ingest `Trigger_bc.txt` (QUEUE_TYPE, REVIEW_TYPE_TEMPLATE_ID, TRANSACTION_LEVEL_UNIQUE_ID, Review_Name — all mandatory). | H | IA-IN §3.1.4 |
| FR-011 | Ingest RM Trigger file | Ingest `Trigger_rm.txt` with identical structure to BC Trigger. | H | IA-IN §3.1.5 |
| FR-012 | Ingest OECP response file | Ingest `LDDOECPResponse.txt` (PK Case_Id) carrying lender/overrider attestation, reversal status, reversal reason and 4000-char decision comments. | H | IA-IN §3.1.6 |
| FR-013 | Ingest BC migration file | Ingest `LDDMigration.txt` weekly, PK `LegacyCaseID`, upsert semantics. | H | ADD §2.2.15 |
| FR-014 | Header validation | Validate the mandatory header record of every inbound file; on error set FileLoadStatus=1, FileLoadDate=sysdate, exit code 1, write error to notification email. | H | ADD §2.2.1 |
| FR-015 | Trailer / row-count validation | Validate the mandatory trailer record and confirm the trailer row count matches parsed rows; on mismatch fail the file. | H | ADD §2.2.1 |
| FR-016 | Row-level validation | Validate each row for data type, length and mandatory-field presence; reject the **whole file** if any mandatory field errors. | H | ADD §2.2.1, §2.2.15 |
| FR-017 | Single error per row in notification | Where a row has errors in multiple fields, report only the first error for that row in the notification email. | M | ADD §2.2.1 |
| FR-018 | Upsert semantics | Insert rows with new primary keys; update existing rows where the primary key already exists. | H | ADD §2.2.1 |
| FR-019 | Batch Status tracking | Maintain a Batch Status record per file with: ID (identity), FileType (T1/T2/E/M/TB/TR), FileName (≤30), BusinessDate (YYYYMMDD, 9), FileLoadDate, FileLoadStatus (0=complete, 1=not started; default 1), TableLoadDate, TableLoadStatus (0/1; default 1), RowsLoaded. | H | ADD §2.2.1 |
| FR-020 | Failure notification | On any batch failure, email BC Analytics (`Mailbox.BusinessControlsAnalytics@cibc.com`) and RM Analytics (`DLFCIAnalytics@cibc.com`) with the file header and error records. | H | ADD §2.2.1 |
| FR-021 | Success notification | On full batch success, email BC and RM Analytics with a success indicator, date of run, and the business date from the Transaction1 file header. | H | ADD §2.2.1 |
| FR-022 | Inactive review template rejection | If a Trigger file row references a Review Type Template ID that does not match an **Active** template, reject the whole trigger file, fail the batch and notify Analytics. | H | ADD §2.2.1 |
| FR-023 | File retention policy | Do not persist the physical inbound file after successful processing; overwrite the prior file on the next arrival. Only processed data is retained. | H | ADD Decision 2, §2.2.15 |
| FR-024 | Duplicate trigger handling | Where duplicate `TRANSACTION_LEVEL_UNIQUE_ID` rows exist in the same trigger file, create the case from the **last updated** record only. | H | ADD §2.2.1 |

### 4.3 Case Creation (FR-025 – FR-032)

| ID | Title | Description | Pri | Source |
|---|---|---|---|---|
| FR-025 | Automatic case creation | After midnight, create cases from the ingested Trigger table, grouped by unique `TRANSACTION_LEVEL_UNIQUE_ID`, joining Transaction, Employee and Metric data. | H | ADD §2.2.5 |
| FR-026 | Case ID format | Generate case IDs as `BC-yyyymmddnnnnn` and `RM-yyyymmddnnnnn` (yyyy year, mm month, dd day, nnnnn incrementing). | H | ADD §2.2.2 |
| FR-027 | Workbasket routing on creation | Route the new case to a workbasket based on the Trigger file `QUEUE_TYPE`. | H | ADD §2.2.1 |
| FR-028 | Review Type assignment | Assign the Review Type Template ID from the trigger row; this drives the question set presented to the analyst. | H | ADD §2.2.1 |
| FR-029 | Exception workbasket | Where the trigger's transaction or related employee was not loaded at least one day prior, route the case to the exception workbasket (`BCExceptionWB`). | H | ADD §2.1.2 |
| FR-030 | Manual case creation | Allow RBAC-permitted analysts to create a case manually: search transactions by **Application Date range (mandatory)** and **Funded Date range (optional)**, select a transaction, then supply case parameters. | H | ADD §2.2.4, SCR 1 |
| FR-031 | Case parameter capture | On manual creation capture Queue Type*, Review name*, Review Template ID or Name*, and optional Assign to, then Create. | H | SCR 2 |
| FR-032 | Inflight case immutability | Cases already created and saved shall not be updated by subsequent Transaction file updates; only NEW cases reflect updated data (exception: Income Queue cases). | H | ADD §2.2.1 |

### 4.4 Case Lifecycle — Stages and Processing (FR-033 – FR-047)

| ID | Title | Description | Pri | Source |
|---|---|---|---|---|
| FR-033 | Four-stage lifecycle | Present and enforce the stage model: **Initialization → Triage → Review → Recommendation and action**, with a visual stepper showing completed stages. | H | SCR 1–14 |
| FR-034 | Triage step | Sr Analyst/Manager shall triage: modify SLA, modify employee details, modify transaction details, assign to another user or self-assign. | H | ADD §2.2.6.1, SCR 4 |
| FR-035 | Triage decision form | Triage Decision form shall capture Assign to* (dropdown), SLA (Business Days)*, Notes (free text), with Cancel / Save / Submit actions. | H | SCR 4 |
| FR-036 | BC Review activities | In Review, the BC analyst shall be able to: close out-of-scope case; assign lender task for information; answer Review Type Template questions; request second opinion; provide rating and comments per required role. | H | ADD §2.2.6.2 |
| FR-037 | RM Review activities | In Review, the RM analyst shall be able to: close out-of-scope case (manager approval required); close case as incomplete; assign fraud task; answer template questions; request second opinion; provide rating and comments per required role. | H | ADD §2.2.6.2 |
| FR-038 | Role rating tabs | Rating and Recommendation shall present tabs per role: **Lender, Overrider, UW-CA, IVO, RCS, Other 1, Other 2, Other 3**, each showing Operator ID and Employee Name. | H | SCR 5 |
| FR-039 | Primary/secondary errors | Allow the analyst to add one or more errors per role, flag exactly one as the **primary error**, and delete errors. | H | SCR 6 |
| FR-040 | BC due diligence outcome | Capture BC due diligence outcome (e.g. **Escalation**, Coaching, FYI), **Employee Accountable** (Yes/No), an **Alignment change?** flag, and Comments. | H | SCR 6 |
| FR-041 | Counter display | Display current **Escalation / Coaching / FYI** counters for the rated operator on the rating screen. | H | SCR 6, SCR 7 |
| FR-042 | Manager hierarchy display | Display 1st and 2nd level manager details — Operator ID, COINS ID, Employee Name, Email address, Job Title, Transit — as editable fields on the escalation form. | H | SCR 7, SCR 8 |
| FR-043 | BC Recommendation activities | In Recommendation: determine communication method; share result with partners; receive partner reversal/attestation decisions; provide final rating; share final result with partners. | H | ADD §2.2.6.3 |
| FR-044 | RM Recommendation activities | In Recommendation: provide final rating; assign task to analyst to correct review/decision/rating; share final result with partners via the Final Result report section. | H | ADD §2.2.6.3 |
| FR-045 | Case closure | Move the case to **Resolved-Review Completed** when all dependent tasks are complete. | H | ADD §2.2.7, SCR 14 |
| FR-046 | RM close-stage flows | For RM, Preliminary Review and Final Result flows shall execute within the Close stage. | H | ADD §2.2.7 |
| FR-047 | Reopen case | Allow a **Reopen Case** action on a resolved case. | H | ADD §2.2.3, SCR 14 |

### 4.5 Work Assignment, Workbaskets and GetNext (FR-048 – FR-056)

| ID | Title | Description | Pri | Source |
|---|---|---|---|---|
| FR-048 | BC workbaskets | Provide BC workbaskets: BCToRMReferralWB, BCExceptionWB, BCReversalRequestWB, BCSecondOpinionWB, BCBranchAccountabilityWB, BCGeneralWB, BCOECPWB, RM Alignment WB, RM Reversal WB. | H | ADD §2.2.2 |
| FR-049 | BC workbasket access matrix | Enforce access: BCManager and BCSrAnalyst have access to all listed BC workbaskets; BCAnalystLv2 to BCSecondOpinionWB only; BCAnalyst, BCLender, BCOverrider, BCFrontLineMgr and BCPartner have no workbasket access. | H | ADD §2.2.2 |
| FR-050 | RM workbaskets | Provide RM workbaskets: RMUnderwriterWB, RMLenderWB, RMIVOWB, RMFunderWB, RMFraudWB, RMCreditAdjudicatorWB (CA Admin), RMChannelWB. | H | ADD §2.2.6.2 |
| FR-051 | RM partner channel scoping | RM partners shall only view tasks/cases for their own channel (e.g. Lender Simplii sees only RMLenderWB rows belonging to Simplii). | H | ADD §2.2.6.2 |
| FR-052 | GetNext — BC | On GetNext, sort available workbasket cases by **complexity descending** and assign the highest-complexity available case to the analyst. | H | ADD §2.2.3.7 |
| FR-053 | GetNext complexity config — BC | Allow the BC admin to assign a complexity value of **0–90 in increments of 1** to each combination of Review Template ID + Review Name. | H | ADD §2.2.3.7 |
| FR-054 | GetNext — RM | On GetNext, filter workbasket cases to the Review Names assigned to the analyst's COINS ID and assign the first available case. | H | ADD §2.2.3.8 |
| FR-055 | GetNext config — RM | Allow the RM admin to map Review Name → one or more Analyst COINS IDs (Assign-To style picker). | H | ADD §2.2.3.8 |
| FR-056 | Overview task list | Display an **Overview** task list per case showing Name, Assigned to, Goal, Deadline and Status with a **Go** action per row, and a **View all** toggle. | H | SCR 3, 4, 9, 14 |

### 4.6 Case-Level Actions (FR-057 – FR-069)

| ID | Title | Description | Pri | Source |
|---|---|---|---|---|
| FR-057 | Case assignment | Allow case assignment/re-assignment (BC and RM). | H | ADD §2.2.3 |
| FR-058 | Modify employee details | Allow modification of employee details sourced from the HR service feed (BC and RM). | H | ADD §2.2.3 |
| FR-059 | Modify transaction details | Allow modification of transaction details, **except Source, Application number and Product Type** which are read-only. | H | ADD §2.2.3 |
| FR-060 | Change stage (BC) | Allow a BC user to change the case stage. | M | ADD §2.2.3 |
| FR-061 | Cancel case | Allow case cancellation (BC and RM). | H | ADD §2.2.3 |
| FR-062 | Close as out of scope | BC: close case as out of scope. RM: create a manager task for out-of-scope approval. | H | ADD §2.2.3 |
| FR-063 | Close incomplete (RM) | Allow RM to close a case as incomplete. | H | ADD §2.2.3 |
| FR-064 | Create lender task (BC) | Allow BC to create a lender task to obtain required information. | H | ADD §2.2.3 |
| FR-065 | Create fraud review task (RM) | Allow RM to create a Fraud Review task routed to RMFraudWB. | H | ADD §2.2.3 |
| FR-066 | Request second opinion | Allow BC and RM to request a second opinion (routes to BCSecondOpinionWB / RM equivalent). | H | ADD §2.2.3 |
| FR-067 | Cross-team referral | BC: request RM review (task) and create RM Reversal Request task. RM: create BC Review Case and create BC Alignment Task. | H | ADD §2.2.3 |
| FR-068 | Branch accountability task (BC) | Allow BC to create a Branch Accountability task routed to BCBranchAccountabilityWB. | H | ADD §2.2.3 |
| FR-069 | Display case history | Display full case history (audit trail of stage, status, assignment and field changes). | H | ADD §2.2.3 |

### 4.7 Bulk Actions (FR-070 – FR-072)

| ID | Title | Description | Pri | Source |
|---|---|---|---|---|
| FR-070 | BC bulk actions | BC Manager or Sr Analyst may: bulk-assign cases to an analyst; bulk-cancel selected cases; bulk-transfer case/task from one user to another. | H | ADD §2.2.3 |
| FR-071 | RM bulk actions | RM Manager or Sr Analyst may: bulk-assign; bulk-cancel; bulk-close partner tasks ("Close Task" — like Share Result but closes without sharing); bulk-transfer. | H | ADD §2.2.3 |
| FR-072 | RM bulk sharing restrictions | Creating Preliminary Review Partner Tasks, sharing final results with partners, and creating BC cases from bulk action shall be restricted to **Managers only** — Senior (peer review) Analysts are excluded. | H | ADD §2.2.3 |

### 4.8 Case Information Tabs (FR-073 – FR-078)

| ID | Title | Description | Pri | Source |
|---|---|---|---|---|
| FR-073 | Case information tabs | Provide 12 tabs: Case Details, Overview, Transaction Information, Additional Metrics, Employee Information, Notes And Files, Lender Response (BC), Fraud Response (RM), Rating and Recommendation, Related Cases (BC), Auto Emails, Attachment List. | H | ADD §2.2.9 |
| FR-074 | Tab availability | All tabs shall be displayed throughout the case lifecycle; where data is unavailable the tab is still shown with blank sections. | M | ADD §2.2.9 |
| FR-075 | Case header summary | Display a persistent case header/side panel: Case ID, case type, Status, Case Owner, Review Template ID or Name, Queue Type, Review name, Channel, Product Type, Purpose, PID Description, Created by/when, Updated by/when, Resolved by/when, plus a **Duplicate case** indicator where applicable. | H | SCR 3–14 |
| FR-076 | Additional Metrics behaviour | Where a case has more than one operator, display the same employee-level metrics organised by product category, with **no indication of which operator** a metric belongs to; display admin-selected criteria populated with the latest value. | M | ADD §2.2.9.4 |
| FR-077 | Related Cases (BC) | Show related cases based on Transaction, Lender ID and Overrider ID work parties, plus a separate section for **migrated historical cases matched on Operator ID**. | H | ADD §2.2.9.10 |
| FR-078 | Notes and attachments | Provide a case notes/activity feed and an attachment list supporting upload, view and download. | H | ADD §2.2.9.6, §2.2.9.11 |

### 4.9 Administration (FR-079 – FR-086)

| ID | Title | Description | Pri | Source |
|---|---|---|---|---|
| FR-079 | Admin hub | Provide a single administration entry point linking to: Dropdown Value Maintenance, PID Maintenance, Review Type Maintenance, BC Coaching/Escalation/FYI Communication, BC FYI/Coaching/Escalation counter, GetNext BC Maintenance, RM Communication method, GetNext RM Maintenance. Separate BC and RM admin screens and backing tables; **PID and PID Group are shared** between BC and RM. | H | ADD §2.2.3 |
| FR-080 | Dropdown maintenance | Allow admins to select an editable dropdown list and add, edit or remove its values without a development release. | H | ADD §2.2.3.1 |
| FR-081 | PID maintenance | Allow admins to add, update and delete PID → PID_Description mappings and PID Group → PID mappings (initial list supplied by Analytics). | H | ADD §2.2.3.2 |
| FR-082 | Review Type maintenance | Allow admins to create, duplicate, update and deactivate a Review Type; the system generates a unique Review Type ID on save; a Review Type holds a series of questions and permitted responses; assignment is keyed on Queue Type, Channel, PID, Product Type and Purpose. BC and RM maintain separate Review Types. | H | ADD §2.2.3.3 |
| FR-083 | BC communication method | Allow the BC admin to set the Coaching/Escalation/FYI communication method per channel to **Real Time** (default), **Hold** (bulk tasks created by batch at an admin-selected frequency) or **Consolidate** (via OECP round-trip through Analytics). | H | ADD §2.2.3.4 |
| FR-084 | RM communication method | Default RM communication method for every Channel + Review Name + Role combination is **Hold**; only combinations manually added on the RM Realtime Communication screen become **Real Time**. | H | ADD §2.2.3.5 |
| FR-085 | Counter reset basis | Allow the BC admin to select the Escalation/Coaching/FYI counter reset basis: **Fiscal Year (Nov 01 – Oct 31)** or **Rolling 12 months (current date − 365)**. Counters are calculated at Operator ID level irrespective of role; RM case ratings are excluded from BC counter logic. | H | ADD §2.2.3.9 |
| FR-086 | Admin change scope | Administration changes shall affect **only new cases**; existing cases are unaffected. | H | ADD §2.2.3 |

### 4.10 Escalation, Communication and Partner Response (FR-087 – FR-092)

| ID | Title | Description | Pri | Source |
|---|---|---|---|---|
| FR-087 | Escalation matrix | Route escalation tasks by current escalation counter: counter 0 or 1 → 1-level-up manager; 2 → 2-level-up; 3 → 3-level-up; 4 and above → 4-level-up manager. | H | ADD §2.2.5 |
| FR-088 | Real-time task creation | Where the Channel + Review Name combination is configured Real Time: create a real-time BC case for Lender in Channel MA / Banking Centre / EMTG / Telephone Banking; create a real-time role workbasket task (UW, CA admin, Funder, IVO) per channel for other channels. Appraiser, Other 1, Other 2, Other 3 and System roles generate **no task**. | H | ADD §2.2.6.2 |
| FR-089 | Hold task creation | Where the combination is not configured Real Time: create the role task in the **Preliminary Review WB** for manager/partner review before onward BC case or lender task creation. TB and EMTG are treated as Banking Centre and route to BC (there is no RM partner workbasket for Lender TB/EMTG). | H | ADD §2.2.6.2 |
| FR-090 | Partner response capture | The partner response screen shall present read-only Lender Rating and Recommendation context (Employee Name, Application number, Region, Customer name, Market, Funded Date, Operator ID, Mortgage Number, Application Date, MMortgage Number, Source, Class Number, Transit, Transaction Level Unique ID) plus editable response fields, with an SLA countdown ("Due 1 hour from now"). | H | SCR 10, 11 |
| FR-091 | Partner response fields | Capture per role: Attestation Provided? (Yes/No), Reversal Status (Reversal Accepted / Reversal Declined / Reduced to Coaching / Justification Required), Reason for Reversal (LDDM Error, Risk Mgmt Error, Underwriter Error, Back Office Error, Documents provided Post review, Lender Benefit, Other), Comments by analyst, Comments by Frontline Manager, Response Date. Comments fields support up to 4000 characters. | H | SCR 13, IA-IN §3.1.6 |
| FR-092 | OECP round-trip | Where communication method is **Consolidate**: send daily case information to Analytics via extract; receive the OECP response file; update lender and overrider ratings from the returned attestation, reversal status, reversal reason and comments, keyed on Case_Id. | H | ADD §2.2.3.4, IA-IN §3.1.6 |

---

## 5. Non-Functional Requirements

| ID | Category | Requirement | Pri | Source |
|---|---|---|---|---|
| NFR-001 | Security | Authentication via enterprise SSO (Entra ID) replacing Pega SAML 2.0; no local credential store. | H | ADD §1.13.1 |
| NFR-002 | Security | All web traffic over HTTPS/TLS in line with **CIBC SC-83 Cryptography** standard. | H | ADD §1.13.3 |
| NFR-003 | Security | All 8 file feeds encrypted in transit using SFTP. | H | ADD §1.13.3 |
| NFR-004 | Security | No secrets or credentials stored in application configuration or source; use managed identity / Key Vault. | H | Delivery standard |
| NFR-005 | Security | No web services / public API surface exposed by the application beyond platform-managed endpoints. | M | ADD §1.13.3, §2.1.4 |
| NFR-006 | Security | Role-based access control with least privilege; hidden UI controls shall not be relied upon as a security boundary. | H | Delivery standard |
| NFR-007 | Performance | Optimise flows and service calls; avoid unnecessary calls to deliver the best user experience. | H | ADD §1.12 |
| NFR-008 | Performance | Case list and search views shall return within 3 seconds at p95 under production volumes. | H | Derived (**assumption ASS-009**) |
| NFR-009 | Performance | Daily ingestion of up to 100,000 transaction rows, 50,000+ metric rows and 5,200 trigger rows shall complete within the overnight batch window. | H | IA-IN §2.3 |
| NFR-010 | Scalability | The data tier shall sustain ~91,250,000 Metric rows/month and ~18,250,000 Transaction rows/month with 30% and 15% annual growth respectively. | H | IA-IN §2.3 |
| NFR-011 | Availability | Application availability shall meet the CIBC standard for regulatory tier applications (**target to be confirmed — OQ-011**). | H | Gap |
| NFR-012 | Accessibility | The application shall conform to **WCAG 2.1 Level AA** and CIBC accessibility standards, verified by audit — explicitly closing the Pega gap where accessibility was not developed for. | H | ADD §1.9 (gap), Delivery standard |
| NFR-013 | Accessibility | Full keyboard navigation, screen-reader support, accessible labels, sufficient colour contrast and responsive layout. | H | Delivery standard |
| NFR-014 | Auditability | Record a complete, immutable audit trail of case creation, stage/status transitions, assignments, rating changes and administrative configuration changes. | H | ADD §2.2.3, regulatory |
| NFR-015 | Auditability | Administrative configuration changes (dropdowns, PIDs, review types, communication methods, GetNext, counter basis) shall be versioned and attributable to a named user with timestamp. | H | Derived |
| NFR-016 | Compliance | Support OSFI lending-practice oversight obligations for CIBC PBB and Simplii residential mortgage, secured and unsecured loans and lines. | H | ADD §1.1, §1.2 |
| NFR-017 | Compliance / Retention | Implement the LDD retention policy: **purge 7 years after the year in which the case is closed** — a capability the Pega platform could not provide. | H | ADD §1.11 Risk 1 |
| NFR-018 | Compliance / Retention | Implement archival/purge of ingested transaction data (Pega intent was quarterly delete/archive, deferred) to protect performance. | M | ADD Decision 13 |
| NFR-019 | Data Residency | All application and Dataverse data shall reside in Canada (**requires formal confirmation — blocking decision OQ-002**). | H | Gap — Canadian bank, OSFI |
| NFR-020 | Data Protection | Personal data (customer names, property addresses, credit scores, incomes, employee identifiers) shall be protected by column-level security and masked in exports where not required. | H | Derived from IA-IN field inventory |
| NFR-021 | Usability | Sorting shall apply to one column at a time and shall not be nested; filtering shall be available on multiple columns and may be nested. | M | ADD Decision 10 |
| NFR-022 | Usability | Consistent single-click interaction model across all lists. | M | ADD Decision 7 |
| NFR-023 | Localisation | Full English and French localisation of UI, notifications and rating content. | H | SCR |
| NFR-024 | Maintainability | Data elements shall be defined with an explicit maximum length matching the Interface Agreement specifications. | M | ADD §1.7.3 |
| NFR-025 | Operability | Extraction jobs shall auto-retry up to **3 times** on failure before raising an operational alert. | M | IA-OUT §4 |
| NFR-026 | ALM | Solution shall be delivered through managed-solution ALM across DIT, SIT, UAT, PTE and Production environments with no direct production authoring. | H | ADD §5, delivery standard |

---

## 6. Business Processes

| ID | Process | Trigger | Actor | Key Actions | Outcome |
|---|---|---|---|---|---|
| BP-001 | Daily File Ingestion | Files present at NAS/Feedhub before 17:00; batch runs after midnight | System / Analytics teams | Pull files via SFTP → validate header → parse and validate rows → validate trailer/row count → upsert to data tables → update Batch Status → notify | Data tables loaded or whole file rejected with notification |
| BP-002 | Automatic Case Creation | Successful Trigger file load | System | Group by unique Transaction Level Unique ID → validate Active Review Type Template → join Transaction/Employee/Metric → create case → route by Queue Type | BC/RM cases created and queued, or trigger file rejected |
| BP-003 | Manual Case Creation | Analyst initiates | BC/RM Analyst (RBAC-permitted) | Search transactions by Application Date range (mandatory) and Funded Date range (optional) → select transaction → Continue → set Queue Type, Review name, Review Template, Assign to → Create | New case in Initialization → Triage |
| BP-004 | Manual Income Queue Case Creation | Analyst initiates for income queue | BC Analyst | As BP-003 with Income Queue type; inflight updates permitted for Income Queue cases | Income Queue case created |
| BP-005 | Case Triage | Case enters Triage stage | BC/RM Sr Analyst or Manager | Review case, modify SLA/employee/transaction details, assign to analyst or self, add notes → Submit | Case assigned and moved to Review |
| BP-006 | BC Case Review | Case enters Review stage | BC Analyst | Answer review-type questions → rate Lender/Overrider/UW-CA/IVO/RCS/Other roles → select primary and secondary errors → set BC due diligence outcome and Employee Accountable → optionally request second opinion, create lender task, or close out of scope | Ratings recorded, case moves to Recommendation |
| BP-007 | RM Case Review | Case enters Review stage | RM QA Analyst | Answer template questions → rate roles → optionally create fraud task, request second opinion, close incomplete, or seek manager out-of-scope approval | Ratings recorded, case moves to Recommendation |
| BP-008 | Coaching / Escalation / FYI Communication | Rating recorded requiring communication | System, Front Line Manager, Partners | Determine communication method (Real Time / Hold / Consolidate) → resolve escalation level from counter → create task to correct manager level or partner workbasket → capture attestation/reversal response and comments | Partner/manager response captured against the case |
| BP-009 | Reversal and Attestation | Partner or manager receives a rating task | BC Lender / Overrider / Front Line Manager / RM Partners | Review rating and primary error → provide attestation (Yes/No) → optionally request reversal with reason → add comments → Submit within SLA | Reversal status and comments recorded; analyst notified to correct if required |
| BP-010 | Recommendation, Final Rating and Result Sharing | All partner responses received or SLA elapsed | BC/RM Manager | Provide final rating → share final result with partners (manager-only) → for RM, publish to Final Result report | Case ready for closure |
| BP-011 | Case Closure and Reopen | All dependent tasks complete | System / Manager | Set status Resolved-Review Completed; allow authorised Reopen Case | Case closed, retention clock started (7 years after closure year) |
| BP-012 | Historical Case Migration | Weekly migration file arrival | System / BC Analytics | AutoSys poll → copy from NAS → validate → upsert on LegacyCaseID → link historical cases to current cases on Operator ID → notify BC business and Analytics | Historical BC cases (Nov 01 2021 onward) available for Related Cases and counter calculation |

---

## 7. Data Requirements

Business entities only — physical Dataverse design is out of scope for this document.

| ID | Entity | Purpose | Key Attributes (indicative) | Key Relationships |
|---|---|---|---|---|
| DR-001 | Transaction | Lending transaction under review | TRANSACTION_LEVEL_UNIQUE_ID (**PK**), SOURCE*, APPLICATION_DATE*, APPLICATION_NUMBER*, plus 124 further fields incl. SECURITY_TYPE, PRODUCT_TYPE, PRODUCT_FAMILY, APPROVAL_TYPE, CLASS_NUMBER, REFERENCE_NUMBER, COMPASS_NUMBER, MORTGAGE_NUMBER, MMORTGAGE_NUMBER, SALES_CASE_ID, TRANSIT, VALUATION_TYPE, CHANNEL, PROPERTY_TYPE/USAGE, INSURER, PURPOSE, PID, PID_DESCRIPTION, INCOME_TYPE, CRI, CID_DESCRIPTION, CUSTOMER_NAME, SPECIAL_PROGRAM_ID, FUNDED_INDICATOR, APPROVAL_DATE, FUNDED_DATE, DECLINED_DATE, OPERATOR_ID, UNDERWRITER_ID, OVERRIDER_ID, SIMPLII_BROKER_NAME, ADMIN_ROLE_ID, RCS_ID, LOAN_TO_VALUE, PROPERTY_ADDRESS/CITY/POSTAL_CODE/PROVINCE, APPLICANT_BEACON_SCORE, BNI_SCORE, CREDIT_SCORE, TDSR, GDSR, DCR_SUBJECT, DCR_PORTFOLIO, ACTUAL_CREDIT_LIMIT, DECISION, FULFILLMENT_AMOUNT, OPERATOR_LANGUAGE, STATUS, AMORTIZATION_PERIOD, HPP_*, TOTAL_MONTHLY_INCOME, SELF_EMPLOYED_INDICATOR, EMPLOYER_NAME, QUOTED_RATE, REQUESTED_AMOUNT, FUNDED_AMOUNT, VIN, FNF_REFERENCE_NUMBER, APPRAISAL_VALUE, CIBC_PURCHASE_DATE, COBORROWER_NAME (ADD_1), NEW_CONSTRUCTION_INDICATOR (ADD_2), IVO (ADD_3), TRANSACTION_ADDITIONAL_DETAIL_4–15 | 1:M to Case; M:1 to Employee on OPERATOR_ID, UNDERWRITER_ID, OVERRIDER_ID, ADMIN_ROLE_ID, RCS_ID, IVO |
| DR-002 | Employee | Lender/partner employee master | Employee_Level_Unique_ID (**PK**), OPERATOR_ID (unique), COINS_ID, CHANNEL, EMPLOYEE_NAME, EMAIL_ADDRESS, JOB_TITLE, JOB_FAMILY, CITY, PROVINCE, TRANSIT, COMMUNITY, MARKET, REGION, MONTH_IN_ROLE, ACTIVE_IN_ROLE (Y/N/blank), MANAGER_ID, MANAGER, DLA_SIGNING_AUTHORITY, Employee_Additional_Detail_1–5 | Self-referencing manager hierarchy (to 4 levels for escalation); 1:M to Transaction |
| DR-003 | Metric | Employee- and transaction-level review criteria values | Unique_ID (Employee or Transaction level), Metric_Review_Criterion_Description, Metric_Review_Criterion_Value, Entity_Type (Employee/Transaction), Review_Criteria_Type (1=String, 2=Numeric, 3=Boolean) | M:1 to Transaction or Employee via Unique_ID + Entity_Type |
| DR-004 | Trigger | Instruction to create a case | QUEUE_TYPE*, REVIEW_TYPE_TEMPLATE_ID*, TRANSACTION_LEVEL_UNIQUE_ID*, Review_Name*, SourceType (BC/RM) | M:1 to Transaction; drives Case creation |
| DR-005 | Case | BC or RM due diligence case | Case ID (BC-/RM-yyyymmddnnnnn), Case Type, Status, Stage, Case Owner, Originator, Review Template ID/Name, Queue Type, Review Name, Channel, Product Type, Purpose, PID Description, SLA (business days), Created/Updated/Resolved by+when, Duplicate case flag | 1:M to Task, Rating, Note, Attachment; M:1 to Transaction |
| DR-006 | Task / Assignment | Unit of work routed to a user or workbasket | Task Name, Assigned To, Workbasket, Goal, Deadline, Status, Completion Date | M:1 to Case; M:1 to Workbasket |
| DR-007 | Workbasket / Queue | Routing container | Name, Team (BC/RM), Channel scope, Role scope | M:M to Security Role |
| DR-008 | Review Type Template | Configurable question set | Review Type ID (system-generated), Name, Active flag, Queue Type, Channel, PID, Product Type, Purpose, Questions and permitted responses, Team (BC/RM) | 1:M to Case; 1:M to Question |
| DR-009 | Rating and Recommendation | Per-role rating outcome | Role (Lender, Overrider, UW-CA, IVO, RCS, Other 1–3), Operator ID, Employee Name, Primary error, Secondary errors, BC due diligence outcome, Employee Accountable, Alignment change flag, Comments by analyst, Comments by Frontline Manager, Attestation Provided, Reversal Status, Reason for Reversal, Response Date, Final rating, Final Credit Decision, Final Due Diligence, Final DLA, Overturn | M:1 to Case; M:1 to Employee |
| DR-010 | Counter (Coaching/Escalation/FYI) | Running counts per operator | Case ID, Operator ID, Case_Close_Date, Final_Rating, Initial counter when case opened, Final counter when case closed, Counter basis (Fiscal / Rolling 12 months) | M:1 to Employee (Operator ID) |
| DR-011 | Administration Configuration | Business-maintained reference data | Dropdown lists and values; PID → PID_Description; PID Group → PID; BC communication method per channel (Real Time / Hold / Consolidate) + frequency; RM Channel + Review Name + Role real-time list; GetNext BC (Review Template ID + Review Name → Complexity 0–90); GetNext RM (Review Name → Analyst COINS IDs); Counter reset basis | Referenced by Case creation and routing |
| DR-012 | Batch Status | Ingestion run tracking | ID, FileType (T1/T2/E/M/TB/TR), FileName, BusinessDate, FileLoadDate, FileLoadStatus, TableLoadDate, TableLoadStatus, RowsLoaded | Standalone operational entity |
| DR-013 | Legacy / Migrated Case | Historical BC cases from Nov 01 2021 onward | Legacy Case ID (**PK**), Operator ID, historical rating and closure data (full field list **not specified — GAP-002**) | Joined to Case on Operator ID for Related Cases and counters |
| DR-014 | OECP Response | Consolidated coaching/escalation decision | Case_Id*, Lender_Operator_ID*, Attestation_For_Lender_Rating* (Yes/No), Lender_Rating_Reversal_Status, Reason_for_Reversal_for_Lender_Rating, Lender_Final_Rating_Decision_Comment (4000), Overridder_Operator_ID, Attestation_For_Overidr_Rating, Overridder_Rating_Reversal_Status, Reason_for_Reversal_for_Overrider_Rating, Overridder_Final_Rating_Decision_Comment (4000) | M:1 to Case on Case_Id |

**Attachments and documents:** case attachments (Attachment List tab) and case notes/activity feed (Notes and Files tab) are required; supported file types, maximum size and virus-scanning requirements are **not specified — GAP-006**.

---

## 8. Reporting Requirements

| ID | Report | Audience | Purpose | Frequency | Key Content |
|---|---|---|---|---|---|
| RPT-001 | BC Case Search | BC team | Locate cases across all filter criteria; all cases created in the new LDD app are in scope | On demand | Filterable list; sorting single-column non-nested, filtering multi-column nestable |
| RPT-002 | BC Case Search by Lender or Overrider | BC team | Search "Review case details" task and associated fields | On demand | **Filters:** Lender/Overrider (dropdown), Operator ID (text), Reversal Status (dropdown), Employee Name (text), BC Due Diligence (dropdown), Case Owner (text), Case Creation Date (date range picker). **Columns:** Lender/Overrider, Operator ID, Employee Name, BC Due Diligence, Employee Accountable, Reversal Status, Comments by Analyst (4000 chars), Case Owner, Case Creation Date, Case ID, Case Status, Queue Type, Review Name, Transit Number, CLASS_NUMBER, COMPASS_NUMBER, MORTGAGE_NUMBER, MMORTGAGE_NUMBER, Reversal Status |
| RPT-003 | BC Completed Tasks in Open Cases | BC analysts and managers | Summarise tasks completed within still-open (unresolved) cases | On demand | **Key filter:** Case Owner (default = logged-in user; dropdown of all LDD BC team users + "All"). **Columns (all filter-enabled):** Task Description, Assigned to, Case ID, Case Owner, Task Completion Date. **Must support export to Excel.** |
| RPT-004 | RM Final Result Report | RM partners by role and channel | Provide the shared final result to the relevant partner once the RM manager shares it | On demand after sharing | Case ID, Queue Type, Review name, Source, Channel, Transit, Application #, Account Number (single value from MMTG/Mtg#/Ref# ACC/FNF reference/compass number), PID description, CID Description, Operator Language, Product type, Purpose, QA analyst name, Operator Name, Role, 1st Level manager, 2nd Level Manager, Prelim Comments, Partner Feedback, Final QA comments, Overturn, Final Credit Decision, Final Due Diligence, Final DLA, Primary error |
| RPT-005 | Daily Outbound Case Extract (BIX equivalent) | BC/RM Analytics teams; downstream OECP | Provide daily case data for consolidated coaching/escalation processing and analytics | Daily, 05:00 EST, all 7 days | .zip of multiple .csv files, ISO-8859-1 encoding, delivered via SFTP; one `CIBC_RetBnk_LDD_Work_*.csv` record per case plus associated case data |
| RPT-006 | Extract Manifest and Integrity Files | Analytics / Operations | Verify extract completeness and integrity | With every extract | **Manifest:** pxExtractIdentifier, pxApplication (CIBCLDD mj.mn.vn), pxTotalClassInstanceCount, pxExtractDateTime, pxExtractEndDateTime, pxElapsedTime, pxFailedClassInstanceCount, pzCheckSum. **Manifest Summary:** pxExtractidentifier, pxDestinationFile, pxTotalInsertsCount, pxTotalInstanceCount. **ExtractAudit Manifest:** same fields as Manifest. |
| RPT-007 | Operational Batch Status Dashboard | Application Operations, Analytics | Monitor daily ingestion health | Daily / real time | Batch Status entities: FileType, FileName, BusinessDate, FileLoadDate/Status, TableLoadDate/Status, RowsLoaded |

---

## 9. Security Requirements

| ID | Requirement | Source |
|---|---|---|
| SEC-001 | Authenticate via enterprise SSO; no anonymous or local access. | ADD §1.13.1 |
| SEC-002 | Implement role-based access control equivalent to the Pega RBAC model (LDD-145 BC users, LDD-146 RM users), covering roles: BCManager, BCSrAnalyst, BCAnalystLv2, BCAnalyst, BCLender, BCOverrider, BCFrontLineMgr, BCPartner, and the RM equivalents including CA Admin. | ADD §1.13.2 |
| SEC-003 | Grant access by COINS Profile Code; users with the same profile code receive identical access. | ADD Assumption 5 |
| SEC-004 | Enforce workbasket access per the BC access matrix (FR-049) and the RM channel-scoping rule (FR-051). | ADD §2.2.2, §2.2.6.2 |
| SEC-005 | Segregate data by team (BC vs RM), channel and role; RM partners see only their own channel's tasks. | ADD §2.2.6.2 |
| SEC-006 | Enforce separation of duties: Senior (peer review) Analysts may not share preliminary or final results with partners or create BC cases from bulk actions — Managers only. | ADD §2.2.3 |
| SEC-007 | Require manager approval for RM out-of-scope case closure. | ADD §2.2.6.2 |
| SEC-008 | Protect sensitive data: customer names, co-borrower names, property addresses, credit/Beacon/BNI scores, TDSR/GDSR ratios, incomes, employer names, VINs, and employee identifiers. Apply column-level security and mask in exports where not required. | Derived from IA-IN |
| SEC-009 | Exclude parties outside CIBC (FNF Appraisers, ACC and Capital Markets partners) — no access is provided and these parties are out of scope. | ADD Constraint 1 |
| SEC-010 | Users without a COINS ID cannot be granted access; Simplii and MA Channel users do have COINS IDs. Communication with non-COINS parties is handled outside the application by the BC/RM teams. | ADD Constraint 2, Assumption 3 |
| SEC-011 | Maintain a complete audit trail of all case and configuration changes, attributable and timestamped. | ADD §2.2.3 |
| SEC-012 | Encrypt all data in transit (HTTPS/TLS per CIBC SC-83; SFTP for all file feeds) and at rest using platform encryption. | ADD §1.13.3 |
| SEC-013 | Do not rely on hidden or disabled UI controls as an access-control mechanism; enforce authorisation server-side/in the data tier. | Delivery standard |
| SEC-014 | Apply enterprise rules for identity purge and expiry, following COINS ID lifecycle rules. | ADD Assumption 3 |

---

## 10. Integration Requirements

| ID | System | Direction | Purpose | Data Exchanged | Protocol / Format | Schedule |
|---|---|---|---|---|---|---|
| INT-001 | BC Analytics / Feedhub / NAS — Transaction feed | Inbound | Supply transactions eligible for review | `Transaction1.txt`, `Transaction2.txt` — 128 fields, pipe-delimited, UTF-8, header + trailer mandatory | SFTP flat file | Daily, all 7 days; at NAS before 17:00; processed after midnight. Max 50,000 records per file; max 100,000/day (overflow deferred to next day) |
| INT-002 | BC/RM Analytics — Employee feed | Inbound | Supply employee/lender master and manager hierarchy | `Employee.txt` — 24 fields incl. COINS_ID, MANAGER_ID, DLA_SIGNING_AUTHORITY | SFTP flat file | Daily as available |
| INT-003 | BC/RM Analytics — Metric feed | Inbound | Supply employee- and transaction-level review criteria | `Metric.txt` — Unique_ID, Criterion Description/Value, Entity_Type, Review_Criteria_Type | SFTP flat file | Daily as available |
| INT-004 | BC Analytics — BC Trigger feed | Inbound | Instruct BC case creation | `Trigger_bc.txt` — 4 mandatory fields | SFTP flat file | Only when BC business needs cases created |
| INT-005 | RM Analytics — RM Trigger feed | Inbound | Instruct RM case creation | `Trigger_rm.txt` — 4 mandatory fields | SFTP flat file | Only when RM business needs cases created |
| INT-006 | OECP (Coaching/Escalation/FYI tool) via Analytics | Inbound | Return consolidated C/E/FYI decisions | `LDDOECPResponse.txt` — 11 fields keyed on Case_Id | SFTP flat file | Daily as available |
| INT-007 | Legacy BC system (RBSS) via BC Analytics | Inbound | Migrate historical BC cases created Nov 01 2021 onward | `LDDMigration.txt` — PK LegacyCaseID | AutoSys poll → SFTP flat file | Weekly (4 migration runs required) |
| INT-008 | BC/RM Analytics + downstream Analytics DB / Business NAS | Outbound | Provide daily case extract for analytics and OECP processing | Multiple `CIBC_RetBnk_LDD_Work_*.csv` files + manifest, manifestsummary, ExtractAudit manifest, zipped | SFTP `.zip`, ISO-8859-1; functional ID via AutoSys agent | Daily 05:00 EST, all 7 days; up to 3 automatic retries on failure |

**Additional integration dependencies (to be re-platformed):**
- **Identity provider** — Entra ID SSO replacing SAML 2.0 / BranchNet portal launch and the IDR HR-data web service called by Pega at login (**GAP-003**).
- **Email / notification** — Exchange/Outlook via Power Automate for batch success/failure notifications, task notifications and auto-emails (the Pega "Auto Emails" case tab).
- **Scheduling** — AutoSys currently orchestrates file movement; the replacement scheduler must be confirmed (**OQ-008**).

---

## 11. Assumptions

| ID | Assumption | Reason | Impact if Invalid |
|---|---|---|---|
| ASS-001 | Business Controls and Risk Management teams will manage creation of the required identity profiles (COINS equivalents) for system access. | Carried forward from ADD Assumption 1 (Security, status Open). | Access provisioning delays; users unable to log on at go-live. |
| ASS-002 | Quality assurance of the inbound feed files remains the responsibility of the BC and RM Analytics teams. | ADD Assumption 2 (Data, Closed). | Increased in-app validation and reconciliation effort. |
| ASS-003 | Front-line communication for users outside CIBC or without COINS IDs continues to be handled by BC/RM teams by email outside the application. Simplii and MA users do have COINS IDs. COINS ID purge and expiry follow enterprise rules. | ADD Assumption 3 (Process, Closed). | Additional external-user access requirements would materially change the security model. |
| ASS-004 | Users will launch the application from the enterprise portal; the equivalent portal entry point will be confirmed by BC and RM QA. | ADD Assumption 4 (Security, Closed) — Head Office BranchNet portal in Pega. | Launch/navigation rework and user-adoption impact. |
| ASS-005 | Access is granted at profile-code level; users with the same profile code have the same access. | ADD Assumption 5 (Process, Closed). | Requires per-user access design, increasing administration effort. |
| ASS-006 | Each Operator_ID maps to exactly one Employee_Level_Unique_ID and vice versa in the Employee file, for both BC and RM. | ADD Constraint 3 (Data, Closed). | Task assignment and Coaching/Escalation/FYI counters would be incorrect. |
| ASS-007 | The new solution is a **functional parity migration**; no new business capability is in scope beyond closing the accessibility, retention and purging gaps. | No change-scope statement was supplied with the migration request. | Scope, cost and timeline change significantly. |
| ASS-008 | Dataverse is the system of record for cases, ratings, tasks and configuration. | Power Platform First architecture principle. | Superseded if OQ-001 resolves to an external data store. |
| ASS-009 | A p95 response time of 3 seconds for list and search views is acceptable. | No performance NFR was quantified in the source documents. | Performance acceptance criteria and architecture would need revision. |
| ASS-010 | Existing inbound and outbound Interface Agreements (file names, formats, schedules, field specifications) remain unchanged by the migration; only the consuming platform changes. | Minimises upstream/downstream change and Analytics team impact. | Renegotiation of 8 interface agreements with two Analytics teams. |
| ASS-011 | Pega Pulse case notes will be replaced by a Dataverse-native notes/activity feed with equivalent behaviour. | ADD Decision 11 specified Pega Pulse. | Notes UX and history-migration approach would change. |
| ASS-012 | Existing open (in-flight) Pega cases will be migrated to the new platform; the approach is to be confirmed. | Not addressed in any source document. | A parallel-run or dual-system operating period would be required. |
| ASS-013 | The 4-level manager hierarchy required by the escalation matrix is fully derivable from the Employee file `MANAGER_ID` chain. | Employee file provides only a single MANAGER_ID per record. | Escalation to 2nd, 3rd and 4th level managers cannot be resolved. |
| ASS-014 | Existing Jira user stories (project LDD, incl. LDD-140, LDD-145, LDD-146, LDD-323, LDD-1115) remain accessible and will be provided as detailed acceptance criteria. | The ADD repeatedly defers detail to Jira rather than restating it. | Substantial detail gaps across UI, routing, SLA, pre/post-activities and validation rules. |
| ASS-015 | Bilingual (EN/FR) content for errors, ratings and dropdowns will be supplied by the business or migrated from the Pega rulebase. | Screenshots show dual-language error text maintained as data. | Translation effort and content-management design required. |
| ASS-016 | SLA values are expressed in **business days** at case level and in hours at task level, as observed in the UI. | SCR 4 ("SLA (Business Days)") and SCR 9 ("1 hour, 59 minutes from now"). | SLA engine design and escalation timing would change. |
| ASS-017 | Development and testing will occur in non-production environments only, with promotion to production via managed solutions after explicit approval. | Production safety principle. | Production change-control breach. |

---

## 12. Risks

| ID | Risk | Category | Likelihood | Impact | Mitigation |
|---|---|---|---|---|---|
| RSK-001 | Dataverse may not economically sustain ~91.25M Metric rows/month and ~18.25M Transaction rows/month with 30%/15% annual growth. | Architecture / Data | High | High | Resolve **OQ-001** before solution design: evaluate Azure SQL / Microsoft Fabric with Dataverse virtual tables or elastic tables for high-volume reference data; retain Dataverse for case/workflow data. |
| RSK-002 | Case creation is wholly dependent on source data supplied by the Analytics teams in the ingestion files. | Dependency | Medium | High | Carried forward from ADD Architectural Risk 3. Maintain Batch Status monitoring (RPT-007), failure notifications and exception workbasket handling. |
| RSK-003 | The Pega design defers most detailed behaviour (UI, routing, SLA, pre/post activities, validations) to Jira user stories that are not included in the supplied pack. | Requirements | High | High | Obtain the LDD Jira export before solution design; treat FR set as a skeleton requiring story-level elaboration. |
| RSK-004 | Whole-file rejection on any single mandatory-field error can block an entire day's case creation. | Operational | Medium | High | Preserve the rule for parity, but add pre-arrival validation reporting and a documented same-day resubmission path (business resubmits the following day per ADD note). |
| RSK-005 | The 4-level escalation matrix may be unresolvable if the manager hierarchy is incomplete or circular in the Employee feed. | Data quality | Medium | High | Validate hierarchy depth during ingestion; define a fallback routing workbasket for unresolvable escalations. |
| RSK-006 | Accessibility was never delivered in the Pega application; a like-for-like UI port would inherit non-compliance. | Compliance | High | High | Design to WCAG 2.1 AA from the outset (NFR-012/013) and commission an independent audit; do not claim compliance without verification. |
| RSK-007 | Data retention (7 years after closure year) and purging were deferred in Pega and have never been implemented. | Compliance | High | Medium | Implement retention and purge as first-class requirements (NFR-017/018) rather than deferring again. |
| RSK-008 | Migration of in-flight cases and of historical Pega case history is undefined. | Migration | High | High | Resolve **OQ-006** and **OQ-007**; plan a cut-over strategy (drain-down vs. migrate-in-flight) early. |
| RSK-009 | Two Analytics teams and eight interface agreements must be re-pointed at the new platform; any format change triggers renegotiation. | Integration | Medium | High | Hold interfaces byte-identical (ASS-010); change only the endpoint and consuming process. |
| RSK-010 | Nightly ingestion of up to 100,000 transaction rows plus metric volumes may exceed Power Platform / connector throughput limits if implemented with Power Automate alone. | Performance | High | High | Use a bulk data pipeline (Azure Data Factory / Logic Apps / dataflows) for ingestion rather than per-row cloud flow operations. |
| RSK-011 | Concurrent-user volumes, peak load and availability targets are unknown, so capacity and licensing cannot be sized. | Planning | High | Medium | Resolve **OQ-010** and **OQ-011** before solution design; licensing for a Code App requires per-user Power Apps/Premium entitlement confirmation. |
| RSK-012 | Regulatory reporting continuity risk during cut-over — OSFI-facing evidence must remain complete and reconcilable across both platforms. | Compliance | Medium | High | Plan a parallel-run and reconciliation period (SM-06); retain read-only access to Pega data for the retention period. |

---

## 13. Gaps

| ID | Gap | Detail | Required Action |
|---|---|---|---|
| GAP-001 | Detailed user stories absent | The ADD defers UI design, routing, SLA, pre-activities, post-activities, take-action and validation rules to Jira (project LDD) throughout. | Obtain full Jira export for project LDD. |
| GAP-002 | Migration file specification missing | `LDDMigration.txt` field list, data types and lengths are not specified in either Interface Agreement. | Request the migration file IA from BC Analytics (ref RBSSINTK-4529). |
| GAP-003 | IDR HR web service undefined | Pega called IDR directly at login for identity-based HR data; the interface contract is not documented in the supplied pack. | Obtain the IDR interface specification and confirm the Power Platform equivalent. |
| GAP-004 | Accessibility never assessed | ADD §1.9 states LDD was not explicitly developed to follow CIBC accessibility standards. | Full accessibility requirement set and audit plan required (NFR-012/013). |
| GAP-005 | Case status and stage value lists not enumerated | The ADD defers "Case Status List – RM" and "Case Stage - Status List - BC" to Jira. Observed values only: New, Open-Triage, Open-Review, Pending-Branch Response, Resolved-Review Completed. | Obtain the complete status/stage matrix per case type. |
| GAP-006 | Attachment constraints undefined | Permitted file types, maximum size, virus scanning and retention for case attachments are not specified. | Confirm with business and enterprise security. |
| GAP-007 | Error message catalogue empty | ADD §2.3.1 "Error Message Details" table contains no rows. | Build the error catalogue during design. |
| GAP-008 | Unit test specification empty | ADD §6 Unit Testing table contains no rows. | Define the test strategy and coverage. |
| GAP-009 | Reference architecture incomplete | ADD §1.10 states "Final Architecture is pending completion". | Produce target-state Power Platform architecture in Solution Design. |
| GAP-010 | Deployment models empty | ADD §5.2–5.7 (DIT, SIT, UAT, PTE, Production, Other) contain no content. | Define ALM/environment strategy. |
| GAP-011 | Transaction file spec extraction incomplete in source | The Transaction File specification table header row is blank in the supplied document; 128 field rows were recovered, but the column semantics (Format column) are partially unreadable for some rows. | Re-obtain the Transaction IA in a machine-readable form (or the Data Element Catalogue / Top Team export) before data model design. |
| GAP-012 | Extract data mapping is an embedded EMF object | IA-OUT §3.1 "Data File Specification" is an embedded vector image that cannot be rendered or read as text. | Request the outbound field mapping in tabular form. |
| GAP-013 | Logical data model is an embedded EMF object | ADD §3.2 "Lending Due Diligence Logical Data Model" is an embedded EMF diagram that cannot be rendered. | Request the source Visio/ERD for the logical data model. |
| GAP-014 | "Auto Emails" tab content undefined | The tab is listed among the 12 case information tabs but has no design section in the ADD. | Confirm the notification catalogue and email templates. |

---

## 14. Open Questions

**Blocking Decisions** (per delivery governance, these must be resolved by an accountable business/architecture owner — they must not be assumed):

| ID | Question | Category | Blocking? | Owner |
|---|---|---|---|---|
| OQ-001 | Given ~91.25M Metric and ~18.25M Transaction rows per month, is Dataverse the system of record for all entities, or should high-volume Transaction/Metric/Employee data reside in Azure SQL / Microsoft Fabric surfaced through Dataverse virtual or elastic tables? | System of Record | **YES** | Enterprise Architecture |
| OQ-002 | Confirm the data residency requirement and the approved Power Platform / Dataverse geography and tenant for Canadian regulated lending data. | Data Residency | **YES** | Enterprise Architecture / Privacy |
| OQ-003 | Confirm the authentication and authorisation model: Entra ID SSO with COINS profile code → Dataverse security role mapping. What is the authoritative source of the COINS profile code post-Pega? | Authentication / Authorisation | **YES** | Identity & Access Management |
| OQ-004 | Who owns the 8 external file interfaces after migration (Feedhub/NAS/AutoSys ownership, SFTP endpoints, functional IDs), and what is the approved landing zone for inbound and outbound files? | External Integration Ownership | **YES** | Analytics teams + Application Operations |
| OQ-005 | Confirm the production deployment approval path and that no build or configuration will occur directly in production. | Production Deployment | **YES** | Release Management |
| OQ-006 | What is the cut-over strategy for in-flight Pega cases — drain down before go-live, or migrate open cases mid-lifecycle? | Migration | No | Business + Delivery |
| OQ-007 | Must closed Pega case history (and its attachments/notes) be migrated into the new platform, or will Pega be retained read-only for the 7-year retention period? | Migration / Retention | No | Business + Records Management |
| OQ-008 | AutoSys currently schedules file movement and extract jobs. What replaces it, and does the new platform call it or vice versa? | Integration | No | Application Operations |
| OQ-009 | Should the Pega quarterly delete/archive intent for ingested transaction data (ADD Decision 13, deferred) now be implemented, and at what frequency? | Data Retention | No | Business + Records Management |
| OQ-010 | What are the expected concurrent and named user counts per persona, to size licensing and capacity? | Capacity / Licensing | No | Business |
| OQ-011 | What are the formal availability, RTO and RPO targets for LDD? | Availability | No | Enterprise Architecture |
| OQ-012 | Is the OECP tool integration to remain a file round-trip via Analytics, or should it become a direct integration in the new architecture? | Integration | No | Business + EA |
| OQ-013 | Confirm the complete BC and RM case status and stage value lists, including all pending/resolved variants (GAP-005). | Requirements | No | Business |
| OQ-014 | Confirm attachment policy: permitted file types, maximum size, virus scanning and retention (GAP-006). | Security / Requirements | No | Business + Security |
| OQ-015 | Confirm the notification/"Auto Emails" catalogue — triggers, recipients, templates, and EN/FR content (GAP-014). | Requirements | No | Business |
| OQ-016 | Confirm or replace the proposed success metrics SM-01 to SM-06. | Governance | No | Business Sponsor |
| OQ-017 | Confirm the target Power Apps Code App technology stack, component library and hosting model, and whether a shared CIBC design system must be used to reproduce the CIBC brand presentation. | Design | No | Enterprise Architecture / UX |
| OQ-018 | Confirm whether the existing Pega review-type question sets, dropdown values, PID mappings, GetNext complexity tables and communication-method configuration will be exported and loaded as seed data. | Migration | No | Business Administrators |

---

## 15. Requirement Quality Review

| Dimension | Assessment | Action |
|---|---|---|
| **Completeness** | Partial. Case lifecycle, ingestion, administration, security and reporting are well covered. Detailed UI behaviour, validations, SLA values, status lists and notification content are systematically deferred to Jira. | Elaborate FR set against the Jira export (GAP-001) before backlog creation. |
| **Consistency** | Two internal inconsistencies were found in the source: (a) the ADD lists 11–12 case information tabs with "Auto Emails" present in the list but absent from the design detail; (b) the supplied screenshot pack is titled "RM Escalation Flow" but every screenshot shows a **Business Control (BC-)** case. | Confirm the tab list with the business (GAP-014); confirm whether the escalation screenshots represent BC, RM or both flows. |
| **Traceability** | Strong. Every FR/NFR/SEC/INT carries a source reference to a specific ADD section, IA section or screenshot, and every requirement has a unique ID retained in `requirements-baseline.json`. | Preserve IDs through Solution Design, Data Model, backlog and validation. Do not re-issue IDs. |
| **Testability** | Mixed. Ingestion, validation, routing, counters and the escalation matrix are precisely testable. Requirements sourced from "Refer to Jira" statements are not yet testable. | Add measurable acceptance criteria per FR during backlog creation. |
| **Clarity** | Generally good. Weakest requirements: FR-060 (Change Stage — no rules on permitted transitions), FR-074 (tab availability), FR-076 (Additional Metrics — deliberately ambiguous "no indication of which operator" behaviour, which should be re-validated as it may be an accessibility/usability defect rather than a requirement). | Re-validate FR-060, FR-074 and FR-076 with the business. |

---

*This report is the requirements baseline for the LDD Pega → Power Apps Code App migration. It has not yet been validated by the business. Downstream activities (Solution Design, Data Model Design, Azure DevOps backlog, Dataverse provisioning, Code App build) are gated on resolution of Blocking Decisions OQ-001 through OQ-005.*
