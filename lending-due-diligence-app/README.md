# Lending Due Diligence — Power Apps code app

A Power Apps **code app** (React + Vite + TypeScript) that reimplements the Pega *Lending Due
Diligence (LDD)* application on Dataverse.

- Environment: **Patrick Clarke**
- Solution: **Lending Due Diligence** (`LendingDueDiligence`, publisher prefix `ava`)
- [Play the app](https://apps.powerapps.com/play/e/158bbd11-b487-e44e-b175-46d9e2809617/app/175161cf-c385-4c35-8b29-133f0b397d0d)

## How it works

The app is a **metadata-driven case engine**. The Pega process — 5 case types, 39 stages,
80 steps, 24 view layouts, 26 choice sets and 10 decision tables — is imported from the Pega
export into Dataverse configuration tables. The React app reads that configuration at runtime,
so changing the process is a data change, not a code change.

```
myapp.zip  ──▶  extract-prototype.mjs  ──▶  prototype/ldd-prototype-config.json
                                                       │
                                            seed-prototype.mjs
                                                       ▼
                                        Dataverse configuration tables
                                                       │
                          engine.ts (pure planner) ──▶ orchestrator.ts (writes)
                                                       │
                                              React screens + dynamic forms
```

Case types: Lending Review, Risk Assessment, Compliance Monitoring, Escalation Management,
Quality Recommendation.

## Layout

```
src/
  lib/            types, Dataverse data access, case engine, orchestrator
  components/     header, icon rail, stage stepper, case rail, dynamic form renderer
  screens/        worklist, case list, new case, case workspace, configuration
  screens/forms/  assignment + approval forms
  generated/      Power Apps generated Dataverse models + services (do not edit)
scripts/
  schema-v2.mjs             the 27 Dataverse tables
  provision-dataverse.mjs   creates tables in the solution (idempotent)
  extract-prototype.mjs     Pega export -> normalised config JSON
  seed-prototype.mjs        config JSON -> Dataverse (idempotent)
  gen-detail-columns.mjs    regenerates src/lib/detail-columns.ts
  verify-engine.mjs         live end-to-end verification harness
docs/
  DEVELOPER-HANDOVER.md     architecture, what works, production readiness backlog
```

All Dataverse access goes through the generated services in `src/generated/services` — never raw
`fetch`, which the Power Apps sandbox blocks.

## Develop

```bash
npm install
pa app run          # local dev against the environment
npm run build
npm run lint
pa app push         # deploy
```

## Verify

`scripts/verify-engine.mjs` imports the real shipped `src/lib/engine.ts` and drives a full
lifecycle for every case type against live Dataverse, then cleans up after itself.

```bash
node scripts/verify-engine.mjs          # --keep leaves the records behind
```

Current result: **49 passed / 0 failed**.

## Provision and seed

The scripts authenticate via the Azure CLI:

```bash
az login
LDD_SCHEMA=schema-v2.mjs node scripts/provision-dataverse.mjs
node scripts/extract-prototype.mjs <prototype-dir> prototype/ldd-prototype-config.json
node scripts/seed-prototype.mjs         # --no-demo to skip demo cases
```

## Further reading

- [`docs/DEVELOPER-HANDOVER.md`](./docs/DEVELOPER-HANDOVER.md) — architecture, the rework-loop
  guard, what is simulated, and everything a developer must do for production
- [`memory-bank.md`](./memory-bank.md) — table inventory, screen map, open items
