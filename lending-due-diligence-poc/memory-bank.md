# Lending Due Diligence PoC — Memory Bank

## Project

- Path: `lending-due-diligence-poc/`
- App name: Lending Due Diligence PoC
- Environment: Patrick Clarke (`158bbd11-b487-e44e-b175-46d9e2809617`)
- App ID: `fd0d011a-0940-4b74-9264-85320b92dfc9`
- App URL: https://apps.powerapps.com/play/e/158bbd11-b487-e44e-b175-46d9e2809617/app/fd0d011a-0940-4b74-9264-85320b92dfc9
- Solution: **Lending Due Diligence** (`LendingDueDiligence`) — added explicitly via
  `AddSolutionComponent` (component type 300); `pa app push` places new apps in the
  environment's *preferred* solution, which is the Default Solution, not this one.
- Dataverse org: `https://org07a06763.crm.dynamics.com`

## Purpose

A second Code App over the **same 39 Dataverse tables** as `lending-due-diligence-app/`,
rebuilt to the Pega Constellation design produced by Pegakit (`newapp2/site/app/`). The
original app keeps its own look; this one is the design-faithful proof of concept.

## Approach

The prototype's `theme.css` and `styles.css` were ported **verbatim** as
`src/proto-theme.css` and `src/proto-styles.css` (337 lines of CSS, unmodified). The React
components emit the same DOM and class names the prototype's `app.js` generated, so the
stylesheet is the contract — changing markup class names will break the design.

Data sources were transplanted rather than re-added: the `databaseReferences` and
`connectionReferences` objects were copied from the existing app's `power.config.json`
(using `ConvertTo-Json -Depth 12`, since the default depth of 2 truncates the nested
`default.cds.dataSources.*` structure), along with `src/generated/` (80 files) and `.power/`.

## Completed Steps

- [x] Scaffold (`npx degit microsoft/PowerAppsCodeApps/templates/vite`)
- [x] `pa app init -n 'Lending Due Diligence PoC'`
- [x] Transplant 39 data sources + `src/generated/` + `.power/`
- [x] Copy `src/lib/` (7 modules) from the existing app
- [x] Port prototype CSS verbatim
- [x] Build the Constellation shell, five screens, case panel and step wizard
- [x] `npm run build` and `npm run lint` — both clean
- [x] `pa app push`
- [x] Add to the Lending Due Diligence solution and verify

## Screens

| Route | Component | Prototype source |
| --- | --- | --- |
| `home` | `HomeScreen.tsx` | `pageHome()` — announcement, Tasks, followed items, Pulse, case-type tiles |
| `mywork` | `MyWorkScreen.tsx` | `pageMyWork()` — six-column worklist of open cases |
| `type/<code>` | `CaseTypeScreen.tsx` | `pageType()` — lifecycle chevrons, Cases table, Process outline |
| `records` | `RecordsScreen.tsx` | `pageRecords()` — data-object tiles that drill into live Dataverse rows |
| `explore` | `ExploreScreen.tsx` | `pageExplore()` — all cases, filtered by the app-bar search |

## Components

- `AppBar.tsx` — waffle launcher, app name with chevron, centred search, avatar
- `Rail.tsx` — create button, Home, My Work, Explore, one entry per case type, Record Manager, spacer, Notifications, Recents
- `CasePanel.tsx` — right-hand drawer: stage strip, assignments with Go buttons, Details / History tabs
- `StepWizard.tsx` — assignment step form rendered from the harvested Pega view definition; submits via `orchestrator.submitAssignment`
- `Primitives.tsx` — `StatusChip`, `Toolbar`, `PageHeader`
- `Icon.tsx` + `lib/icons.ts` — the prototype's inline SVG set

## Interaction model

Matches Pega and the prototype: clicking a **Case ID** opens the preview panel; clicking an
**Assignment** opens the step form modal. Do not collapse these into one action.

## Gotchas

- `react-hooks/set-state-in-effect` fires if an effect calls a `useCallback` that sets state,
  or sets state synchronously in the effect body. The pattern that lints clean is an inline
  `Promise.all(...).then(...).catch(...).finally(...)` with a `cancelled` flag.
- `react-refresh/only-export-components` forbids non-component exports from a `.tsx` file —
  `statusClass` lives in `lib/status.ts` and the icon data in `lib/icons.ts` for this reason.
- The Power Apps host caches builds. After a push, use the player's own "Refresh" banner or
  Ctrl+F5; a plain reload serves the previous bundle.

## Next Steps

- Read the signed-in identity from `getContext()` instead of `DEFAULT_USER` in `App.tsx`
- Wire case creation (the rail "+" and the per-type "New" button currently toast)
- Build the Power Automate flows that drain the notification outbox table
