# Executive Summary

**Pega to Power Platform Migration - Lending Due Diligence Proof of Concept**

*Prepared for CIBC - September 2026*

---

We set out to answer a question that is usually argued rather than tested: can a
production Pega application be moved onto the Power Platform with its process
fidelity intact, and what exactly does not come across? Rather than produce a
paper assessment, we migrated the Lending Due Diligence application end to end.
It is deployed and operating today in the Patrick Clarke environment, and all
five case types create, advance through their stages, evaluate decisions and
reach resolution. Every figure in this summary is measured from that working
implementation or from the migration artefacts themselves - none is estimated.

The headline finding is a pair of numbers that must be read together. **Process
structure migrated completely through automation** - all 5 case types, 39
stages, 80 steps, 10 decision tables, 24 screen layouts and 26 choice sets moved
across with no manual authoring, because Pega's case model is declarative and
fully represented in its export. But **41 of the 80 step bodies, roughly 51%,
require manual implementation** - the notifications, data transforms and
document generation - because Pega executes that logic inside a proprietary
engine and does not expose it in any exportable form. This is a platform
constraint rather than a tooling shortfall: the rule bodies ship as binaries
that cannot be decoded outside a Pega instance, and we verified this physically.
Any migration approach, from any vendor, meets the same wall.

That split drives the commercial picture. The automated portion of a migration
is days of work; our **87 to 132 day estimate for an application of this
complexity is almost entirely the manual 51%**. The value of the PoC is
therefore less that it proved migration is possible, and more that it converted
an unknown into a quantified, itemised list - every one of those 41 steps is
individually identified. Quantifying that boundary early matters far more than
tooling sophistication.

The approach also surfaced two findings worth flagging to a steering audience.
First, a naive structural migration produces a **broken** application: two case
types initially looped indefinitely because the conditional guards on stage
transitions were missing. We addressed this with defence in depth - guards
inferred from the preceding decision tables, plus a hard re-visit cap that
guarantees termination even when an inferred guard is wrong. We subsequently
extracted the flow rule bodies from the export - contrary to the common claim
that they are undecodable, the payload is simply UTF-16 encoded - and found that
**all 264 connector transitions are unconditional**. The guards were not
missing; they never existed. That is a defect in the source Pega application,
and it makes our re-visit cap permanent design rather than a workaround.
Second, extraction quality is silently variable; an assessment run without live
sandbox access captured **zero** screens and choice sets while still producing a
plausible-looking model. Both defects were caught by automated verification
rather than manual testing, which is the argument for building the verification
harness before the application.

**We recommend proceeding to a Phase 1 production migration**, conditional on
securing business SME time to restate the transform and notification logic and
to confirm what the rework conditions *should* be. The suggested next step is a
two-week inception to settle those questions before committing to the full
build. The migration assets built here - the extraction pipeline, case engine,
dynamic form renderer, flow-rule extractor and verification harness - are
application-agnostic and reusable, so a second application should cost 40 to 50%
less. Three things this PoC deliberately does **not** claim: performance at
production volume, an enforced security model, and migration of in-flight cases.
Each is scoped as Phase 1 work, and the recommended cutover strategy - drain and
switch - avoids the last one entirely.

---

## Supporting figures

| Measure | Result |
|---|---|
| Case types migrated and running end to end | 5 of 5 |
| Stages / steps migrated | 39 / 80 |
| Decision tables migrated and executing | 10 (28 rows) |
| Screen layouts / fields | 24 / 59 |
| Choice sets / values | 26 / 107 |
| Dataverse tables provisioned | 27 |
| Automated verification checks | 49 passed, 0 failed |
| Step bodies requiring manual implementation | 41 of 80 (~51%) |
| Flow connector transitions extracted | 264 (0 conditional) |
| Estimated Phase 1 effort | 87 - 132 days (~12 weeks, team of 3) |

## Related documents

- `Pega-to-PowerPlatform-Migration-PoC.pptx` - the full 49-slide deck
- `DEVELOPER-HANDOVER.md` - architecture, rule coverage matrix and the
  production readiness backlog
