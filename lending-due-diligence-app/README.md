# Lending Due Diligence — Power Apps code app

A Power Apps **code app** (React + Vite + TypeScript) that reproduces the RM Escalation flow of the
Pega *CIBC Lending Due Diligence Application*, backed by Dataverse.

- Environment: **Patrick Clarke**
- Solution: **Lending Due Diligence** (`LendingDueDiligence`, publisher prefix `ava`)
- [Play the app](https://apps.powerapps.com/play/e/158bbd11-b487-e44e-b175-46d9e2809617/app/175161cf-c385-4c35-8b29-133f0b397d0d)

## Flow

```
My Worklist ──▶ Case workspace
     │
Create case ──▶ Collect transaction information ──▶ Collect Case Parameter ──▶ Case workspace

Initialization ──▶ Triage ──▶ Review ──▶ Recommendation and action
                    │           │              │
            Triage Decision  Review Case   Provide Response for
                             Details       Escalation / Coaching
```

## Layout

```
src/
  lib/            types, formatting helpers, Dataverse data access
  components/     header, icon rail, stage stepper, case rail, case contents
  screens/        worklist, case list, case creation, case workspace, read-only sections
  screens/tasks/  the three assignment forms
  generated/      Power Apps generated Dataverse models + services (do not edit)
scripts/
  schema.mjs                Dataverse table/column definitions
  provision-dataverse.mjs   creates tables in the solution (idempotent)
  seed-data.mjs             seeds reference + demo data (idempotent)
```

All Dataverse access goes through the generated services in `src/generated/services` — never raw
`fetch`, which the Power Apps sandbox blocks.

## Develop

```bash
npm install
pa app run          # local dev against the environment
npm run build
pa app push         # deploy
```

The provisioning/seeding scripts authenticate via the Azure CLI:

```bash
az login
node scripts/provision-dataverse.mjs
node scripts/seed-data.mjs
```

See [`memory-bank.md`](./memory-bank.md) for the full table inventory, screen map and open items.
