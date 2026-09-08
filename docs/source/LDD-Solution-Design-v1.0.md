# Lending Due Diligence (LDD) — Power Platform Solution Design

**Project:** Lending Due Diligence — Pega to Power Apps Code App Migration
**Client:** CIBC — Personal & Business Banking / Simplii Financial
**Document:** Solution Design Document
**Version:** 1.0 (Draft for Review — **not approved**)
**Date:** 27 August 2026
**Author:** Power Platform Solution Architecture
**Requirements Baseline:** `requirements-baseline.json` v1.0 (92 FR, 26 NFR, 23 PER, 12 BP, 14 DR, 7 RPT, 14 SEC, 8 INT)
**Source Documents:** LDD Application Design Document v1.3; LDD Pega Application Document; Lending Due Diligence Ingestion Files IA v2.0; Lending Due Diligence Extract IA v1.5; RM Escalation Flow Screenshots

> **Status notice.** This design is produced with Blocking Decisions **OQ-001 to OQ-005 still open**. Where a blocking decision affects the architecture, this document records a **provisional recommendation** and marks the affected requirement as **Decision Required** in the traceability matrix (Section 16). Provisional recommendations must be confirmed by CIBC Architecture, Security, Privacy and Data Governance before build. This document does not mark itself as approved.

---

## Table of Contents

1. Business Summary
2. Application Strategy
3. Solution Architecture
4. Application Design
5. Business Process Design
6. Conceptual Data Design
7. Document Design
8. Integration Design
9. Security Design
10. Reporting Design
11. Non-Functional Design
12. ALM Strategy
13. Operations Design
14. Architectural Decisions (ADR-001 to ADR-018)
15. Customisation Review
16. Traceability Matrix
17. Assumptions, Risks and Open Questions Carried Forward

---

# 1. Business Summary

## 1.1 Business Problem

CIBC operates a mandatory second-line and first-line quality assurance process over lending decisions. Two teams — **Business Controls (BC)** and **Risk Management Quality Assurance (RM)** — sample and review lending transactions, rate the performance of each role that touched the transaction (Lender, Overrider, Underwriter/Credit Adjudicator, IVO, Funder/RCS and others), and drive the resulting coaching, escalation, FYI or reversal outcomes through the management hierarchy.

That process runs today on **Pega Cloud 8.5.3** (`sit.aimc.cibc.com/prweb/aimsts/app/cibc-lending-due-diligence-application`). The platform presents four problems:

1. **Platform cost and concentration risk** — the Pega estate carries licence and specialist-skill costs disproportionate to the ~20,000 employee / 2,600-case-per-day workload.
2. **Change velocity** — nearly all behavioural detail lives in Jira user stories rather than in the design record; changes require Pega specialists.
3. **Accessibility non-compliance** — ADD §1.9 explicitly records that LDD was **not** developed to CIBC accessibility standards. This is an open compliance exposure.
4. **Unimplemented retention** — the 7-year post-closure purge policy was never implemented in Pega (ADD architectural risk). Regulatory retention is therefore currently manual/absent.

## 1.2 Current State

| Aspect | Current (Pega) |
|---|---|
| Platform | Pega Cloud 8.5.3, ruleset `CIBCLendingDueDiligence` |
| Org structure | CIBC / RetBnk / LDD |
| Work class | `CIBC-RetBnk-LDD-Work` → `pc_CIBC_RetBnk_LDD_Work` |
| Identity | SAML 2.0 SSO; authorisation by COINS Profile Code, RBAC class `CIBC-Auth-Data-RBAC-AIM` |
| Case lifecycle | Initialization → Triage → Review → Recommendation and action |
| Case IDs | `BC-yyyymmddnnnnn`, `RM-yyyymmddnnnnn` |
| Inbound | 7 pipe-delimited UTF-8 files via Feedhub/NAS, SFTP, daily, at NAS before 17:00 |
| Outbound | Daily BIX extract, `.zip` of CSV, ISO-8859-1, 05:00 EST, SFTP via AutoSys functional ID, up to 3 retries |
| Routing | Pega workbaskets (9 BC, 7 RM) + GetNext work |
| Reporting | 4 Pega custom reports + BIX extract |
| Accessibility | Not compliant (ADD §1.9) |
| Retention | Policy defined, **not implemented** |

## 1.3 Future State

A **Power Apps Code App** — a first-class Power Platform application authored in TypeScript/React using the Power Apps Code Apps model and the Power Platform SDK — delivering the full BC and RM due diligence experience, backed by a **hybrid data tier**: Dataverse as the system of record for case, task, rating and configuration data, and an Azure data service as the system of record for the high-volume Transaction, Metric and Employee reference data. Ingestion and extraction move from Pega file listeners to a governed Azure data pipeline. Notification, escalation and SLA orchestration move to Power Automate. Reporting moves to Power BI plus a preserved, byte-compatible outbound extract.

Key future-state improvements over a like-for-like migration:

- **WCAG 2.1 AA conformance designed in** (closes the ADD §1.9 gap).
- **Retention automated** (closes the unimplemented 7-year purge).
- **Interfaces preserved byte-for-byte** so that upstream/downstream Analytics systems are not impacted (ASS-010).
- **Full managed-solution ALM** with a deployment pipeline; no build in Production.

## 1.4 Business Outcomes

| Outcome | Description |
|---|---|
| BO-01 | Retire the Pega LDD application and its associated platform cost and skill dependency |
| BO-02 | Achieve and evidence WCAG 2.1 AA accessibility conformance |
| BO-03 | Achieve auditable, automated compliance with the 7-year retention policy |
| BO-04 | Preserve OSFI-facing lending oversight evidence with no break in the audit record |
| BO-05 | Increase change velocity using mainstream engineering skills (TypeScript/React) and Power Platform ALM |
| BO-06 | Maintain zero-impact continuity for the eight upstream and downstream Analytics interfaces |

## 1.5 Success Measures

Carried from the baseline (SM-01 to SM-06): functional parity across all 92 functional requirements; zero data loss on migration of historical BC cases from 01 Nov 2021; interface continuity with no upstream/downstream change; WCAG 2.1 AA conformance verified by audit; ingestion of a full daily batch within the overnight window; and decommissioning of the Pega LDD application.

## 1.6 Scope

**In scope**

- BC and RM case management across all four lifecycle stages
- All 7 inbound file feeds and the 1 outbound extract
- Administration/configuration hub (dropdowns, PIDs, review types, communication methods, GetNext, counters, escalation matrix)
- Workbasket routing, GetNext work allocation, bulk actions
- Coaching / Escalation / FYI communication, reversal and attestation
- Partner response experience for RM partner channels
- The 4 existing custom reports plus an operational batch dashboard
- Migration of historical BC cases from 01 Nov 2021 (4 migration runs)
- Retention and purge automation

**Out of scope**

- Parties outside CIBC — FNF Appraisers, ACC and Capital Markets partners (ADD Constraint 1); no access is provided
- Users without a COINS ID (ADD Constraint 2); communication with these parties remains manual, outside the application
- Changes to upstream Analytics data production or the OECP tool itself
- Re-engineering of the review methodology, rating scales or error taxonomies
- Any change to the outbound extract's consumers

## 1.7 Constraints

| ID | Constraint | Source |
|---|---|---|
| CON-01 | External parties (FNF, ACC, Capital Markets) must not be granted access | ADD Constraint 1 |
| CON-02 | Access requires a COINS ID; no COINS ID means no access | ADD Constraint 2 |
| CON-03 | Interfaces must remain compatible with existing Analytics producers/consumers | IA-IN, IA-OUT |
| CON-04 | Canadian regulated lending data — residency and privacy controls apply (subject to OQ-002) | NFR-019 |
| CON-05 | Existing publisher prefix and solution naming must not be changed once established | Delivery standard |
| CON-06 | Detailed behavioural rules reside in Jira project LDD, which has not been supplied (GAP-001) | ADD |

---

# 2. Application Strategy

## 2.1 Recommendation

**Recommended architecture: Power Apps Code App (primary) + Power Automate (orchestration) + Power BI (reporting) + Azure data pipeline (ingestion/extraction), over a hybrid Dataverse + Azure data tier.**

This is a directed requirement — the client has specified a Power Apps **Code App** as the migration target. The design validates that choice against the requirement set rather than re-opening it, and records the trade-offs.

| Option | Assessment |
|---|---|
| **Power Apps Code App** ✅ **Recommended** | Full control of a dense, information-rich reviewer UI (role rating tabs, error pickers, counters, hierarchy panels); native WCAG 2.1 AA achievable with a governed component library; TypeScript/React engineering skills; runs on Power Platform with Entra ID, DLP, connector governance and managed-solution ALM |
| Canvas App | Would struggle with the density of the Review workspace (8 role tabs × primary/secondary errors × counters), the bulk-action grids and full AA conformance; formula-based maintainability degrades at this complexity |
| Model-Driven App | Strong for the admin hub and case grids, weak for the guided multi-stage review and partner response experiences; would force UX compromise on the highest-volume screens |
| Model-Driven + Canvas hybrid | Viable but splits the experience across two runtimes and two skill sets; higher lifetime cost than a single Code App |
| Power Pages | Not required — all users are internal COINS-identified CIBC staff; no external/anonymous audience (CON-01, CON-02) |

## 2.2 Rationale

1. **UI density and fidelity.** The screenshots show a reviewer workspace with a four-step stage bar, eight role rating tabs, primary/secondary bilingual error selection, live counters, four levels of manager hierarchy and a partner response panel. A Code App reproduces this faithfully; Canvas would require significant compromise.
2. **Accessibility as a first-class requirement (NFR-012, NFR-013).** A Code App using a governed accessible component library (e.g. Fluent UI v9) with explicit ARIA semantics, focus management and contrast tokens gives the direct control needed to *evidence* AA conformance — the specific gap the Pega app failed.
3. **Bilingual EN/FR (FR-005, NFR-023).** Code apps support standard i18n resource bundles for UI chrome, with data-driven bilingual content (error descriptions, rating codes) served from the data tier — matching the bilingual error display seen in the screenshots.
4. **Platform governance retained.** Code apps are Power Platform citizens: Entra ID authentication, connector-based data access, DLP policy enforcement, solution packaging, environment-scoped ALM. This is materially different from hosting a custom web app outside the platform.
5. **Configuration before code where it fits.** Business-maintained reference data, business rules and notification/SLA orchestration are *not* hard-coded — they run in Dataverse and Power Automate, so BC/RM administrators retain the self-service control they have today (FR-079 to FR-086).

## 2.3 Benefits

- Single application surface for BC, RM, partners and administrators, with role-driven navigation
- Testable front end (unit/component/E2E) — addresses the untested-in-Pega gap
- Reuse of an accessible design system across all 33 screens
- Clean separation of the transactional case store (Dataverse) from the analytical volume store (Azure)

## 2.4 Limitations and Trade-offs

| Limitation | Mitigation |
|---|---|
| Code apps require professional developer skills and a source-controlled pipeline — not maker-maintainable | Establish a dev team and a Power Platform Pipelines/Azure DevOps pipeline (Section 12); keep all business configuration in Dataverse so administrators are not blocked on code releases |
| Code apps are a comparatively young Power Platform capability; feature and regional availability should be re-validated at design freeze | **ADR-002**; confirm code app GA status, supported regions (Canada) and licensing before build commences — carried as a risk |
| Offline and mobile-native scenarios are weaker than Canvas | Not required — desktop, browser-based internal use only |
| No out-of-the-box model-driven admin UI | Admin screens are explicitly designed (SCR-023 to SCR-029) |

## 2.5 Requirement Coverage

Application strategy addresses: FR-001 to FR-006, FR-025 to FR-092, NFR-001, NFR-006 to NFR-008, NFR-012, NFR-013, NFR-021 to NFR-023, SEC-001, SEC-013.

---

# 3. Solution Architecture

## 3.1 Logical Architecture

```
┌────────────────────────── Presentation ──────────────────────────┐
│  APP-001 LDD Code App (TypeScript/React, Power Platform hosted)  │
│   ├─ Worklist & GetNext      ├─ Case Workspace (4 stages)        │
│   ├─ Search & Create         ├─ Partner Response                 │
│   ├─ Bulk Actions            ├─ Admin Hub                        │
│   └─ Operations Dashboard    └─ Reports Hub (embedded Power BI)  │
└────────────────┬─────────────────────────────────────────────────┘
                 │ Power Platform connectors (Dataverse, Office 365,
                 │ Power Automate, Power BI) — DLP governed
┌────────────────▼─────────────── Logic ───────────────────────────┐
│ AUT-001..AUT-012 Power Automate (notification, SLA/escalation,   │
│ task creation, communication method, retention, batch alerting)  │
│ Dataverse business rules, calculated/rollup columns, plug-in     │
│ (only where justified — Section 15)                              │
└────────────────┬─────────────────────────────────────────────────┘
┌────────────────▼─────────────── Data ────────────────────────────┐
│ DAT-001 Dataverse — Case, Task, Rating, Counter, Config, Batch,  │
│         Legacy Case, OECP Response, Notes/Files  (SoR)           │
│ DAT-002 Azure SQL (or Fabric) — Transaction, Metric, Employee    │
│         (SoR for high-volume reference data) [OQ-001]            │
│ DAT-003 Dataverse virtual / elastic tables — read projection of  │
│         DAT-002 into the app and into Dataverse relationships    │
│ DAT-004 Azure Storage landing zone — inbound/outbound files      │
└────────────────┬─────────────────────────────────────────────────┘
┌────────────────▼──────────── Integration ────────────────────────┐
│ INT-001..007 Inbound: Feedhub/NAS → SFTP → ADF ingest pipelines  │
│ INT-008 Outbound: daily .zip CSV extract + manifests → SFTP      │
│ INT-009 Entra ID (identity), INT-010 Exchange (notifications),   │
│ INT-011 Power BI service                                          │
└──────────────────────────────────────────────────────────────────┘
```

## 3.2 Component Register

| Component ID | Name | Type | Purpose | Requirement IDs | Dependencies |
|---|---|---|---|---|---|
| APP-001 | LDD Code App | Power Apps Code App | Primary user experience for BC, RM, partners and administrators | FR-001..FR-006, FR-025..FR-078, NFR-012, NFR-013, NFR-021..NFR-023 | DAT-001, DAT-003, AUT-*, INT-009 |
| APP-002 | Admin Hub module | Code App module | Business-maintained configuration | FR-079..FR-087, NFR-015, SEC-011 | DAT-001 |
| APP-003 | Partner Response module | Code App module | Reversal, attestation and partner response capture | FR-088..FR-091, FR-017 | DAT-001, AUT-003 |
| APP-004 | Operations module | Code App module | Batch status, ingestion errors, extract status | FR-019, RPT-007, NFR-025 | DAT-001, INT-001..008 |
| APP-005 | Accessible Component Library | Shared UI library | Governed accessible, bilingual component set used by all screens | NFR-012, NFR-013, NFR-023, FR-005 | — |
| DAT-001 | LDD Dataverse store | Dataverse | System of record for case, task, rating, counter, configuration, batch, legacy case, OECP response, notes/files | DR-004..DR-014, NFR-014, NFR-017, SEC-008, SEC-011 | — |
| DAT-002 | LDD Analytical Store | Azure SQL Database (provisional — OQ-001) | System of record for Transaction, Metric, Employee high-volume data | DR-001, DR-002, DR-003, NFR-009, NFR-010, NFR-018 | INT-001..003 |
| DAT-003 | Reference Data Projection | Dataverse virtual tables / elastic tables | Exposes DAT-002 to the app and to Dataverse relationships without copying volume | DR-001..DR-003, NFR-008 | DAT-002 |
| DAT-004 | File Landing Zone | Azure Storage (ADLS Gen2) | Inbound and outbound file staging, quarantine, archive | FR-007..FR-013, FR-023, NFR-003 | INT-001..008 |
| DAT-005 | Retention & Purge service | Azure Data Factory + Power Automate | 7-year post-closure purge and ingested-data archival | NFR-017, NFR-018, FR-023 | DAT-001, DAT-002, DAT-004 |
| AUT-001 | Case Creation orchestration | Power Automate (Dataverse/scheduled) | Trigger-file-driven case creation, ID assignment, routing, review type | FR-024..FR-029 | DAT-001, DAT-003 |
| AUT-002 | Communication Method engine | Power Automate + Dataverse rules | Real Time / Hold / Consolidate task creation for BC and RM | FR-083, FR-084, FR-088, FR-089 | DAT-001 |
| AUT-003 | Escalation & Counter engine | Power Automate + Dataverse rollups | Counter maintenance, reset basis, escalation-matrix manager selection | FR-041, FR-085, FR-087, FR-042 | DAT-001, DAT-003 |
| AUT-004 | Notification service | Power Automate + Office 365 Outlook | Task, ingestion, SLA and result notifications | FR-020, FR-021, FR-090, INT-010 | INT-010 |
| AUT-005 | SLA & Reminder service | Power Automate (scheduled) | Partner response SLA elapse, reminders, auto-progression | FR-090, BP-010 | DAT-001 |
| AUT-006 | Bulk Action service | Power Automate (instant, called by app) | BC/RM bulk operations with separation-of-duties enforcement | FR-070..FR-072, SEC-006 | DAT-001 |
| AUT-007 | OECP Round-trip service | Power Automate + ADF | Consolidate-mode outbound request and inbound response reconciliation | FR-012, FR-092, INT-006 | DAT-001, INT-006 |
| AUT-008 | Migration service | Azure Data Factory | 4 historical BC case migration runs from 01 Nov 2021 | FR-013, DR-013, BP-012 | DAT-001, DAT-004 |
| AUT-009 | Audit projection | Dataverse auditing + Power Automate | Immutable audit trail and configuration change log | NFR-014, NFR-015, SEC-011 | DAT-001 |
| INT-001..INT-008 | Inbound/Outbound interfaces | ADF pipelines + SFTP | See Section 8 | INT-001..INT-008 | DAT-004 |
| INT-009 | Entra ID | Identity provider | SSO, group-based role assignment | FR-001, FR-002, NFR-001, SEC-001, SEC-003, SEC-014 | — |
| INT-010 | Exchange Online | Notification channel | Mailbox notifications to `Mailbox.BusinessControlsAnalytics@cibc.com` and `DLFCIAnalytics@cibc.com` | FR-020, FR-021 | — |
| REP-001..REP-007 | Reporting assets | Power BI + app views + extract | See Section 10 | RPT-001..RPT-007 | DAT-001, DAT-002 |

---

# 4. Application Design

## 4.1 Navigation Model

Role-driven shell. The left navigation renders only the modules the signed-in user's security roles permit; hidden navigation is a usability affordance only and is **never** the access control mechanism (SEC-013, NFR-006) — every data operation is authorised in the data tier.

```
LDD Code App
├── Work            → My Worklist | Team Worklist | Get Next Work
├── Cases           → Search | Create Case | Bulk Actions
├── Partner Tasks   → My Responses (RM partner personas)
├── Reports         → BC Case Search | BC by Lender/Overrider | Completed Tasks | RM Final Result
├── Operations      → Batch Status | Ingestion Errors | Extract Status
└── Administration  → Dropdowns | PIDs | Review Types | Communication | Get Next | Counters & Escalation
```

**Default landing** is determined by role (FR-003, FR-004): BC and RM analysts/managers land on **My Worklist**; RM partner personas (PER-12 to PER-16) land on **Partner Tasks**.

## 4.2 Screen Inventory

| Screen ID | Name | Purpose | Personas | Data Sources | Actions | Requirement IDs |
|---|---|---|---|---|---|---|
| SCR-001 | Application Shell / Sign-in | Entra ID SSO, role resolution, language selection, global nav | All | DAT-001, INT-009 | Sign in, switch EN/FR | FR-001, FR-002, FR-005, NFR-001, SEC-001 |
| SCR-002 | My Worklist | Default landing for BC/RM staff; assigned tasks with single-click open | PER-01..04, PER-09..11, PER-17 | DAT-001 | Open, sort (single column), filter, refresh | FR-003, FR-006, FR-056, NFR-021, NFR-022 |
| SCR-003 | Partner Worklist | Default landing for RM partner channels; channel-scoped tasks only | PER-12..PER-16, PER-05..08 | DAT-001 | Open, respond | FR-004, FR-051, SEC-005 |
| SCR-004 | Team Worklist / Workbasket Explorer | Browse BC and RM workbaskets permitted to the user | PER-01..04, PER-09..11 | DAT-001 | Open, assign to self, assign to user | FR-048..FR-051, FR-057 |
| SCR-005 | Get Next Work | Allocate next case by configured algorithm | PER-02, PER-04, PER-11 | DAT-001 | Get next (BC complexity 0–90; RM by review name) | FR-052, FR-054 |
| SCR-006 | Case Search (Transaction Filter) | Locate cases and transactions by multi-criteria filter | PER-01..04, PER-09..11, PER-18, PER-19, PER-23 | DAT-001, DAT-003 | Search, open, export | FR-030 (entry), RPT-001, RPT-002 |
| SCR-007 | Create Case — Transaction Selection | Select the transaction(s) to review | PER-01..04, PER-09..11 | DAT-003 | Filter, select, continue | FR-030 |
| SCR-008 | Create Case — Collect Case Parameters | Capture review type, channel, role scope and case parameters | PER-01..04, PER-09..11 | DAT-001 | Save, create, cancel | FR-031, FR-028 |
| SCR-009 | Case Workspace Shell | Case header summary, 4-stage stepper, status, tab host | All case-touching personas | DAT-001, DAT-003 | Navigate stages/tabs, actions menu | FR-033, FR-075, FR-073, FR-074 |
| SCR-010 | Triage Decision | Record triage decision and progress or exit the case | PER-02, PER-04, PER-10, PER-11 | DAT-001 | Submit decision, close out of scope, cancel | FR-034, FR-035, FR-062 |
| SCR-011 | BC Review — Role Rating Workspace | Rate each in-scope role; capture errors, outcome and comments | PER-02, PER-03, PER-04, PER-01 | DAT-001, DAT-003 | Rate, add/remove role tab, save draft, submit | FR-036, FR-038, FR-039, FR-040 |
| SCR-012 | RM Review — Role Rating Workspace | RM equivalent across UW-CA, IVO, RCS, Lender, Other 1–3 | PER-09..PER-11 | DAT-001, DAT-003 | Rate, save draft, submit | FR-037, FR-038, FR-039 |
| SCR-013 | Error Selection | Bilingual primary/secondary error picker driven by the review template | PER-02..04, PER-10, PER-11 | DAT-001 | Select primary, select secondary, clear | FR-039, FR-005, NFR-023 |
| SCR-014 | Counters & Hierarchy Panel | Show coaching/escalation/FYI counters and 1st–4th level managers | PER-01..04, PER-09..11 | DAT-001, DAT-003 | View, drill to history | FR-041, FR-042, FR-085, FR-087 |
| SCR-015 | BC Recommendation & Final Result | Record recommendation, final rating and communication outcome | PER-01, PER-02 | DAT-001 | Recommend, share result, send for reversal | FR-043, FR-083, SEC-006 |
| SCR-016 | RM Recommendation & Final Result | RM recommendation, final result and partner sharing | PER-09, PER-10 | DAT-001 | Recommend, share result | FR-044, FR-084, SEC-006 |
| SCR-017 | Partner Response / Reversal & Attestation | Partner accepts, declines, reduces to coaching or requests justification | PER-05..08, PER-12..PER-16 | DAT-001 | Respond (4 outcomes), select reason (7 values), comment (4000 chars) | FR-090, FR-091, BP-009 |
| SCR-018 | Task Detail — Second Opinion / Referral / Branch Accountability | Handle specialised BC/RM tasks | PER-03, PER-01, PER-09, PER-17 | DAT-001 | Accept, complete, reassign | FR-064..FR-068 |
| SCR-019 | Case Information Tabs | 12 information tabs (transaction, employee, metrics, ratings, tasks, parties, history, related, notes, attachments, additional metrics, extract) | All case-touching personas | DAT-001, DAT-003 | View, expand, export | FR-073, FR-074, FR-076, FR-077 |
| SCR-020 | Notes & Attachments | Case notes and supporting documents | All case-touching personas | DAT-001 (files) | Add note, upload, download, delete (privileged) | FR-078 |
| SCR-021 | Case History / Audit | Immutable chronological audit of the case | All case-touching personas, PER-23 | DAT-001 audit | View, filter, export | FR-069, NFR-014, SEC-011 |
| SCR-022 | Bulk Actions | Apply an action across a selected set of cases/tasks | PER-01, PER-09 (Managers only for privileged actions) | DAT-001 | Select set, apply action, confirm | FR-070, FR-071, FR-072, SEC-006 |
| SCR-023 | Admin Hub | Landing page for all business configuration | PER-18, PER-19 | DAT-001 | Navigate | FR-079, FR-086 |
| SCR-024 | Admin — Dropdown Maintenance | Maintain application dropdown values | PER-18, PER-19 | DAT-001 | Add, edit, deactivate | FR-080, NFR-015 |
| SCR-025 | Admin — PID Maintenance | Maintain Product Identifier reference data | PER-18, PER-19 | DAT-001 | Add, edit, deactivate | FR-081 |
| SCR-026 | Admin — Review Type Maintenance | Maintain review templates and their active state | PER-18, PER-19 | DAT-001 | Add, edit, activate/deactivate | FR-082, FR-022 |
| SCR-027 | Admin — Communication Method | BC Real Time/Hold/Consolidate; RM Channel+ReviewName+Role combinations | PER-18, PER-19 | DAT-001 | Add combination, set method | FR-083, FR-084 |
| SCR-028 | Admin — Get Next Configuration | BC complexity (0–90, increments of 1) by Review Template ID + Review Name; RM Review Name → Analyst COINS IDs | PER-18, PER-19 | DAT-001 | Add, edit, remove | FR-053, FR-055 |
| SCR-029 | Admin — Counters, Reset Basis & Escalation Matrix | Fiscal Year (Nov 01–Oct 31) or Rolling 12 months; escalation levels | PER-18, PER-19 | DAT-001 | Set basis, edit matrix | FR-085, FR-087 |
| SCR-030 | Operations — Batch Status Dashboard | File type / load status / row counts / errors per run | PER-22, PER-20, PER-21 | DAT-001, DAT-002 | View, drill to errors, re-run request | FR-019, RPT-007, NFR-025 |
| SCR-031 | Reports Hub | Embedded Power BI reports and exports | PER-01, PER-09, PER-18..23 | REP-* | View, filter, export | RPT-001..RPT-004 |
| SCR-032 | Modify Employee / Transaction Details | Correct employee or transaction attributes on an in-flight case | PER-01, PER-02, PER-09, PER-10 | DAT-001, DAT-003 | Edit, save (audited) | FR-058, FR-059, FR-032 |
| SCR-033 | Case Actions | Change stage, cancel, close out of scope, close incomplete, reopen | PER-01, PER-02, PER-09, PER-10 | DAT-001 | Change stage, cancel, close, reopen | FR-045, FR-046, FR-047, FR-060..FR-063, SEC-007 |

## 4.3 Key User Journeys

| Journey | Path |
|---|---|
| **BC analyst reviews a triggered case** | SCR-001 → SCR-002 (or SCR-005 Get Next) → SCR-009 → SCR-010 Triage → SCR-011 Review (+ SCR-013, SCR-014) → SCR-015 Recommendation → SCR-033 Close |
| **RM analyst reviews a triggered case** | SCR-001 → SCR-002 → SCR-009 → SCR-010 → SCR-012 (+ SCR-013, SCR-014) → SCR-016 → SCR-033 |
| **Partner responds to a rating** | SCR-001 → SCR-003 → SCR-017 → response recorded → AUT-003 counter update → originating case task closes |
| **Manual case creation** | SCR-001 → SCR-006/SCR-007 → SCR-008 → case created → SCR-009 |
| **Administrator changes configuration** | SCR-001 → SCR-023 → SCR-024..SCR-029 → change audited (NFR-015), applies to new cases only (FR-086) |
| **Operations investigates a failed load** | SCR-001 → SCR-030 → error detail → notification to Analytics mailbox (AUT-004) |

## 4.4 Accessibility Design Considerations

Accessibility is designed in, not asserted. Considerations only — **no compliance claim is made** and conformance must be verified by audit (NFR-012).

- All 33 screens built from APP-005, a single governed accessible component library
- Full keyboard operability including the stage stepper, role rating tabs and grids; visible focus indicators; logical tab order; skip links
- Semantic landmarks and ARIA roles; grids as accessible data tables with programmatic row/column headers
- Colour contrast tokens meeting AA; status and rating never conveyed by colour alone (paired icon + text)
- Errors announced through live regions with programmatic association to their field; bilingual error text (FR-005)
- Responsive layout supporting 400% zoom and 320 CSS px reflow
- Accessible names for all controls in both EN and FR; language of page and of parts declared
- Planned verification: automated axe scans in CI, manual NVDA/JAWS testing, and a CIBC accessibility audit before go-live

---

# 5. Business Process Design

Implementation approach follows Configuration Before Code. No workflows are built by this skill.

## BP-001 — Daily File Ingestion

| Aspect | Design |
|---|---|
| Trigger | Files present at Feedhub/NAS before 17:00; batch executes after midnight, all 7 days |
| Actors | BC Analytics (PER-20), RM Analytics (PER-21), Application Operations (PER-22) |
| Major steps | 1. SFTP pull to DAT-004 landing zone → 2. Header validation → 3. Trailer/row-count validation → 4. Row-level validation → 5. Upsert to DAT-002/DAT-001 → 6. Batch Status update → 7. Notification |
| Decision points | Header valid? Trailer count matches? Row valid? Review template active? Daily cap (100,000 transactions) exceeded? |
| Audit events | Batch Status record per file (FileType T1, T2, E, M, TB, TR; FileLoadStatus/TableLoadStatus 0=complete, 1=not started, default 1); per-row rejection log |
| Notifications | Failure and success notifications to `Mailbox.BusinessControlsAnalytics@cibc.com` (BC) and `DLFCIAnalytics@cibc.com` (RM); **one error per row** in the notification (FR-017) |
| Exception handling | Whole-file reject on header/trailer failure with file moved to quarantine; row-level reject with the valid remainder loaded; overflow beyond 100,000/day deferred to the next day; files retained per FR-023 |
| Implementation | **Azure Data Factory** pipelines (INT-001..007) + **Power Automate** for notification (AUT-004) + Dataverse Batch Status (DAT-001) |
| Requirements | FR-007..FR-024, NFR-003, NFR-009, NFR-025 |

## BP-002 — Automatic Case Creation

| Aspect | Design |
|---|---|
| Trigger | Successful Trigger file load (Trigger_bc.txt / Trigger_rm.txt) |
| Actors | System |
| Major steps | Duplicate trigger check → case create → assign Case ID (`BC-`/`RM-yyyymmddnnnnn`) → determine Review Type → route to workbasket → set stage Initialization → Triage |
| Decision points | Duplicate? Review template active? Routing rule matched? |
| Audit events | Case created, routed, review type assigned |
| Notifications | None to end users; failures raise an exception-workbasket item |
| Exception handling | Unroutable or invalid triggers go to `BCExceptionWB` (FR-029) |
| Implementation | **Power Automate** AUT-001 triggered by ADF completion, with Dataverse business rules for review-type derivation |
| Requirements | FR-024..FR-029, FR-026, FR-022 |

## BP-003 — Manual Case Creation

Trigger: analyst initiates. Actors: PER-01..04, PER-09..11. Steps: search/filter transaction (SCR-006/007) → collect case parameters (SCR-008) → create → route. Decision points: transaction in scope? duplicate open case? Audit: case created (manual, with creating operator). Exception: duplicate detection returns the existing case. Implementation: **Code App + Dataverse business rules**; case-ID assignment by AUT-001. Requirements: FR-030, FR-031, FR-026, FR-027.

## BP-004 — Manual Income Queue Case Creation

As BP-003 with the income-queue review type and its specific parameter set and routing. Implementation: **Code App configuration of the same creation service** (no separate flow). Requirements: FR-030, FR-031, FR-028.

## BP-005 — Case Triage

Trigger: case enters Triage. Actor: analyst/senior analyst. Steps: open case → review transaction and metric context → record triage decision (SCR-010) → progress to Review, close as out of scope, or cancel. Decision points: in scope? correct review type? Audit: triage decision, decider, timestamp. Notifications: none by default. Exception: out-of-scope closure follows FR-062 (RM requires manager approval — SEC-007). Implementation: **Code App + Dataverse**. Requirements: FR-034, FR-035, FR-062, FR-061.

## BP-006 — BC Case Review

| Aspect | Design |
|---|---|
| Trigger | Case enters Review stage |
| Actors | PER-02, PER-03, PER-04, PER-01 |
| Major steps | Open role rating tabs (Lender, Overrider, UW-CA, IVO, RCS, Other 1–3) → select primary and secondary errors → record due diligence outcome → view counters and manager hierarchy → submit |
| Decision points | Which roles are in scope? Error severity? Coaching / Escalation / FYI? Second opinion required? Referral to RM? |
| Audit events | Each rating save, each error selection change, each submission |
| Notifications | Driven by communication method (AUT-002): Real Time creates the partner task immediately; Hold defers; Consolidate routes via OECP |
| Exception handling | Incomplete role ratings block submission; validation surfaced accessibly |
| Implementation | **Code App** (rating UX) + **Dataverse** (rules, rollups) + **Power Automate** AUT-002/AUT-003 |
| Requirements | FR-036, FR-038..FR-042, FR-064, FR-066..FR-068, FR-083 |

## BP-007 — RM Case Review

As BP-006 for the RM roles and channels, with RM-specific workbaskets, the RM default **Hold** communication method (FR-084), fraud review task creation (FR-065), and channel scoping (FR-051, SEC-005). Requirements: FR-037..FR-042, FR-051, FR-065, FR-084.

## BP-008 — Coaching / Escalation / FYI Communication

| Aspect | Design |
|---|---|
| Trigger | A rating is recorded that requires communication |
| Actors | System, analyst, manager, partner |
| Major steps | Determine communication method (Real Time / Hold / Consolidate) → increment counter → apply escalation matrix (0 or 1 → 1-level-up manager; 2 → 2-level-up; 3 → 3-level-up; 4+ → 4-level-up) → create the task for the selected manager/partner → notify |
| Decision points | Method? Counter value? Manager available at the required level? |
| Audit events | Counter increment, escalation level selected, task created |
| Notifications | Email to task recipient (AUT-004) |
| Exception handling | Missing manager at the required level routes to the general workbasket and raises an operations alert (relates to RSK-005) |
| Implementation | **Power Automate** AUT-002 + AUT-003, **Dataverse** rollups and configuration |
| Requirements | FR-041, FR-083..FR-089, FR-087 |

**Counter rules preserved:** reset basis is Fiscal Year (**Nov 01 – Oct 31**) or Rolling 12 months (current date − 365), configurable (FR-085); counters are calculated at **Operator ID level irrespective of role**; **RM ratings are excluded from BC counters**.

## BP-009 — Reversal and Attestation

Trigger: partner or manager receives a rating task. Actors: PER-05..08, PER-12..16, PER-01, PER-09. Steps: open task (SCR-017) → respond with one of **Reversal Accepted / Reversal Declined / Reduced to Coaching / Justification Required** → select reason from **LDDM Error, Risk Mgmt Error, Underwriter Error, Back Office Error, Documents provided Post review, Lender Benefit, Other** → add comment (4000 characters) → submit. Decision points: reversal outcome; does the outcome change the counter? Audit: response, reason, comment, responder, timestamp. Notifications: originating analyst notified. Exception: no response within SLA → AUT-005 escalates/auto-progresses. Implementation: **Code App + Power Automate**. Requirements: FR-090, FR-091, FR-041.

## BP-010 — Recommendation, Final Rating and Result Sharing

Trigger: all partner responses received or SLA elapsed. Actors: PER-01, PER-02, PER-09, PER-10. Steps: consolidate responses → record recommendation and final rating (SCR-015/SCR-016) → share result. Decision points: final rating; who may share (**Managers only** — Senior Analysts may not share preliminary or final results, SEC-006). Audit: recommendation, final rating, sharing event. Notifications: result notification to partners/managers. Exception: unresolved responses recorded and the case proceeds with an exception note. Implementation: **Code App + Power Automate** AUT-005, with server-side separation-of-duties enforcement. Requirements: FR-043, FR-044, SEC-006.

## BP-011 — Case Closure and Reopen

Trigger: all dependent tasks complete. Actors: PER-01, PER-02, PER-09, PER-10. Steps: verify open tasks → close case → set resolved status (e.g. Resolved-Review Completed) → start retention clock. Reopen re-activates the case, re-opens the required stage and is fully audited (FR-047). Decision points: outstanding tasks? RM close-incomplete path (FR-063)? Audit: closure, resolution, reopen with reason. Implementation: **Code App + Dataverse + Power Automate** (retention clock to DAT-005). Requirements: FR-045, FR-046, FR-047, FR-063, NFR-017.

## BP-012 — Historical Case Migration

Trigger: weekly migration file arrival (`LDDMigration.txt`). Actors: BC Analytics, Application Operations. Steps: load → validate → map to Legacy Case entity (PK `LegacyCaseID`, joined on Operator ID) → reconcile counts → report. Decision points: duplicate legacy case? unmatched operator? Audit: migration run record and reconciliation report. Exception: unmatched rows quarantined and reported. Implementation: **Azure Data Factory** AUT-008 over **4 migration runs**, covering BC cases from **01 Nov 2021**. Requirements: FR-013, DR-013, SM-02.

---

# 6. Conceptual Data Design

No Dataverse tables, columns or physical schema are created here — that is the Data Model Design skill's responsibility.

## 6.1 Conceptual Entities and Systems of Record

| Entity (DR) | Description | Proposed System of Record | Ownership | Volume driver |
|---|---|---|---|---|
| DR-001 Transaction | Lending transaction under review; 128 data fields; PK `TRANSACTION_LEVEL_UNIQUE_ID` | **DAT-002 Azure SQL** (provisional — OQ-001), projected via DAT-003 | BC Analytics | 18,250,000/month; 50,000/day; max 50,000/file; max 100,000/day; +15%/yr |
| DR-002 Employee | Lender/partner employee master; 24 fields | **DAT-002**, projected via DAT-003 | BC/RM Analytics | 20,000/month |
| DR-003 Metric | Employee- and transaction-level review criteria values; 5 fields | **DAT-002** | BC/RM Analytics | **91,250,000/month; +30%/yr** |
| DR-004 Trigger | Instruction to create a case (BC 4 fields, RM 4 fields) | **DAT-001 Dataverse** (staged), source file in DAT-004 | BC/RM Analytics | 2,600/day each |
| DR-005 Case | BC or RM due diligence case | **DAT-001 Dataverse** | LDD application | ~2,600/day created |
| DR-006 Task / Assignment | Unit of work routed to a user or workbasket | **DAT-001 Dataverse** | LDD application | Multiple per case |
| DR-007 Workbasket / Queue | Routing container (9 BC, 7 RM) | **DAT-001 Dataverse** (configuration) | BC/RM Administrators | Low |
| DR-008 Review Type Template | Configurable question/error set | **DAT-001 Dataverse** (reference) | BC/RM Administrators | Low |
| DR-009 Rating and Recommendation | Per-role rating outcome, errors, comments (4000 chars) | **DAT-001 Dataverse** | LDD application | ~8 per case max |
| DR-010 Counter | Coaching/Escalation/FYI running counts per operator | **DAT-001 Dataverse** (rollup/derived) | LDD application | ~20,000 operators |
| DR-011 Administration Configuration | Dropdowns, PIDs, review types, communication methods, GetNext, escalation matrix, counter reset basis | **DAT-001 Dataverse** (reference) | BC/RM Administrators | Low |
| DR-012 Batch Status | Ingestion run tracking; FileType T1, T2, E, M, TB, TR; status 0/1 | **DAT-001 Dataverse** | Application Operations | ~7/day |
| DR-013 Legacy / Migrated Case | Historical BC cases from 01 Nov 2021; PK `LegacyCaseID` | **DAT-001 Dataverse** (or DAT-002 if volume dictates — OQ-001) | BC Analytics | 4 migration runs |
| DR-014 OECP Response | Consolidated coaching/escalation decision; 11 fields, transformation rules TR001–TR003 | **DAT-001 Dataverse** | OECP via Analytics | 2,600/day |

## 6.2 Conceptual Relationships

```
Trigger (DR-004) ──creates──▶ Case (DR-005)
Case ──references──▶ Transaction (DR-001) ──has──▶ Metric (DR-003)
Case ──references──▶ Employee (DR-002) ──reports to──▶ Employee (manager hierarchy, 4 levels)
Case ──has many──▶ Task (DR-006) ──routed to──▶ Workbasket (DR-007) or User
Case ──has many──▶ Rating (DR-009) ──per role──▶ Employee
Rating ──increments──▶ Counter (DR-010) ──per Operator ID──
Case ──typed by──▶ Review Type Template (DR-008)
Case ──may have──▶ OECP Response (DR-014)
Ingestion Run ──recorded in──▶ Batch Status (DR-012)
Legacy Case (DR-013) ──joined on Operator ID──▶ Employee (DR-002)
Configuration (DR-011) ──governs──▶ routing, communication, GetNext, escalation
```

## 6.3 Data Split Rationale (provisional — OQ-001)

Dataverse is the correct system of record for **case, task, rating, counter, configuration and audit** data: it provides the relationship model, role-based security, column-level security, auditing, business rules and the connector surface the Code App and Power Automate need.

Dataverse is **not** the appropriate system of record for the Metric and Transaction feeds. At **91.25 million Metric rows per month growing 30% per year**, plus **18.25 million Transaction rows per month growing 15% per year**, the storage and API-throughput profile falls well outside a normal Dataverse transactional workload and would create both a cost and a performance risk (RSK-001, NFR-010).

The provisional design therefore places DR-001, DR-002 and DR-003 in **DAT-002 (Azure SQL Database, or Microsoft Fabric if the CIBC data platform standard directs)** and projects only the rows a case actually needs into the application through **DAT-003 Dataverse virtual tables** (read) and/or elastic tables where write-back is required. This preserves a single relational experience in the app while keeping bulk volume in a store designed for it.

**This split is provisional and requires OQ-001 to be answered by CIBC Data Architecture.**

## 6.4 Sensitive Data

The following are classified sensitive and require column-level security, masked export and restricted reporting (SEC-008, NFR-020): customer and co-borrower names; property addresses; credit / Beacon / BNI scores; TDSR and GDSR ratios; incomes; employer names; VINs; employee identifiers (COINS ID, Operator ID, employee number); manager hierarchy identifiers.

## 6.5 Reference Data

Dropdown values, PIDs, review types and their error taxonomies, communication method combinations, GetNext complexity configuration, escalation matrix, counter reset basis, workbasket definitions and role-to-workbasket routing. All business-maintained through APP-002; all changes audited (NFR-015); changes apply to **new cases only** — in-flight cases retain the configuration they were created with (FR-032, FR-086).

---

# 7. Document Design

| Aspect | Design |
|---|---|
| Documents generated | Case attachments (supporting evidence uploaded by reviewers and partners); outbound extract `.zip` and manifest files; migration reconciliation reports; ingestion error reports |
| Storage — case attachments | **Dataverse file/image columns** on the case and task entities. Rationale: attachments are small, low-volume, case-scoped, and inherit Dataverse's row-level and role-based security and audit automatically. SharePoint document-set integration was considered and rejected as it would fragment the security model across two stores for no functional gain |
| Storage — interface files | **DAT-004 Azure Storage (ADLS Gen2)** with `inbound/`, `quarantine/`, `outbound/`, `archive/` zones. Not SharePoint — these are machine-to-machine batch artefacts |
| Naming standards | Interface filenames preserved **exactly and case-sensitively**: `Transaction1.txt`, `Transaction2.txt`, `Employee.txt`, `Metric.txt`, `Trigger_bc.txt`, `Trigger_rm.txt`, `LDDOECPResponse.txt`, `LDDMigration.txt`; outbound `CIBC_RetBnk_LDD_Work_*.csv` inside a `.zip`, plus Manifest, Manifest Summary and ExtractAudit Manifest. Archived copies suffixed with the processing date |
| Metadata | Case attachments carry case ID, task ID, uploading operator, upload timestamp, document type and sensitivity flag |
| Access | Attachment access follows the parent case's security; partners see only attachments on their own tasks |
| Versioning | Attachments are append-only — replacement creates a new version and retains the prior one for audit; deletion is a privileged, audited action |
| Retention | Attachments follow the case retention clock (7 years after the year of closure, NFR-017); interface files follow FR-023 and NFR-018 |
| Encoding | Inbound UTF-8, pipe-delimited; outbound **ISO-8859-1** — encoding must be preserved exactly to avoid downstream breakage |

---

# 8. Integration Design

## 8.1 Integration Register

| ID | Source | Target | Purpose | Data Exchanged | Trigger Pattern | Monitoring | Classification | Requirements |
|---|---|---|---|---|---|---|---|---|
| INT-001 | BC Analytics / Feedhub / NAS | DAT-002 via DAT-004 | Transaction feed | `Transaction1.txt`, `Transaction2.txt` — pipe-delimited UTF-8, **128 fields**, PK `TRANSACTION_LEVEL_UNIQUE_ID` | Scheduled batch; at NAS before 17:00, processed after midnight, all 7 days | Batch Status (T1/T2), row-count reconciliation, failure notification | **Confirmed** (source), **Decision Required** (endpoint ownership — OQ-004) | FR-007, FR-014..FR-019, NFR-003, NFR-009 |
| INT-002 | BC/RM Analytics | DAT-002 via DAT-004 | Employee feed incl. manager hierarchy | `Employee.txt` — 24 fields | Scheduled batch, daily | Batch Status (E) | **Confirmed** / endpoint **Decision Required** | FR-008, DR-002, FR-042 |
| INT-003 | BC/RM Analytics | DAT-002 via DAT-004 | Metric feed | `Metric.txt` — 5 fields, ~91.25M rows/month | Scheduled batch, daily | Batch Status (M), volume alerting | **Confirmed** / target store **Decision Required** (OQ-001) | FR-009, DR-003, NFR-010 |
| INT-004 | BC Analytics | DAT-001 via DAT-004 | BC Trigger feed → case creation | `Trigger_bc.txt` — 4 fields, ~2,600/day | Scheduled batch, daily | Batch Status (TB), duplicate/exception reporting | **Confirmed** | FR-010, FR-024..FR-029 |
| INT-005 | RM Analytics | DAT-001 via DAT-004 | RM Trigger feed → case creation | `Trigger_rm.txt` — 4 fields, ~2,600/day | Scheduled batch, daily | Batch Status (TR) | **Confirmed** | FR-011, FR-024..FR-029 |
| INT-006 | OECP via Analytics | DAT-001 | Consolidated coaching/escalation decision round-trip | `LDDOECPResponse.txt` — 11 fields, transformation rules **TR001, TR002, TR003**, ~2,600/day | Scheduled batch, daily (response leg); outbound leg via INT-008 | Reconciliation of requests sent vs responses received | **Confirmed** | FR-012, FR-092, DR-014 |
| INT-007 | Legacy BC system (RBSS) via BC Analytics | DAT-001 | Historical BC case migration | `LDDMigration.txt` — PK `LegacyCaseID`, joined on Operator ID, cases from 01 Nov 2021 | Weekly during migration; **4 runs** | Reconciliation report per run | **Confirmed**, one-time | FR-013, DR-013, BP-012 |
| INT-008 | LDD (DAT-001 + DAT-002) | BC/RM Analytics, downstream Analytics DB / Business NAS | Daily outbound case extract (BIX equivalent) | `.zip` of `CIBC_RetBnk_LDD_Work_*.csv`, **ISO-8859-1**, plus Manifest, Manifest Summary, ExtractAudit Manifest | Scheduled daily **05:00 EST**, SFTP via AutoSys functional ID, up to **3 retries** | Extract status, checksum/row-count validation, retry-exhaustion alert | **Confirmed** | RPT-005, RPT-006, NFR-025 |
| INT-009 | Microsoft Entra ID | APP-001, DAT-001 | Authentication and group-based role assignment | User identity, group membership, COINS profile attribute | Interactive, per sign-in | Sign-in logs, conditional access reporting | **Recommended** — mapping of COINS profile code to Entra groups is **Decision Required** (OQ-003) | FR-001, FR-002, SEC-001, SEC-003, SEC-014, NFR-001 |
| INT-010 | Power Automate | Exchange Online | Notifications to users and Analytics mailboxes | Task, ingestion, SLA and result notifications; `Mailbox.BusinessControlsAnalytics@cibc.com`, `DLFCIAnalytics@cibc.com` | Event-driven and scheduled | Flow run history, failure alerts | **Recommended** | FR-020, FR-021, FR-090 |
| INT-011 | Power BI Service | APP-001 (embedded) | Report delivery inside the app | Aggregated case, rating, counter and batch data | Interactive; scheduled dataset refresh | Refresh history, capacity metrics | **Recommended** | RPT-001..RPT-004, RPT-007 |

## 8.2 Integration Principles

- **No API is invented.** All eight file interfaces are preserved as file-based SFTP exchanges with identical filenames, delimiters, encodings, field order and schedules. Where the source documents do not state an authentication mechanism (e.g. the SFTP credential model beyond "AutoSys functional ID"), it is recorded as **Decision Required** (OQ-004), not assumed.
- **Secrets are never stored in the solution.** All SFTP and database credentials are referenced from **Azure Key Vault** via managed identity; connection references and environment variables carry the *pointers* only (NFR-004).
- **Idempotency.** All ingestion is upsert-based on the documented primary keys (FR-018), so a re-run of a batch is safe.
- **Quarantine over discard.** Rejected files and rows are retained in DAT-004 `quarantine/` for investigation, never silently dropped.
- **Reconciliation is mandatory.** Every run reconciles trailer count against loaded count and records the result in Batch Status.

## 8.3 Integration Gaps

- Extract IA §3.1 Data File Specification is an unreadable embedded EMF object (GAP-013) — the outbound field list must be recovered from the source system or the Analytics team before build.
- ADD §3.2 logical data model is likewise unreadable (GAP-012).
- The Transaction specification header row was blank in conversion; 128 fields were recovered positionally and require confirmation (GAP-011).

---

# 9. Security Design

## 9.1 Identity Strategy

Authentication moves from **Pega SAML 2.0** to **Microsoft Entra ID SSO** (NFR-001, SEC-001). No anonymous access, no local accounts. Authorisation continues to be driven by the **COINS Profile Code** — users with the same profile code receive identical access (SEC-003).

The mapping mechanism from COINS Profile Code to Power Platform security roles is a **Blocking Decision (OQ-003)**. Two options are documented in ADR-005; neither is assumed. Users without a COINS ID cannot be granted access (SEC-010, CON-02); external parties are excluded entirely (SEC-009, CON-01). Identity purge and expiry follow the enterprise COINS ID lifecycle (SEC-014).

## 9.2 Security Roles

| Role ID | Name | Purpose | Key Capabilities | Requirement IDs |
|---|---|---|---|---|
| ROL-001 | LDD BC Manager | BC team leadership | All BC case actions; **share preliminary and final results**; create cases from bulk actions; assign work; all BC workbaskets | FR-070, FR-072, SEC-006, PER-01 |
| ROL-002 | LDD BC Senior Analyst | Peer review | All BC review actions; **may not share results or create cases from bulk actions** | SEC-006, PER-02 |
| ROL-003 | LDD BC Analyst Level 2 | Second opinion | Second-opinion tasks; `BCSecondOpinionWB` | FR-066, PER-03 |
| ROL-004 | LDD BC Analyst | Core reviewer | Triage, review, rate, recommend; GetNext BC | FR-034..FR-043, FR-052, PER-04 |
| ROL-005 | LDD BC Lender | Rated party | View and respond to own rating tasks only | FR-090, FR-091, PER-05 |
| ROL-006 | LDD BC Overrider | Rated approver | View and respond to own rating tasks only | FR-090, FR-091, PER-06 |
| ROL-007 | LDD BC Front Line Manager | People leader | Receive escalation tasks per the escalation matrix; respond; view own team's cases | FR-087, FR-042, PER-07 |
| ROL-008 | LDD BC Partner | Partner stakeholder | Channel-scoped task access | FR-051, PER-08 |
| ROL-009 | LDD RM Manager | RM leadership | All RM case actions; share results; **approve RM out-of-scope closure** | SEC-006, SEC-007, FR-062, PER-09 |
| ROL-010 | LDD RM Senior Analyst | RM peer review | All RM review actions; may not share results | SEC-006, PER-10 |
| ROL-011 | LDD RM QA Analyst | Core RM reviewer | Triage, review, rate, recommend; GetNext RM | FR-037, FR-054, PER-11 |
| ROL-012 | LDD RM Partner — Underwriter/CA | Underwriting & adjudication partners | `RMUnderwriterWB`, `RMCreditAdjudicatorWB`; own channel only | FR-051, SEC-005, PER-12, PER-13 |
| ROL-013 | LDD RM Partner — Funder/IVO/Lender | Funding, income verification, lending partners | `RMFunderWB`, `RMIVOWB`, `RMLenderWB`; own channel only | FR-051, SEC-005, PER-14..16 |
| ROL-014 | LDD RM Fraud Reviewer | Fraud team | `RMFraudWB`; fraud review tasks | FR-065, PER-17 |
| ROL-015 | LDD BC Administrator | BC configuration owner | Admin Hub — BC scope; all changes audited | FR-079..FR-087, NFR-015, PER-18 |
| ROL-016 | LDD RM Administrator | RM configuration owner | Admin Hub — RM scope | FR-079..FR-087, PER-19 |
| ROL-017 | LDD Operations | Platform operations | Batch status, ingestion errors, extract status, re-run request; **no case data modification** | FR-019, RPT-007, PER-22 |
| ROL-018 | LDD Auditor (read-only) | Regulatory assurance | Read-only access to cases, ratings, history and configuration audit; no write anywhere | NFR-014, NFR-016, SEC-011, PER-23 |
| ROL-019 | LDD Analytics (read-only) | Upstream/downstream data teams | Batch status and extract visibility | PER-20, PER-21, RPT-005..007 |

## 9.3 Data Access Strategy

- **Business-unit / team segmentation** — BC and RM data are segregated; a BC role cannot read RM case data and vice versa, except for explicitly designed cross-team referral tasks (FR-067) (SEC-005).
- **Workbasket access matrix** — the BC access matrix (FR-049) and RM channel scoping (FR-051) are enforced as data-tier access rules, not UI filters.
- **Row-level scoping for rated parties** — Lenders, Overriders and partners see only records where they are the rated party or the assigned respondent.
- **Column-level security** on the sensitive attributes listed in §6.4 (SEC-008).
- **Separation of duties** — enforced server-side: Senior Analysts cannot share results or bulk-create cases; RM out-of-scope closure requires manager approval (SEC-006, SEC-007).
- **No security through obscurity** — hidden or disabled UI controls are usability affordances only; every operation is independently authorised at the data tier (SEC-013, NFR-006).
- **No public API surface** is exposed beyond the platform's governed connectors (NFR-005).

## 9.4 Audit Requirements

Dataverse auditing is enabled for all case, task, rating, counter and configuration entities. The audit record captures create, update, stage/status transition, assignment, sharing, closure and reopen events with actor and timestamp, and is immutable to application users (NFR-014, SEC-011). Administrative configuration changes are separately logged with before/after values (NFR-015). Audit data is retained for the full 7-year retention period and is exportable for OSFI-facing evidence (NFR-016).

## 9.5 Sensitive Data Controls

Column-level security profiles restrict the §6.4 attributes to roles with a demonstrated need; exports and reports mask these fields unless the consuming role is explicitly entitled; the outbound extract carries only the fields the existing IA specifies. Data in transit is encrypted (HTTPS/TLS per CIBC **SC-83**; SFTP for all feeds) and at rest by platform encryption (SEC-012, NFR-002, NFR-003). **No secrets or credentials are stored in application configuration or source control** (NFR-004) — Azure Key Vault with managed identity is used throughout.

## 9.6 Data Residency

All Dataverse, Azure SQL, Azure Storage and Power BI assets must be provisioned in a **Canadian region**. This is recorded as **Blocking Decision OQ-002** and must be confirmed by CIBC Privacy and Data Governance, including confirmation that the Power Apps Code App runtime and all connectors used are available and compliant in that region. **Not assumed.**

---

# 10. Reporting Design

| Report ID | Name | Audience | Purpose | Data Sources | Delivery | Frequency | Requirements |
|---|---|---|---|---|---|---|---|
| REP-001 | BC Case Search | BC team (PER-01..04) | Locate BC cases by multi-criteria filter | DAT-001, DAT-003 | In-app view (SCR-006) + Power BI | On demand | RPT-001 |
| REP-002 | BC Case Search by Lender or Overrider | BC team | Locate cases by rated party | DAT-001 | In-app view + Power BI | On demand | RPT-002 |
| REP-003 | BC Completed Tasks in Open Cases | BC analysts and managers | Track task completion within open cases | DAT-001 | Power BI (embedded, SCR-031) | On demand / daily refresh | RPT-003 |
| REP-004 | RM Final Result Report | RM partners by role and channel | Communicate final results within channel scope | DAT-001 | Power BI with **RLS by channel and role** | On demand / daily refresh | RPT-004, FR-051, SEC-005 |
| REP-005 | Daily Outbound Case Extract | BC/RM Analytics; downstream OECP | Byte-compatible replacement for the Pega BIX extract | DAT-001 + DAT-002 | `.zip` of `CIBC_RetBnk_LDD_Work_*.csv`, ISO-8859-1, SFTP | Daily 05:00 EST, 3 retries | RPT-005, INT-008, NFR-025 |
| REP-006 | Extract Manifest and Integrity Files | Analytics / Operations | Manifest, Manifest Summary, ExtractAudit Manifest for integrity verification | DAT-001 | SFTP alongside REP-005 | Daily with REP-005 | RPT-006 |
| REP-007 | Operational Batch Status Dashboard | Application Operations, Analytics | File type, load status, row counts, rejects, timings per run | DAT-001, DAT-002 | In-app (SCR-030) + Power BI | Near real time | RPT-007, FR-019, NFR-025 |

**Reporting principles.** Power BI datasets read from DAT-002 (volume) and DAT-001 (case context) rather than from the app. Row-level security in Power BI mirrors the Dataverse security model so a report can never reveal what the app would not. Sensitive fields (§6.4) are excluded or masked unless the consuming role is entitled. The outbound extract (REP-005/006) is treated as a **contract** — its structure, encoding and schedule may not change without a formal interface change with the Analytics teams.

---

# 11. Non-Functional Design

## 11.1 Performance

- Case list and search views target **p95 ≤ 3 seconds** under normal load (NFR-008) — this target is carried from the requirements baseline and is itself derived, not stated in the Pega ADD; it requires confirmation with the business.
- Server-side paging, filtering and sorting on all grids; no client-side retrieval of unbounded result sets.
- Transaction and Metric data are queried through DAT-003 projections with indexed predicates; the app never scans the full volume store.
- Flow and service call minimisation per NFR-007 — batch related Dataverse operations, avoid per-row calls in loops.
- **No performance target is invented** beyond those already carried in the baseline; all targets remain provisional until confirmed.

## 11.2 Scalability

The data tier must sustain **~91,250,000 Metric rows/month (+30%/yr)** and **~18,250,000 Transaction rows/month (+15%/yr)** (NFR-010). The hybrid split (§6.3) is the design response. Elastic scale is provided by the Azure store; Dataverse volume is bounded by case/task/rating growth (~2,600 cases/day) which is comfortably within normal operating parameters. Capacity is reviewed against actual growth quarterly (Section 13).

## 11.3 Availability

Availability must meet the CIBC standard for a regulatory tier application (NFR-011). The specific SLA target is **not stated in the source documents** and is not invented here — it is carried as a dependency on CIBC Service Management. Design provisions: no single custom hosting dependency, platform-native redundancy, and an ingestion design that is safely re-runnable so a missed overnight window can be recovered without data loss.

## 11.4 Auditability

Per §9.4. Every case, rating, assignment, sharing, closure, reopen and configuration change is attributable, timestamped and immutable to application users (NFR-014, NFR-015).

## 11.5 Privacy and Compliance

OSFI lending-practice oversight obligations for CIBC PBB and Simplii are supported through the complete, exportable audit record (NFR-016). Personal data controls per §9.5 (NFR-020). **Retention is automated** (DAT-005): case data is purged **7 years after the year in which the case is closed** (NFR-017) — closing the gap that Pega never implemented — and ingested transaction data is archived/purged on a defined cycle (NFR-018). Purge is a controlled, audited, reversible-until-committed process with a documented legal-hold exception path.

## 11.6 Accessibility

Per §4.4. **WCAG 2.1 Level AA** and CIBC accessibility standards are the design target (NFR-012, NFR-013). This document documents accessibility *considerations* only and makes **no compliance claim**; conformance must be established by formal audit before go-live.

## 11.7 Localisation

Full English and French localisation of UI chrome, notifications and rating/error content (NFR-023, FR-005). UI strings come from i18n resource bundles; data-driven bilingual content (error descriptions, dropdown labels, rating codes) is stored as paired EN/FR values in the reference data so administrators maintain both languages together (FR-080). Notification templates exist in both languages and are selected by the recipient's language preference. Date, number and currency formatting follow the active locale.

## 11.8 Maintainability

Data elements carry an explicit maximum length matching the interface specification (NFR-024) — for example the 4000-character comment fields — enforced consistently in the data tier, the API layer and the UI so truncation cannot occur silently at any boundary.

---

# 12. ALM Strategy

## 12.1 Environments

| Environment | Purpose | Type | Data | Notes |
|---|---|---|---|---|
| **DEV** | Development and unit test | Developer / Sandbox, Dataverse enabled | Synthetic only | Unmanaged solution; one per developer stream where required |
| **DIT** | Development integration test | Sandbox | Synthetic + masked | First environment where the full inbound/outbound pipeline is exercised end to end |
| **SIT** | System integration test | Sandbox | Masked production-like | Interface testing with the Analytics teams against real file formats |
| **UAT** | Business acceptance | Sandbox | Masked production-like, representative volume | Accessibility audit and performance validation performed here |
| **PROD** | Production | Production | Live | **Managed solution only. Never built in directly** |

A **volume/performance environment** (or a UAT refresh loaded to representative volume) is required to validate NFR-009 and NFR-010 before go-live.

## 12.2 Solution Strategy

- One primary solution: **`CIBCLendingDueDiligence`** — preserving the existing Pega ruleset name for continuity of understanding.
- Optional split into a **core/data solution** and an **application solution** if team size or release cadence justifies it; a single solution is recommended initially for simplicity.
- **Unmanaged in DEV; managed everywhere else.** No unmanaged layers in DIT, SIT, UAT or PROD.
- Solution segmentation used to keep the code app, flows, tables, security roles and connection references in an explicit, reviewable component list.

## 12.3 Publisher

Publisher and customisation prefix are established once at solution creation and **are never changed thereafter** (CON-05). The prefix must be confirmed against the CIBC Power Platform publisher standard before the first solution is created — recorded as an open item, not assumed here.

## 12.4 Environment Variables and Connection References

All environment-specific values are externalised — no hard-coded endpoints:

| Type | Examples |
|---|---|
| Environment variables | SFTP host and path per feed; Azure SQL/Fabric endpoint; Storage account and container names; BC and RM notification mailboxes; extract schedule time and retry count; counter reset basis default; feature flags |
| Connection references | Dataverse; Office 365 Outlook; Azure Data Factory / Azure Storage; Power BI; SFTP (via the governed integration layer) |
| Key Vault | All credentials and connection secrets — referenced, never stored in the solution (NFR-004) |

Connections in PROD are owned by a service principal / service account, never by a named individual.

## 12.5 Source Control and Build

- The code app source lives in **Azure Repos (Git)** with pull-request review, branch policies and no direct commits to `main`.
- Solution components are exported unpacked to the same repository so schema and app code version together.
- CI: lint, unit tests, component tests, **automated accessibility scans (axe)**, solution checker.
- CD: **Power Platform Pipelines** or Azure DevOps pipelines promoting managed solutions DEV → DIT → SIT → UAT → PROD, gated by approvals at UAT and PROD.
- Solution Checker must pass with no high-severity findings before promotion.

## 12.6 Deployment and Cutover

Cutover is a coordinated event across the app, the data tier and eight interfaces. Design provisions: the 4 historical migration runs complete and reconcile before go-live; interface producers/consumers are cut over on an agreed date with a rollback path to Pega; a parallel-run window is recommended for the outbound extract so Analytics can compare Pega and LDD output byte-for-byte before the Pega feed is retired. **Production deployment approval is Blocking Decision OQ-005.**

---

# 13. Operations Design

| Aspect | Design |
|---|---|
| **Ownership** | Business ownership sits with the BC and RM leadership (PER-01, PER-09). Configuration ownership sits with the BC and RM Business Administrators (PER-18, PER-19). Technical ownership sits with the Power Platform application support team (PER-22). Data production remains owned by BC/RM Analytics (PER-20, PER-21) |
| **Support model** | L1 service desk → L2 application support (Power Platform) → L3 development team. Data-content issues route to the owning Analytics team, not to application support |
| **Monitoring** | Batch Status dashboard (SCR-030, RPT-007); ADF pipeline monitoring and alerting; Power Automate flow failure alerts; Dataverse and Azure resource telemetry via Application Insights / Azure Monitor; Entra ID sign-in monitoring; extract retry-exhaustion alerting (3 retries, NFR-025) |
| **Alerting** | Ingestion failure and success notifications to `Mailbox.BusinessControlsAnalytics@cibc.com` and `DLFCIAnalytics@cibc.com` (FR-020, FR-021); operational alerts to the support team for pipeline, flow and extract failures |
| **Incident handling** | Standard CIBC incident process. Ingestion is idempotent (upsert on documented keys), so a failed batch is recovered by re-running the pipeline. Rejected files and rows remain in `quarantine/` for investigation. Case-data incidents follow an audited correction path — never direct data manipulation in PROD |
| **Capacity management** | Quarterly review of Dataverse storage, Azure store growth against the +30%/yr Metric and +15%/yr Transaction projections, Power Platform request limits and Power BI capacity. Retention/purge (DAT-005) is the primary structural control on growth |
| **Archiving** | Automated: cases purged 7 years after the year of closure (NFR-017); ingested transaction data archived/purged on a defined cycle (NFR-018); interface files archived per FR-023. Legal-hold exception path documented |
| **Knowledge transfer** | Solution design, data model, runbooks (ingestion, extract, migration, purge, cutover), administrator guide for the Admin Hub, and developer onboarding documentation. Because the app is code-based, a documented local development environment and contribution guide are mandatory deliverables |
| **Business continuity** | Recovery objectives to be confirmed with CIBC Service Management (dependency, see §11.3); ingestion re-runnability and platform-native backup are the design provisions |

---

# 14. Architectural Decisions

| ADR ID | Decision |
|---|---|
| ADR-001 | Power Apps Code App as the primary application platform |
| ADR-002 | Validate Power Apps Code App maturity, regional availability and licensing before build |
| ADR-003 | Hybrid data tier — Dataverse for case data, Azure store for high-volume reference data |
| ADR-004 | Dataverse virtual/elastic tables as the projection mechanism |
| ADR-005 | Entra ID for authentication; COINS profile code mapping mechanism to be confirmed |
| ADR-006 | Azure Data Factory for file ingestion and extraction, replacing Pega file listeners |
| ADR-007 | Preserve all eight interfaces byte-for-byte |
| ADR-008 | Power Automate for orchestration, notification and SLA management |
| ADR-009 | Dataverse file columns for case attachments (not SharePoint) |
| ADR-010 | Configuration held as Dataverse reference data, not in code |
| ADR-011 | Power BI for reporting with security-mirroring RLS |
| ADR-012 | Automate retention and purge (closing the Pega gap) |
| ADR-013 | Accessibility delivered through a single governed component library |
| ADR-014 | Server-side authorisation only — no security through UI concealment |
| ADR-015 | Azure Key Vault for all secrets, referenced never stored |
| ADR-016 | Managed-solution ALM with a gated pipeline; never build in Production |
| ADR-017 | Configuration changes apply to new cases only; in-flight cases are immutable to config change |
| ADR-018 | Parallel-run the outbound extract before retiring the Pega feed |

---

**ADR-001 — Power Apps Code App as the primary application platform**
*Context:* The Pega LDD app must be migrated to Power Platform. The reviewer experience is dense and must reach WCAG 2.1 AA, which the Pega app never did.
*Options:* Canvas App; Model-Driven App; Canvas + Model-Driven; **Power Apps Code App**; custom web app outside Power Platform.
*Recommended:* Power Apps Code App.
*Rationale:* Direct control of a complex, information-dense, bilingual UI; achievable and evidenceable AA conformance; mainstream engineering skills; retains Power Platform governance (Entra ID, DLP, connectors, solution ALM) that a standalone web app would forfeit. Directed by the client.
*Risks:* Requires professional developer capability and a source-controlled pipeline; not maker-maintainable; platform maturity (see ADR-002).
*Requirements:* FR-001..FR-006, FR-025..FR-092, NFR-012, NFR-013.

**ADR-002 — Validate Code App maturity, regional availability and licensing before build**
*Context:* Power Apps code apps are a comparatively recent capability; regional availability and licensing must be confirmed for a Canadian regulated workload.
*Options:* Proceed on assumption (rejected); validate at design freeze with Microsoft and CIBC licensing (**recommended**); fall back to Model-Driven + Canvas hybrid if validation fails.
*Recommended:* Validate before build, with the hybrid as the documented fallback.
*Rationale:* Blocking-risk avoidance; the fallback preserves the delivery timeline.
*Risks:* If code apps are unavailable in the required Canadian region, the application strategy changes materially.
*Requirements:* NFR-019, ADR-001 dependency. **Links to OQ-002.**

**ADR-003 — Hybrid data tier: Dataverse for case data, Azure store for high-volume reference data**
*Context:* Metric ~91.25M rows/month (+30%/yr) and Transaction ~18.25M rows/month (+15%/yr) sit far outside a normal Dataverse transactional profile.
*Options:* All in Dataverse (cost/throughput risk); all in Azure SQL (loses Dataverse security, audit, business rules, connector surface); **hybrid split**; Microsoft Fabric as the analytical store.
*Recommended:* Hybrid — Dataverse SoR for case/task/rating/counter/configuration/audit; Azure SQL (or Fabric per CIBC standard) SoR for Transaction, Metric, Employee.
*Rationale:* Each store used for what it is designed for; preserves Dataverse security and audit where regulatory evidence is required, without paying Dataverse economics for 91M rows/month.
*Risks:* Two stores to operate; cross-store query performance; consistency management.
*Requirements:* DR-001..DR-003, NFR-009, NFR-010, RSK-001. **Provisional — blocked on OQ-001.**

**ADR-004 — Dataverse virtual/elastic tables as the projection mechanism**
*Context:* The app and Dataverse relationships need Transaction/Metric/Employee data without copying volume into Dataverse.
*Options:* Virtual tables (read); elastic tables (write-capable, high throughput); direct connector calls from the app to Azure SQL; scheduled replication into standard tables (rejected — reintroduces the volume).
*Recommended:* Virtual tables for read projection, elastic tables where write-back or high-throughput staging is required, with direct query only for bulk reporting paths.
*Rationale:* Keeps one relational experience in the app and one security model, without duplicating volume.
*Risks:* Virtual-table query capability and performance constraints must be proven in a spike before commitment.
*Requirements:* DR-001..DR-003, NFR-008.

**ADR-005 — Entra ID authentication; COINS profile code mapping to be confirmed**
*Context:* Pega authenticated via SAML 2.0 and authorised by COINS Profile Code through RBAC class `CIBC-Auth-Data-RBAC-AIM`. The post-Pega authoritative source for that mapping is unknown.
*Options:* (a) Entra ID security groups provisioned from the COINS profile code by the enterprise identity process, mapped 1:1 to Dataverse security roles; (b) COINS profile code carried as a user attribute and mapped to roles by a Dataverse-held mapping table maintained by administrators.
*Recommended:* **No option is selected.** Option (a) is preferred architecturally as it keeps entitlement in the enterprise identity system, but the decision depends on CIBC Identity and Access Management.
*Rationale:* Inventing an entitlement source for a regulated application is not acceptable.
*Risks:* Delivery blocker if unresolved; role provisioning cannot be built until decided.
*Requirements:* FR-001, FR-002, SEC-001, SEC-003, SEC-014. **Blocked on OQ-003.**

**ADR-006 — Azure Data Factory for file ingestion and extraction**
*Context:* Pega file listeners execute a 9-step ingestion flow over 7 inbound files plus a BIX extract.
*Options:* Power Automate alone (rejected — unsuitable at 91M rows/month); Azure Data Factory (**recommended**); Azure Functions; Logic Apps; Fabric Data Pipelines.
*Recommended:* Azure Data Factory pipelines with SFTP connectors, staged through ADLS Gen2, with Power Automate handling only the notification and case-creation triggers.
*Rationale:* Purpose-built for the volume and the validation/quarantine pattern; native monitoring and retry; keeps Power Automate within its performance envelope.
*Risks:* Adds an Azure component to a Power Platform solution — justified in Section 15; requires Azure operational ownership.
*Requirements:* FR-007..FR-024, RPT-005, RPT-006, NFR-009, NFR-025.

**ADR-007 — Preserve all eight interfaces byte-for-byte**
*Context:* Eight interfaces are shared with upstream and downstream Analytics systems that are out of scope for change.
*Options:* Modernise to APIs (rejected — forces change on out-of-scope systems); **preserve file contracts exactly**; hybrid.
*Recommended:* Preserve filenames (case-sensitive), delimiters, encodings (UTF-8 in, ISO-8859-1 out), field order, schedules and retry counts exactly.
*Rationale:* Zero-impact continuity is an explicit success measure.
*Risks:* Carries forward legacy file-based patterns; ISO-8859-1 encoding must be handled deliberately to avoid character corruption.
*Requirements:* INT-001..INT-008, ASS-010, SM-03.

**ADR-008 — Power Automate for orchestration, notification and SLA management**
*Context:* Case creation, communication method, escalation, notification, SLA and bulk actions need server-side orchestration.
*Options:* Code in the app (rejected — business logic must survive UI change and remain configurable); Dataverse plug-ins (only where justified); **Power Automate**; Azure Logic Apps.
*Recommended:* Power Automate, with Dataverse business rules and rollups used first where they suffice.
*Rationale:* Configuration before code; visible, supportable, auditable orchestration.
*Risks:* Flow throughput must be sized against ~2,600 cases/day and their task fan-out.
*Requirements:* FR-024..FR-029, FR-083..FR-090, FR-070..FR-072.

**ADR-009 — Dataverse file columns for case attachments**
*Context:* Reviewers and partners attach supporting evidence to cases.
*Options:* SharePoint document integration; **Dataverse file columns**; Azure Blob with a custom access layer.
*Recommended:* Dataverse file columns.
*Rationale:* Attachments inherit the case's row-level security, audit and retention automatically; SharePoint would fragment the security model across two stores and complicate the 7-year purge.
*Risks:* Dataverse file storage consumption — bounded by attachment volume and controlled by retention.
*Requirements:* FR-078, NFR-017, SEC-008.

**ADR-010 — Configuration as Dataverse reference data, not code**
*Context:* BC and RM administrators self-serve dropdowns, PIDs, review types, communication methods, GetNext configuration, escalation matrix and counter reset basis today.
*Options:* Hard-code in the app (rejected — makes administrators dependent on code releases); **Dataverse reference tables surfaced through the Admin Hub**.
*Recommended:* Dataverse reference data with an audited maintenance UI.
*Rationale:* Preserves current business autonomy despite the app being code-based; keeps release cadence independent of configuration change.
*Risks:* Configuration integrity depends on validation rules being thorough.
*Requirements:* FR-079..FR-087, NFR-015.

**ADR-011 — Power BI for reporting with security-mirroring RLS**
*Context:* Four Pega custom reports plus operational reporting must be replaced.
*Options:* In-app views only; **Power BI embedded in the app**; Power BI standalone; paginated reports.
*Recommended:* In-app views for operational search (SCR-006), Power BI embedded for analytical and management reporting, with RLS mirroring the Dataverse security model.
*Rationale:* Report security must never exceed application security; embedding keeps a single user experience.
*Risks:* RLS drift between Power BI and Dataverse — mitigated by deriving both from the same role definitions and testing them together.
*Requirements:* RPT-001..RPT-004, RPT-007, SEC-005.

**ADR-012 — Automate retention and purge**
*Context:* The 7-year post-closure purge policy was defined but **never implemented in Pega** — a live compliance exposure.
*Options:* Continue manual/absent (rejected); **automated, audited purge service**; platform long-term retention only.
*Recommended:* DAT-005 automated purge with an audited, controlled process and a documented legal-hold exception path.
*Rationale:* Closes a known compliance gap and is the primary structural control on data growth.
*Risks:* Irreversible deletion — mitigated by staged soft-delete, reconciliation and approval before commit.
*Requirements:* NFR-017, NFR-018, FR-023.

**ADR-013 — Accessibility through a single governed component library**
*Context:* NFR-012/013 require WCAG 2.1 AA across 33 screens; the Pega app was non-compliant.
*Options:* Per-screen accessibility remediation (rejected — does not scale, regresses); **shared accessible component library (APP-005)** with automated CI scanning.
*Recommended:* Shared library plus axe scans in CI plus manual screen-reader testing plus formal audit.
*Rationale:* Conformance achieved once and inherited everywhere; regressions caught in CI.
*Risks:* Automated scanning catches only a portion of AA criteria — manual testing and audit remain mandatory. **No compliance claim is made.**
*Requirements:* NFR-012, NFR-013, NFR-023, FR-005.

**ADR-014 — Server-side authorisation only**
*Context:* SEC-013 and NFR-006 forbid relying on hidden UI controls for access control; a code app makes client-side concealment especially unreliable.
*Options:* UI-driven visibility (rejected); **data-tier enforcement** with UI visibility as usability only.
*Recommended:* Every operation authorised in Dataverse security (roles, column-level security, row scoping) and in the service layer for the Azure store.
*Rationale:* The client is untrusted; regulatory data requires enforceable authorisation.
*Risks:* Requires disciplined design of the security model up front.
*Requirements:* SEC-004, SEC-005, SEC-006, SEC-013, NFR-006.

**ADR-015 — Azure Key Vault for all secrets**
*Context:* SFTP, database and service credentials are required by the ingestion and extract pipelines.
*Options:* Store in environment variables (rejected); store in source control (prohibited); **Key Vault referenced by managed identity**.
*Recommended:* Key Vault with managed identity; solution artefacts hold pointers only.
*Rationale:* NFR-004 and CIBC security standards prohibit stored secrets.
*Risks:* Key Vault access policy management becomes an operational dependency.
*Requirements:* NFR-004, SEC-012.

**ADR-016 — Managed-solution ALM with a gated pipeline**
*Context:* A regulated application requires controlled, evidenced change.
*Options:* Manual solution export/import (rejected); **automated pipeline DEV → DIT → SIT → UAT → PROD** with approvals.
*Recommended:* Managed solutions everywhere except DEV; Solution Checker gate; accessibility scan gate; approvals at UAT and PROD. **Never build in Production.**
*Rationale:* Repeatability, auditability and rollback.
*Risks:* Requires pipeline setup effort before the first release.
*Requirements:* NFR-026.

**ADR-017 — Configuration changes apply to new cases only**
*Context:* FR-032 requires in-flight case immutability; FR-086 bounds administrative change scope.
*Options:* Apply configuration changes retrospectively (rejected — would alter in-flight regulatory reviews); **apply to new cases only**, with in-flight cases retaining their creation-time configuration.
*Recommended:* Version reference data and stamp the effective configuration onto the case at creation.
*Rationale:* Protects the integrity of reviews already under way and their audit record.
*Risks:* Requires reference-data versioning in the physical model — an explicit input to the Data Model Design skill.
*Requirements:* FR-032, FR-086, NFR-014.

**ADR-018 — Parallel-run the outbound extract before retiring the Pega feed**
*Context:* The outbound extract feeds downstream Analytics and OECP; a defect would propagate silently.
*Options:* Direct cutover (rejected); **parallel run with byte-level comparison** over an agreed window.
*Recommended:* Parallel run, compare Pega and LDD output, sign-off by Analytics before Pega retirement.
*Rationale:* The extract specification is partly unreadable in the source (GAP-013), so empirical verification is essential.
*Risks:* Extends the cutover window and requires both systems to run concurrently.
*Requirements:* RPT-005, RPT-006, INT-008, GAP-013.

---

# 15. Customisation Review

Every departure from out-of-the-box configuration is justified below. Items are listed in Configuration-Before-Code order.

| Item | Type | Business Reason | Alternatives Considered | Security Impact | Operational Impact | Recommendation |
|---|---|---|---|---|---|---|
| **LDD Code App (APP-001)** | Power Apps Code App | Reviewer workspace density (8 role tabs, bilingual error selection, counters, 4-level hierarchy), bilingual UI, and evidenceable WCAG 2.1 AA — the specific compliance gap of the Pega app | Canvas (UI density and AA risk); Model-Driven (poor fit for guided review); hybrid (two runtimes) | Runs inside Power Platform with Entra ID, DLP and connector governance; authorisation enforced server-side (ADR-014) | Requires professional dev team, Git, CI/CD; not maker-maintainable | **Approved by client direction; justified.** Validate platform maturity per ADR-002 |
| **Accessible Component Library (APP-005)** | Shared UI library | Achieve AA once and inherit across 33 screens | Per-screen remediation | None | Library versioning and governance required | **Justified** |
| **Azure Data Factory (INT-001..008, AUT-008, DAT-005)** | Azure service | 91.25M Metric rows/month is far beyond Power Automate's envelope; needs staging, validation, quarantine, reconciliation and retry | Power Automate (rejected on volume); Azure Functions (more custom code); Logic Apps (weaker for bulk data); Fabric pipelines (viable alternative subject to OQ-001) | Managed identity + Key Vault; no secrets in solution; SFTP over encrypted transport | Requires Azure operational ownership and monitoring alongside Power Platform | **Justified by volume** |
| **Azure SQL Database / Fabric (DAT-002)** | Azure service | System of record for Transaction, Metric, Employee at a volume Dataverse should not carry | All-in-Dataverse (cost/throughput risk); replication into Dataverse (reintroduces volume) | Data resides outside Dataverse security — service-layer authorisation and column-level controls required; residency per OQ-002 | Second data store to operate, back up and patch | **Justified — provisional pending OQ-001** |
| **Dataverse virtual / elastic tables (DAT-003)** | Platform configuration | Project external volume into the app without copying it | Direct connector calls from the app (loses relationship model) | Inherits Dataverse security surface for the projected columns | Query capability limits must be proven in a spike | **Justified — spike required** |
| **Azure Storage landing zone (DAT-004)** | Azure service | File staging, quarantine and archive for eight interfaces | SharePoint (unsuitable for machine batch artefacts); direct-to-database (loses quarantine/replay) | Private endpoints, managed identity, encryption at rest | Lifecycle management rules required for archive/purge | **Justified** |
| **Azure Key Vault** | Azure service | Mandatory secret custody (NFR-004) | Environment variables (rejected) | Positive — removes secrets from the solution | Access policy management | **Justified** |
| **Power BI (REP-001..007)** | Power Platform | Replace Pega custom reports and provide management reporting | In-app views only (insufficient for management/analytical reporting) | RLS must mirror Dataverse security | Dataset refresh and capacity management | **Justified** |
| **Dataverse plug-ins** | Custom code | **None proposed at this stage.** Business rules, rollups, calculated columns and Power Automate are expected to cover the requirement set | — | — | — | **Not required.** If a specific requirement (e.g. transactional counter integrity under concurrency, FR-041) proves unachievable with configuration, a narrowly scoped plug-in may be proposed at Data Model Design with its own justification |
| **PCF controls** | Custom code | **None proposed.** The Code App renders its own UI; PCF is not required | — | — | — | **Not required** |
| **Custom connectors** | Custom code | **None proposed.** All integration is file-based via ADF, or uses standard connectors | — | — | — | **Not required** |
| **Custom APIs** | Custom code | **None proposed.** NFR-005 explicitly prohibits exposing a public API surface | — | — | — | **Not required — prohibited by NFR-005** |

**Summary:** the solution introduces four Azure services (Data Factory, SQL/Fabric, Storage, Key Vault) and one code app. Every one is justified by volume, security-standard compliance or a directed platform choice. **No plug-ins, PCF controls, custom connectors or custom APIs are proposed.**


---

# 16. Traceability Matrix

Every requirement in the baseline is accounted for. Design Status values are: **Designed**, **Partially Designed**, **Deferred**, **Blocked**, **Decision Required**, **Not Applicable**.

## 16.1 Functional Requirements (FR-001 to FR-092)

| Req ID | Requirement | Component(s) | Screen(s) | Process(es) | Integration(s) | Security Role(s) | Report(s) | Design Status | Note |
|---|---|---|---|---|---|---|---|---|---|
| FR-001 | Single Sign-On | APP-001, INT-009 | SCR-001 | — | INT-009 | ROL-001..019 | — | **Designed** | Entra ID SSO replaces Pega SAML 2.0 (ADR-005) |
| FR-002 | Profile-based access provisioning | APP-001, INT-009 | SCR-001 | — | INT-009 | ROL-001..019 | — | **Decision Required** | COINS profile code to role mapping mechanism unresolved - OQ-003 / ADR-005 |
| FR-003 | Default landing — MyWorklist | APP-001 | SCR-002 | — | — | ROL-001..004, ROL-009..011, ROL-014 | — | **Designed** | — |
| FR-004 | Default landing — RM partners | APP-001, APP-003 | SCR-003 | — | — | ROL-005..008, ROL-012, ROL-013 | — | **Designed** | — |
| FR-005 | Bilingual UI | APP-005 | SCR-001 | — | — | — | — | **Designed** | i18n bundles + paired EN/FR reference data (NFR-023) |
| FR-006 | Single-click open | APP-001 | SCR-002, SCR-004 | — | — | — | — | **Designed** | — |
| FR-007 | Ingest Transaction files | DAT-002, DAT-004 | SCR-030 | BP-001 | INT-001 | ROL-017 | REP-007 | **Designed** | 128 fields, PK TRANSACTION_LEVEL_UNIQUE_ID; confirm header row (GAP-011) |
| FR-008 | Ingest Employee file | DAT-002, DAT-004 | SCR-030 | BP-001 | INT-002 | ROL-017 | REP-007 | **Designed** | — |
| FR-009 | Ingest Metric file | DAT-002, DAT-004 | SCR-030 | BP-001 | INT-003 | ROL-017 | REP-007 | **Decision Required** | ~91.25M rows/month - target store blocked on OQ-001 / ADR-003 |
| FR-010 | Ingest BC Trigger file | DAT-001, DAT-004, AUT-001 | SCR-030 | BP-001, BP-002 | INT-004 | ROL-017 | REP-007 | **Designed** | — |
| FR-011 | Ingest RM Trigger file | DAT-001, DAT-004, AUT-001 | SCR-030 | BP-001, BP-002 | INT-005 | ROL-017 | REP-007 | **Designed** | — |
| FR-012 | Ingest OECP response file | DAT-001, AUT-007 | SCR-030 | BP-001 | INT-006 | ROL-017 | — | **Designed** | TR001-TR003 transformation rules |
| FR-013 | Ingest BC migration file | AUT-008, DAT-001 | SCR-030 | BP-012 | INT-007 | ROL-017 | — | **Designed** | 4 runs, BC cases from 01 Nov 2021 |
| FR-014 | Header validation | DAT-004, DAT-002 | SCR-030 | BP-001 | INT-001, INT-002, INT-003, INT-004, INT-005, INT-006, INT-007 | ROL-017 | REP-007 | **Designed** | — |
| FR-015 | Trailer / row-count validation | DAT-004, DAT-002 | SCR-030 | BP-001 | INT-001, INT-002, INT-003, INT-004, INT-005, INT-006, INT-007 | ROL-017 | REP-007 | **Designed** | — |
| FR-016 | Row-level validation | DAT-004, DAT-002 | SCR-030 | BP-001 | INT-001, INT-002, INT-003, INT-004, INT-005, INT-006, INT-007 | ROL-017 | REP-007 | **Designed** | — |
| FR-017 | Single error per row in notification | AUT-004 | SCR-030 | BP-001 | INT-010 | ROL-017, ROL-019 | — | **Designed** | One error per row in notification |
| FR-018 | Upsert semantics | DAT-002, DAT-001 | — | BP-001 | INT-001, INT-002, INT-003 | — | — | **Designed** | Upsert on documented PKs - guarantees re-runnability |
| FR-019 | Batch Status tracking | DAT-001, APP-004 | SCR-030 | BP-001 | — | ROL-017, ROL-019 | REP-007 | **Designed** | FileType T1/T2/E/M/TB/TR; status 0=complete, 1=not started (default 1) |
| FR-020 | Failure notification | AUT-004 | SCR-030 | BP-001 | INT-010 | ROL-017, ROL-019 | — | **Designed** | Mailbox.BusinessControlsAnalytics@cibc.com / DLFCIAnalytics@cibc.com |
| FR-021 | Success notification | AUT-004 | SCR-030 | BP-001 | INT-010 | ROL-017, ROL-019 | — | **Designed** | Mailbox.BusinessControlsAnalytics@cibc.com / DLFCIAnalytics@cibc.com |
| FR-022 | Inactive review template rejection | DAT-001, APP-002 | SCR-026 | BP-001, BP-002 | — | ROL-015, ROL-016 | — | **Designed** | — |
| FR-023 | File retention policy | DAT-004, DAT-005 | — | BP-001 | — | ROL-017 | — | **Designed** | — |
| FR-024 | Duplicate trigger handling | AUT-001 | — | BP-002 | INT-004, INT-005 | — | — | **Designed** | — |
| FR-025 | Automatic case creation | AUT-001, DAT-001 | SCR-002 | BP-002 | INT-004, INT-005 | — | — | **Designed** | BC-yyyymmddnnnnn / RM-yyyymmddnnnnn |
| FR-026 | Case ID format | AUT-001, DAT-001 | SCR-002 | BP-002 | INT-004, INT-005 | — | — | **Designed** | BC-yyyymmddnnnnn / RM-yyyymmddnnnnn |
| FR-027 | Workbasket routing on creation | AUT-001, DAT-001 | SCR-004 | BP-002 | — | ROL-001..014 | — | **Designed** | — |
| FR-028 | Review Type assignment | AUT-001, DAT-001 | SCR-008 | BP-002, BP-004 | — | — | — | **Designed** | — |
| FR-029 | Exception workbasket | AUT-001, DAT-001 | SCR-004 | BP-002 | — | ROL-001, ROL-017 | — | **Designed** | BCExceptionWB |
| FR-030 | Manual case creation | APP-001 | SCR-006, SCR-007 | BP-003, BP-004 | — | ROL-001..004, ROL-009..011 | — | **Designed** | — |
| FR-031 | Case parameter capture | APP-001 | SCR-008 | BP-003, BP-004 | — | ROL-001..004, ROL-009..011 | — | **Designed** | — |
| FR-032 | Inflight case immutability | DAT-001 | SCR-032 | — | — | — | — | **Designed** | ADR-017 - config stamped at case creation |
| FR-033 | Four-stage lifecycle | APP-001 | SCR-009 | BP-005, BP-006, BP-007, BP-010 | — | — | — | **Designed** | Initialization -> Triage -> Review -> Recommendation and action |
| FR-034 | Triage step | APP-001 | SCR-010 | BP-005 | — | ROL-002, ROL-004, ROL-010, ROL-011 | — | **Designed** | — |
| FR-035 | Triage decision form | APP-001 | SCR-010 | BP-005 | — | ROL-002, ROL-004, ROL-010, ROL-011 | — | **Designed** | — |
| FR-036 | BC Review activities | APP-001 | SCR-011 | BP-006 | — | ROL-001..004 | — | **Partially Designed** | Detailed activity rules held in Jira - GAP-001 |
| FR-037 | RM Review activities | APP-001 | SCR-012 | BP-007 | — | ROL-009..011 | — | **Partially Designed** | Detailed activity rules held in Jira - GAP-001 |
| FR-038 | Role rating tabs | APP-001, APP-005 | SCR-011, SCR-012 | BP-006, BP-007 | — | — | — | **Designed** | Lender, Overrider, UW-CA, IVO, RCS, Other 1-3 |
| FR-039 | Primary/secondary errors | APP-001, APP-005, DAT-001 | SCR-013 | BP-006, BP-007 | — | — | — | **Designed** | Bilingual error taxonomy |
| FR-040 | BC due diligence outcome | APP-001 | SCR-011 | BP-006 | — | ROL-001..004 | — | **Designed** | — |
| FR-041 | Counter display | AUT-003, DAT-001 | SCR-014 | BP-008 | — | — | — | **Designed** | Operator-ID level irrespective of role; RM ratings excluded from BC counters |
| FR-042 | Manager hierarchy display | AUT-003, DAT-003 | SCR-014 | BP-008 | INT-002 | — | — | **Partially Designed** | 4-level hierarchy derivation from a single MANAGER_ID is unproven - ASS-013 / RSK-005 |
| FR-043 | BC Recommendation activities | APP-001 | SCR-015 | BP-010 | — | ROL-001, ROL-002 | — | **Designed** | — |
| FR-044 | RM Recommendation activities | APP-001 | SCR-016 | BP-010 | — | ROL-009, ROL-010 | — | **Designed** | — |
| FR-045 | Case closure | APP-001, DAT-005 | SCR-033 | BP-011 | — | ROL-001, ROL-009 | — | **Designed** | Starts the 7-year retention clock |
| FR-046 | RM close-stage flows | APP-001 | SCR-033 | BP-011 | — | ROL-009, ROL-010 | — | **Designed** | — |
| FR-047 | Reopen case | APP-001, AUT-009 | SCR-033 | BP-011 | — | ROL-001, ROL-009 | — | **Designed** | Fully audited |
| FR-048 | BC workbaskets | DAT-001 | SCR-004 | — | — | ROL-001..008 | — | **Designed** | BCToRMReferralWB, BCExceptionWB, BCReversalRequestWB, BCSecondOpinionWB, BCBranchAccountabilityWB, BCGeneralWB, BCOECPWB, RM Alignment WB, RM Reversal WB |
| FR-049 | BC workbasket access matrix | DAT-001 | SCR-004 | — | — | ROL-001..008 | — | **Designed** | Enforced at the data tier (SEC-004, ADR-014) |
| FR-050 | RM workbaskets | DAT-001 | SCR-004 | — | — | ROL-009..014 | — | **Designed** | RMUnderwriterWB, RMLenderWB, RMIVOWB, RMFunderWB, RMFraudWB, RMCreditAdjudicatorWB, RMChannelWB |
| FR-051 | RM partner channel scoping | DAT-001 | SCR-003, SCR-004 | — | — | ROL-012, ROL-013 | REP-004 | **Designed** | Channel scoping (SEC-005) |
| FR-052 | GetNext — BC | APP-001, DAT-001 | SCR-005 | — | — | ROL-002, ROL-004 | — | **Designed** | — |
| FR-053 | GetNext complexity config — BC | APP-002 | SCR-028 | — | — | ROL-015 | — | **Designed** | Complexity 0-90 increments of 1, by Review Template ID + Review Name |
| FR-054 | GetNext — RM | APP-001, DAT-001 | SCR-005 | — | — | ROL-010, ROL-011 | — | **Designed** | — |
| FR-055 | GetNext config — RM | APP-002 | SCR-028 | — | — | ROL-016 | — | **Designed** | Review Name -> Analyst COINS IDs |
| FR-056 | Overview task list | APP-001 | SCR-002 | — | — | — | — | **Designed** | — |
| FR-057 | Case assignment | APP-001 | SCR-004 | — | — | ROL-001, ROL-009 | — | **Designed** | — |
| FR-058 | Modify employee details | APP-001, DAT-003 | SCR-032 | — | INT-002 | ROL-001, ROL-002, ROL-009, ROL-010 | — | **Designed** | Audited |
| FR-059 | Modify transaction details | APP-001, DAT-003 | SCR-032 | — | INT-001 | ROL-001, ROL-002, ROL-009, ROL-010 | — | **Designed** | Audited |
| FR-060 | Change stage (BC) | APP-001 | SCR-033 | BP-011 | — | ROL-001, ROL-002 | — | **Designed** | — |
| FR-061 | Cancel case | APP-001 | SCR-033 | BP-005, BP-011 | — | ROL-001, ROL-009 | — | **Designed** | — |
| FR-062 | Close as out of scope | APP-001 | SCR-010, SCR-033 | BP-005 | — | ROL-001, ROL-009 | — | **Designed** | RM requires manager approval (SEC-007) |
| FR-063 | Close incomplete (RM) | APP-001 | SCR-033 | BP-011 | — | ROL-009, ROL-010 | — | **Designed** | — |
| FR-064 | Create lender task (BC) | APP-001, AUT-002 | SCR-018 | BP-006 | — | ROL-001..004 | — | **Designed** | — |
| FR-065 | Create fraud review task (RM) | APP-001, AUT-002 | SCR-018 | BP-007 | — | ROL-014 | — | **Designed** | RMFraudWB |
| FR-066 | Request second opinion | APP-001, AUT-002 | SCR-018 | BP-006 | — | ROL-003 | — | **Designed** | BCSecondOpinionWB |
| FR-067 | Cross-team referral | APP-001, AUT-002 | SCR-018 | BP-006, BP-007 | — | ROL-001, ROL-009 | — | **Designed** | BCToRMReferralWB |
| FR-068 | Branch accountability task (BC) | APP-001, AUT-002 | SCR-018 | BP-006 | — | ROL-001, ROL-007 | — | **Designed** | BCBranchAccountabilityWB |
| FR-069 | Display case history | AUT-009, DAT-001 | SCR-021 | — | — | ROL-018 | — | **Designed** | — |
| FR-070 | BC bulk actions | AUT-006 | SCR-022 | — | — | ROL-001 | — | **Designed** | — |
| FR-071 | RM bulk actions | AUT-006 | SCR-022 | — | — | ROL-009 | — | **Designed** | — |
| FR-072 | RM bulk sharing restrictions | AUT-006 | SCR-022 | — | — | ROL-009, ROL-010 | — | **Designed** | Separation of duties enforced server-side (SEC-006) |
| FR-073 | Case information tabs | APP-001 | SCR-019 | — | — | — | — | **Partially Designed** | 12 tabs identified; per-tab field detail held in Jira - GAP-001 |
| FR-074 | Tab availability | APP-001 | SCR-019 | — | — | — | — | **Partially Designed** | Tab availability rules partly in Jira - GAP-001 |
| FR-075 | Case header summary | APP-001 | SCR-009 | — | — | — | — | **Designed** | — |
| FR-076 | Additional Metrics behaviour | APP-001, DAT-003 | SCR-019 | — | INT-003 | — | — | **Designed** | — |
| FR-077 | Related Cases (BC) | APP-001, DAT-001 | SCR-019 | — | — | — | — | **Designed** | — |
| FR-078 | Notes and attachments | DAT-001 | SCR-020 | — | — | — | — | **Designed** | Dataverse file columns (ADR-009) |
| FR-079 | Admin hub | APP-002 | SCR-023 | — | — | ROL-015, ROL-016 | — | **Designed** | — |
| FR-080 | Dropdown maintenance | APP-002, DAT-001 | SCR-024 | — | — | ROL-015, ROL-016 | — | **Designed** | Paired EN/FR values |
| FR-081 | PID maintenance | APP-002, DAT-001 | SCR-025 | — | — | ROL-015, ROL-016 | — | **Designed** | — |
| FR-082 | Review Type maintenance | APP-002, DAT-001 | SCR-026 | — | — | ROL-015, ROL-016 | — | **Designed** | — |
| FR-083 | BC communication method | AUT-002, APP-002 | SCR-027, SCR-015 | BP-008 | — | ROL-015 | — | **Designed** | Real Time (default) / Hold / Consolidate |
| FR-084 | RM communication method | AUT-002, APP-002 | SCR-027, SCR-016 | BP-008 | — | ROL-016 | — | **Designed** | Default Hold for all Channel+ReviewName+Role; only manually added combinations become Real Time |
| FR-085 | Counter reset basis | AUT-003, APP-002 | SCR-029, SCR-014 | BP-008 | — | ROL-015, ROL-016 | — | **Designed** | Fiscal Year Nov 01 - Oct 31, or Rolling 12 months (current date - 365) |
| FR-086 | Admin change scope | APP-002, DAT-001 | SCR-023 | — | — | ROL-015, ROL-016 | — | **Designed** | ADR-017 - new cases only |
| FR-087 | Escalation matrix | AUT-003, APP-002 | SCR-029, SCR-014 | BP-008 | — | ROL-007, ROL-015, ROL-016 | — | **Designed** | 0 or 1 -> 1-level-up; 2 -> 2-level-up; 3 -> 3-level-up; 4+ -> 4-level-up |
| FR-088 | Real-time task creation | AUT-002 | SCR-017 | BP-008 | INT-010 | — | — | **Designed** | — |
| FR-089 | Hold task creation | AUT-002 | SCR-017 | BP-008 | — | — | — | **Designed** | — |
| FR-090 | Partner response capture | APP-003, AUT-005 | SCR-017 | BP-009 | INT-010 | ROL-005..008, ROL-012, ROL-013 | — | **Designed** | Reversal Accepted / Reversal Declined / Reduced to Coaching / Justification Required |
| FR-091 | Partner response fields | APP-003 | SCR-017 | BP-009 | — | ROL-005..008, ROL-012, ROL-013 | — | **Partially Designed** | 7 reason values and 4000-char comments captured; conditional rules held in Jira - GAP-001 |
| FR-092 | OECP round-trip | AUT-007 | SCR-019 | BP-008 | INT-006, INT-008 | — | — | **Designed** | OECP Consolidate round-trip |

## 16.2 Non-Functional Requirements (NFR-001 to NFR-026)

| Req ID | Category | Component(s) | Design Status | Design Response |
|---|---|---|---|---|
| NFR-001 | Security | INT-009, APP-001 | **Designed** | Entra ID SSO - ADR-005 |
| NFR-002 | Security | APP-001, INT-001..011 | **Designed** | HTTPS/TLS per CIBC SC-83 |
| NFR-003 | Security | INT-001..008, DAT-004 | **Designed** | SFTP for all 8 feeds |
| NFR-004 | Security | DAT-004, INT-001..008 | **Designed** | Azure Key Vault + managed identity - ADR-015 |
| NFR-005 | Security | APP-001 | **Designed** | No public API surface; governed connectors only |
| NFR-006 | Security | DAT-001, DAT-002 | **Designed** | Server-side authorisation only - ADR-014 |
| NFR-007 | Performance | APP-001, AUT-001..009 | **Designed** | Batched operations; no per-row calls in loops |
| NFR-008 | Performance | APP-001, DAT-003 | **Partially Designed** | p95 <= 3s target is derived, not sourced - requires business confirmation |
| NFR-009 | Performance | DAT-002, INT-001..007 | **Designed** | ADF pipelines sized for 100,000 transaction rows/day |
| NFR-010 | Scalability | DAT-002, DAT-003 | **Decision Required** | 91.25M Metric rows/month - blocked on OQ-001 / ADR-003 / RSK-001 |
| NFR-011 | Availability | APP-001 | **Decision Required** | Availability SLA not stated in source - dependency on CIBC Service Management |
| NFR-012 | Accessibility | APP-005 | **Partially Designed** | WCAG 2.1 AA is the design target - ADR-013; conformance requires formal audit, no claim made |
| NFR-013 | Accessibility | APP-005 | **Partially Designed** | Keyboard, screen reader, labels, contrast designed in - verification pending |
| NFR-014 | Auditability | AUT-009, DAT-001 | **Designed** | Dataverse auditing, immutable to application users |
| NFR-015 | Auditability | APP-002, AUT-009 | **Designed** | Before/after logging of configuration change |
| NFR-016 | Compliance | AUT-009, REP-001..007 | **Designed** | Exportable OSFI-facing audit record |
| NFR-017 | Compliance / Retention | DAT-005 | **Designed** | Purge 7 years after the year of closure - ADR-012, closes the Pega gap |
| NFR-018 | Compliance / Retention | DAT-005, DAT-004 | **Designed** | Ingested data archival/purge cycle |
| NFR-019 | Data Residency | DAT-001, DAT-002, DAT-004, REP-001..007 | **Decision Required** | Canadian residency - blocked on OQ-002 |
| NFR-020 | Data Protection | DAT-001, DAT-002 | **Designed** | Column-level security and masked export - SEC-008 |
| NFR-021 | Usability | APP-005 | **Designed** | Single-column, non-nested sorting |
| NFR-022 | Usability | APP-005 | **Designed** | Consistent single-click interaction model |
| NFR-023 | Localisation | APP-005, DAT-001 | **Designed** | i18n bundles + paired EN/FR reference data + bilingual notification templates |
| NFR-024 | Maintainability | DAT-001, DAT-002, APP-001 | **Designed** | Max lengths enforced at data, service and UI tiers |
| NFR-025 | Operability | INT-008, AUT-004 | **Designed** | 3 retries then alert |
| NFR-026 | ALM | ALM | **Designed** | Managed solutions DEV -> DIT -> SIT -> UAT -> PROD - ADR-016 |

## 16.3 Business Processes (BP-001 to BP-012)

| Process ID | Name | Implementation Approach | Integration(s) | Design Status |
|---|---|---|---|---|
| BP-001 | Daily File Ingestion | Azure Data Factory + Power Automate + Dataverse | INT-001, INT-002, INT-003, INT-004, INT-005, INT-006, INT-007 | **Designed** |
| BP-002 | Automatic Case Creation | Power Automate (AUT-001) + Dataverse business rules | INT-004, INT-005 | **Designed** |
| BP-003 | Manual Case Creation | Code App + Dataverse | — | **Designed** |
| BP-004 | Manual Income Queue Case Creation | Code App configuration of the creation service | — | **Designed** |
| BP-005 | Case Triage | Code App + Dataverse | — | **Designed** |
| BP-006 | BC Case Review | Code App + Dataverse + Power Automate (AUT-002, AUT-003) | — | **Partially Designed** |
| BP-007 | RM Case Review | Code App + Dataverse + Power Automate (AUT-002, AUT-003) | — | **Partially Designed** |
| BP-008 | Coaching / Escalation / FYI Communication | Power Automate (AUT-002, AUT-003) + Dataverse rollups | INT-010 | **Designed** |
| BP-009 | Reversal and Attestation | Code App (APP-003) + Power Automate (AUT-005) | INT-010 | **Designed** |
| BP-010 | Recommendation, Final Rating and Result Sharing | Code App + Power Automate (AUT-005) | INT-010 | **Designed** |
| BP-011 | Case Closure and Reopen | Code App + Dataverse + DAT-005 | — | **Designed** |
| BP-012 | Historical Case Migration | Azure Data Factory (AUT-008) | INT-007 | **Designed** |

## 16.4 Data Requirements (DR-001 to DR-014)

| Entity ID | Entity | Proposed System of Record | Data Owner | Design Status | Blocked By |
|---|---|---|---|---|---|
| DR-001 | Transaction | DAT-002 Azure SQL (provisional) | BC Analytics | **Decision Required** | OQ-001 |
| DR-002 | Employee | DAT-002 Azure SQL (provisional) | BC/RM Analytics | **Decision Required** | OQ-001 |
| DR-003 | Metric | DAT-002 Azure SQL (provisional) | BC/RM Analytics | **Decision Required** | OQ-001 |
| DR-004 | Trigger | DAT-001 Dataverse | BC/RM Analytics | **Designed** | — |
| DR-005 | Case | DAT-001 Dataverse | LDD application | **Designed** | — |
| DR-006 | Task / Assignment | DAT-001 Dataverse | LDD application | **Designed** | — |
| DR-007 | Workbasket / Queue | DAT-001 Dataverse | BC/RM Administrators | **Designed** | — |
| DR-008 | Review Type Template | DAT-001 Dataverse | BC/RM Administrators | **Designed** | — |
| DR-009 | Rating and Recommendation | DAT-001 Dataverse | LDD application | **Designed** | — |
| DR-010 | Counter (Coaching/Escalation/FYI) | DAT-001 Dataverse | LDD application | **Designed** | — |
| DR-011 | Administration Configuration | DAT-001 Dataverse | BC/RM Administrators | **Designed** | — |
| DR-012 | Batch Status | DAT-001 Dataverse | Application Operations | **Designed** | — |
| DR-013 | Legacy / Migrated Case | DAT-001 Dataverse | BC Analytics | **Designed** | — |
| DR-014 | OECP Response | DAT-001 Dataverse | OECP via Analytics | **Designed** | — |

## 16.5 Reporting Requirements (RPT-001 to RPT-007)

| Req ID | Design Asset | Design Status |
|---|---|---|
| RPT-001 | REP-001 | **Designed** |
| RPT-002 | REP-002 | **Designed** |
| RPT-003 | REP-003 | **Designed** |
| RPT-004 | REP-004 | **Designed** |
| RPT-005 | REP-005 | **Partially Designed** — outbound field specification unreadable in source (GAP-013); recover before build |
| RPT-006 | REP-006 | **Partially Designed** — outbound field specification unreadable in source (GAP-013); recover before build |
| RPT-007 | REP-007 | **Designed** |

## 16.6 Security Requirements (SEC-001 to SEC-014)

| Req ID | Design Element(s) | Design Status |
|---|---|---|
| SEC-001 | ROL-001..019, INT-009 | **Designed** |
| SEC-002 | ROL-001..019 | **Designed** |
| SEC-003 | INT-009 | **Decision Required** |
| SEC-004 | ROL-001..014 | **Designed** |
| SEC-005 | ROL-012, ROL-013 | **Designed** |
| SEC-006 | ROL-002, ROL-010 | **Designed** |
| SEC-007 | ROL-009 | **Designed** |
| SEC-008 | DAT-001, DAT-002 | **Designed** |
| SEC-009 | ROL-001..019 | **Designed** |
| SEC-010 | INT-009 | **Designed** |
| SEC-011 | AUT-009 | **Designed** |
| SEC-012 | DAT-001, DAT-002, DAT-004 | **Designed** |
| SEC-013 | DAT-001, DAT-002 | **Designed** |
| SEC-014 | INT-009 | **Decision Required** |

## 16.7 Integration Requirements (INT-001 to INT-008)

| Req ID | System | Classification | Design Status |
|---|---|---|---|
| INT-001 | BC Analytics / Feedhub / NAS — Transaction feed | Confirmed | **Designed** |
| INT-002 | BC/RM Analytics — Employee feed | Confirmed | **Designed** |
| INT-003 | BC/RM Analytics — Metric feed | Confirmed | **Decision Required** |
| INT-004 | BC Analytics — BC Trigger feed | Confirmed | **Designed** |
| INT-005 | RM Analytics — RM Trigger feed | Confirmed | **Designed** |
| INT-006 | OECP (Coaching/Escalation/FYI tool) via Analytics | Confirmed | **Designed** |
| INT-007 | Legacy BC system (RBSS) via BC Analytics | Confirmed | **Designed** |
| INT-008 | BC/RM Analytics + downstream Analytics DB / Business NAS | Confirmed | **Partially Designed** |

## 16.8 Coverage Summary

| Design Status | FR + NFR Count |
|---|---|
| Designed | 104 |
| Partially Designed | 9 |
| Decision Required | 5 |
| Blocked | 0 |

**No requirement is unaccounted for. No requirement is marked Deferred or Not Applicable.**

---

# 17. Assumptions, Risks and Open Questions Carried Forward

All 17 assumptions, 12 risks, 14 gaps and 18 open questions from the requirements baseline are carried forward unchanged. No requirement IDs have been altered. The items below are those with direct architectural consequence.

## 17.1 Design-Critical Assumptions

| ID | Assumption | Design Impact |
|---|---|---|
| ASS-010 | Interfaces remain byte-identical post-migration | Underpins ADR-007 and the entire integration design. If false, eight upstream/downstream systems require change |
| ASS-013 | The 4-level manager hierarchy is derivable from a single `MANAGER_ID` per Employee record | Underpins FR-042 and the escalation matrix (FR-087). **Unverified — see RSK-005.** If false, an additional hierarchy source is required |
| ASS-017 | The Jira LDD project export can be obtained | Underpins the resolution of GAP-001 and the Partially Designed status of FR-036, FR-037, FR-073, FR-074, FR-091 |

## 17.2 Design-Critical Risks

| ID | Risk | Design Response |
|---|---|---|
| RSK-001 | Dataverse may not be viable as system of record for Metric and Transaction volume | ADR-003 hybrid data tier; **provisional pending OQ-001** |
| RSK-003 | Behavioural detail resides in an unsupplied Jira project | Five FRs marked Partially Designed; Jira export is a hard prerequisite for Data Model Design and backlog creation |
| RSK-005 | Manager hierarchy derivation may be insufficient for 4-level escalation | Escalation engine (AUT-003) designed with a fallback to the general workbasket and an operations alert; requires validation against real Employee data |
| — | Power Apps code app maturity and Canadian regional availability | ADR-002 — validate before build; Model-Driven + Canvas hybrid documented as the fallback |
| — | Virtual-table query capability against DAT-002 | ADR-004 — technical spike required before commitment |

## 17.3 Blocking Decisions — Still Open

The following must be resolved before build commences. **This design records provisional recommendations only and assumes no answers.**

| ID | Decision | Provisional Position | Affected Design |
|---|---|---|---|
| **OQ-001** | System of record for Transaction, Metric and Employee at ~91.25M + ~18.25M rows/month | Hybrid: Dataverse for case data, Azure SQL or Fabric for volume, projected via virtual/elastic tables | ADR-003, ADR-004, DAT-002, DAT-003, DR-001..003, NFR-010, FR-009 |
| **OQ-002** | Data residency / approved geography for a Canadian regulated lending workload | All Dataverse, Azure and Power BI assets in a Canadian region; code app runtime availability to be confirmed in that region | ADR-002, §9.6, NFR-019 |
| **OQ-003** | Authoritative source and mechanism for COINS Profile Code → security role entitlement post-Pega | Two options documented in ADR-005; **neither selected** | ADR-005, FR-002, SEC-003, SEC-014, ROL-001..019 |
| **OQ-004** | Ownership of the eight file interfaces (Feedhub/NAS, AutoSys, SFTP endpoints, functional IDs) | Interfaces preserved exactly; endpoint and credential ownership to be confirmed with the Analytics and Infrastructure teams | ADR-007, INT-001..008 |
| **OQ-005** | Production deployment approval path | Gated managed-solution pipeline with approvals at UAT and PROD; never build in Production | ADR-016, §12.6 |

## 17.4 Design-Critical Gaps

| ID | Gap | Consequence |
|---|---|---|
| GAP-001 | Jira LDD project not supplied | FR-036, FR-037, FR-073, FR-074, FR-091 are Partially Designed; detailed rules must be recovered before the physical data model and the backlog can be completed |
| GAP-011 | Transaction specification header row blank in the source conversion — 128 fields recovered positionally | Field names and order must be confirmed with BC Analytics before ingestion is built |
| GAP-012 | ADD §3.2 logical data model is an unreadable embedded EMF object | Data Model Design must derive the model from the requirements baseline and the interface specifications instead |
| GAP-013 | Extract IA §3.1 Data File Specification is an unreadable embedded EMF object | RPT-005/RPT-006 are Partially Designed; ADR-018 parallel-run mitigates by verifying output empirically |

---

## Document Control

| Item | Value |
|---|---|
| Version | 1.0 |
| Status | **Draft for Review — not approved** |
| Requirements Baseline | v1.0 (unmodified; no requirement IDs changed) |
| Downstream gates | Data Model Design may proceed on this document; **Dataverse Provisioning must not proceed until OQ-001 and OQ-002 are resolved**; Azure DevOps backlog creation requires the GAP-001 Jira export for full fidelity; Canvas/Code App build requires ADR-002 validation |
| Next skill | `data-model-design` (conceptual model complete in Section 6) |
